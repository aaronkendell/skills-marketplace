export const meta = {
	name: 'run-skill-evals',
	description: 'Run native eval cases (prompt.md + graders) for one or more skills: with-skill vs baseline arms, judge on a different model, regex/tool_used graded in code',
	whenToUse: 'Re-run a skill\'s evals after editing it, or against a new model. Works today (no `claude plugin eval` gate). Usage: Workflow({scriptPath: "<marketplace>/plugins/dev/evals/run-skill-evals.workflow.js", args: {skillsDir, skills: ["api-endpoint"], repo, answerModel?, judgeModel?, baseline?, runs?, stamp}})',
	phases: [
		{ title: 'Load', detail: 'one reader per skill turns evals/<case>/ into structured cases' },
		{ title: 'Answer', detail: 'with-skill and baseline arms, blind to the graders' },
		{ title: 'Judge', detail: 'llm graders on a different model; regex/tool_used in code' },
	],
}

// ---- args ------------------------------------------------------------------
// skillsDir   absolute dir holding <skill>/SKILL.md (e.g. <repo>/.claude/skills or <marketplace>/plugins/dev/skills)
// skills      array of skill names to run (required — refuses to run blind over everything)
// repo        absolute repo root the answering agent works in (read-only); defaults to skillsDir's repo
// answerModel omit to inherit the session model; judgeModel defaults to 'opus'; baseline defaults true; runs defaults 1
// stamp       ISO date string supplied by the caller (scripts cannot read the clock)
const A = args ?? {}
if (!A.skillsDir || !Array.isArray(A.skills) || A.skills.length === 0) {
	throw new Error('args.skillsDir and a non-empty args.skills[] are required — say which skills, so the agent count is visible before spending it')
}
const RUNS = A.runs ?? 1
const BASELINE = A.baseline !== false
const ANSWER_MODEL = A.answerModel ?? 'opus'   // never inherit the session model by default — it may be the expensive tier
const JUDGE_MODEL = A.judgeModel ?? 'sonnet'   // must differ from the answerer
const REPO = A.repo ?? A.skillsDir.replace(/\/\.claude\/skills\/?$/, '').replace(/\/plugins\/[^/]+\/skills\/?$/, '')
const ARMS = BASELINE ? ['with_skill', 'without_skill'] : ['with_skill']

// ---- schemas ---------------------------------------------------------------
const CASES_SCHEMA = {
	type: 'object', required: ['skill', 'cases'],
	properties: {
		skill: { type: 'string' },
		cases: { type: 'array', items: { type: 'object', required: ['slug', 'name', 'prompt', 'graders'], properties: {
			slug: { type: 'string' }, name: { type: 'string' }, prompt: { type: 'string' }, mode: { type: 'string', enum: ['planning', 'build'] },
			allowedTools: { type: 'array', items: { type: 'string' } },
			graders: { type: 'array', items: { type: 'object', required: ['name', 'type'], properties: {
				name: { type: 'string' },
				type: { type: 'string', enum: ['regex', 'llm', 'tool_used', 'tool_order', 'file_exists'] },
				pattern: { type: 'string' }, match: { type: 'string' }, target: { type: 'string' },
				criteria: { type: 'string' },
				tool: { type: 'string' }, input_match: { type: 'string' }, min: { type: 'number' }, max: { type: 'number' },
			} } },
		} } },
	},
}
const ANSWER_SCHEMA = {
	type: 'object', required: ['answer', 'toolCalls'],
	properties: {
		answer: { type: 'string', description: 'the complete final response to the task, verbatim' },
		gitStatus: { type: 'string', description: 'build mode only: verbatim `git status --short` output at the end; empty string in planning mode' },
		worktreePath: { type: 'string', description: 'build mode only: the absolute path of the isolated worktree you worked in (your cwd); empty string in planning mode' },
		toolCalls: { type: 'array', description: 'every tool call made, in order', items: { type: 'object', required: ['tool', 'input'], properties: { tool: { type: 'string' }, input: { type: 'string', description: 'the command / file path / first 200 chars of input' } } } },
	},
}
const VERDICTS_SCHEMA = {
	type: 'object', required: ['verdicts'],
	properties: { verdicts: { type: 'array', items: { type: 'object', required: ['name', 'passed', 'evidence'], properties: { name: { type: 'string' }, passed: { type: 'boolean' }, evidence: { type: 'string' } } } } },
}

// ---- helpers (plain code, deterministic) --------------------------------------
function safeRe(pattern) {
	// graders are authored for `claude plugin eval` (PCRE-ish); translate the common inline flag
	let flags = ''
	let p = pattern
	if (p.startsWith('(?i)')) { flags = 'i'; p = p.slice(4) }
	try { return new RegExp(p, flags) } catch (e) { return null }
}

function gradeInCode(grader, run) {
	if (grader.type === 'regex') {
		const re = safeRe(grader.pattern)
		if (!re) return { name: grader.name, type: 'regex', passed: null, evidence: `INVALID PATTERN for JS RegExp: /${grader.pattern}/ — fix the grader` }
		const hit = re.test(run.answer ?? '')
		return { name: grader.name, type: 'regex', passed: grader.match === 'not_contains' ? !hit : hit, evidence: hit ? `matched /${grader.pattern}/` : `no match for /${grader.pattern}/` }
	}
	if (grader.type === 'tool_used') {
		const re = grader.input_match ? safeRe(grader.input_match) : null
		const n = (run.toolCalls ?? []).filter(c => c.tool === grader.tool && (!re || re.test(c.input ?? ''))).length
		const min = grader.min ?? (grader.max === undefined ? 1 : 0), max = grader.max ?? Infinity
		return { name: grader.name, type: 'tool_used', passed: n >= min && n <= max, evidence: `${n} matching ${grader.tool} call(s) (self-reported by the answering agent)` }
	}
	return null // llm → judge stage; tool_order/file_exists → unsupported here, reported as skipped
}

// ---- Load ----------------------------------------------------------------------
phase('Load')
const loaded = (await parallel(A.skills.map(skill => () => agent(
	`Read every eval case for the skill "${skill}" under ${A.skillsDir}/${skill}/evals/. ` +
	`A case is a directory containing prompt.md (YAML frontmatter with name/tags/runs/max_turns/allowed_tools, then the prompt body) ` +
	`and graders/*.md (YAML frontmatter: type + fields, then a why-body). Return, via StructuredOutput, the skill name and every case with: ` +
	`slug (the directory name), name (frontmatter name), prompt (the body text after the frontmatter, verbatim), allowedTools, and each grader's ` +
	`frontmatter fields exactly as written (name = grader filename without .md; for llm graders put the full criteria text in "criteria"); mode = the prompt frontmatter's mode field ('planning' if absent). ` +
	`Ignore evals/evals.json and evals/cases/ (other formats). If there are no cases, return an empty cases array. Read only; write nothing.`,
	{ label: `load:${skill}`, phase: 'Load', schema: CASES_SCHEMA, effort: 'low', model: 'haiku' },
)))).filter(Boolean)

const work = []
for (const { skill, cases } of loaded) for (const c of cases) for (const arm of ARMS) for (let run = 1; run <= RUNS; run++) work.push({ skill, c, arm, run })
log(`${loaded.length} skill(s), ${work.length} answer run(s) (${ARMS.length} arm(s) × ${RUNS} run(s) per case)`)
if (!work.length) return { results: [], note: 'no cases found' }

// ---- Answer → Judge, pipelined per run ------------------------------------------
const results = await pipeline(
	work,
	({ skill, c, arm, run }) => agent(
		`Execute this task in the repository at ${REPO}. ` +
		(c.mode === 'build'
			? `This is a BUILD task: implement it for real — Read/Grep/Glob/Bash, Write and Edit are allowed. Stage your files individually with git add <file> (NEVER -A/.). Do NOT commit, push, run migrations, start servers, or touch any remote. When done, run git status --short and report it verbatim as gitStatus, and report your absolute working directory (the isolated worktree) as worktreePath. `
			: `You may only READ (Read, Grep, Glob, and read-only Bash such as cat/ls/grep). Do not create, write, edit, commit, run tests, start servers, or touch any remote. `) +
		`\n\n` +
		(arm === 'with_skill'
			? `Skill path: ${A.skillsDir}/${skill}/SKILL.md — read it first and follow it. `
			: `Constraint for this run: do NOT use the Skill tool and do NOT open anything under ${A.skillsDir}/. Work from the codebase itself. `) +
		`\n\nTask:\n${c.prompt}\n\n` +
		`When done, return via StructuredOutput: "answer" = your complete final response to the task, verbatim, as you would give it to the user; ` +
		`"toolCalls" = every tool call you made in order (tool name + command/path/first 200 chars of input). Report tool calls honestly — they are graded.`,
		{ label: `${skill}/${c.slug}#${arm}${RUNS > 1 ? '#' + run : ''}`, phase: 'Answer', schema: ANSWER_SCHEMA, model: ANSWER_MODEL, ...(c.mode === 'build' ? { isolation: 'worktree' } : {}) },
	),
	async (answered, { skill, c, arm, run }) => {
		if (!answered) return null
		if ((answered.answer ?? '').length < 200) { log(`DEGENERATE ANSWER dropped: ${skill}/${c.slug}#${arm}#${run} (${(answered.answer ?? '').length} chars)`); return null }
		let coded = []
		try { coded = c.graders.map(g => gradeInCode(g, answered)).filter(Boolean) } catch (e) { coded = [{ name: 'grading-crashed', type: 'regex', passed: null, evidence: String(e) }] }
		const llm = c.graders.filter(g => g.type === 'llm')
		const skipped = c.graders.filter(g => !['regex', 'llm', 'tool_used'].includes(g.type)).map(g => ({ name: g.name, type: g.type, passed: null, evidence: 'grader type not supported by this runner' }))
		let judged = []
		if (llm.length) {
			const v = await agent(
				`You are grading one response against fixed criteria. Do not invent criteria. For each criterion return passed=true only with specific evidence quoted from the response; when uncertain, fail it — the burden of proof is on the response. ` +
				(c.mode === 'build' && answered.worktreePath
					? `The work was done in an ISOLATED WORKTREE at ${answered.worktreePath} — verify files, diffs and git status THERE (cd into it), NOT in ${REPO}, which is a different checkout with unrelated uncommitted changes. Never modify anything.\n\n`
					: `You may READ files in ${REPO} to verify factual claims the response makes (paths, line numbers, helper names); never modify anything.\n\n`) +
				`Criteria:\n${llm.map(g => `- [${g.name}] ${g.criteria}`).join('\n')}\n\n` +
				`--- RESPONSE UNDER TEST ---\n${answered.answer}\n--- END ---\n` +
				(c.mode === 'build' ? `--- GIT STATUS AT END (self-reported) ---\n${answered.gitStatus ?? '(none reported)'}\n--- END ---\n` : '') + `\n` +
				`Return one verdict per criterion, name = the bracketed grader name.`,
				{ label: `judge:${skill}/${c.slug}#${arm}`, phase: 'Judge', schema: VERDICTS_SCHEMA, model: JUDGE_MODEL },
			)
			// normalize: judges sometimes rename or split criteria — map back to the given grader names
			const vs = v?.verdicts ?? []
			judged = llm.map((g, i) => {
				const hit = vs.find(x => x.name === g.name) ?? vs.find(x => x.name && (x.name.includes(g.name) || g.name.includes(x.name))) ?? vs[i]
				return hit ? { name: g.name, passed: hit.passed, evidence: hit.evidence, type: 'llm' } : { name: g.name, type: 'llm', passed: null, evidence: 'judge returned no verdict for this criterion' }
			})
		}
		const graders = [...coded, ...judged, ...skipped]
		const scored = graders.filter(g => g.passed !== null)
		return { skill, case: c.slug, arm, run, passed: scored.filter(g => g.passed).length, total: scored.length, graders, answerChars: answered.answer.length }
	},
)

const rows = results.filter(Boolean)
const dropped = work.length - rows.length
if (dropped) log(`WARNING: ${dropped} run(s) produced no result and are excluded — do not read the summary as complete`)

// ---- summary: per skill × arm, and discrimination per case ---------------------
const summary = {}
for (const r of rows) {
	const k = `${r.skill}:${r.arm}`; summary[k] ??= { passed: 0, total: 0, runs: 0 }
	summary[k].passed += r.passed; summary[k].total += r.total; summary[k].runs++
}
const discrimination = []
for (const { skill, cases } of loaded) for (const c of cases) {
	const w = rows.filter(r => r.skill === skill && r.case === c.slug && r.arm === 'with_skill')
	const b = rows.filter(r => r.skill === skill && r.case === c.slug && r.arm === 'without_skill')
	const rate = xs => xs.length ? xs.reduce((a, r) => a + r.passed, 0) / Math.max(1, xs.reduce((a, r) => a + r.total, 0)) : null
	discrimination.push({ skill, case: c.slug, with_skill: rate(w), without_skill: rate(b), delta: (rate(w) ?? 0) - (rate(b) ?? 0) })
}
for (const d of discrimination) log(`${d.skill}/${d.case}: with ${d.with_skill?.toFixed(2)} · without ${d.without_skill?.toFixed(2)} · Δ ${d.delta.toFixed(2)}${d.delta <= 0 && d.without_skill !== null ? '  ← non-discriminating' : ''}`)

return { stamp: A.stamp ?? null, answerModel: ANSWER_MODEL, judgeModel: JUDGE_MODEL, summary, discrimination, results: rows, dropped }
