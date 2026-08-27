export const meta = {
	name: 'review-eval',
	description: 'Score dev:review recall against planted-violation fixtures',
	phases: [
		{ title: 'Answer', detail: 'blind agents review each fixture' },
		{ title: 'Judge', detail: 'independent grader scores recall' },
	],
}

// Runner for this suite while `claude plugin eval` is in early access.
// Same cases, same graders — read from disk so the two runners can never drift.
//
// Two properties matter and both are deliberate:
//  1. The answering agent is BLIND. It gets the code and nothing else: no rubric,
//     no "this is an eval", no planted-violation list. An agent that knows it is
//     being graded reviews differently, which is exactly what you must not measure.
//  2. The judge is a DIFFERENT model from the answerer, so a model is never the
//     sole authority on its own output.

const CASES = args?.cases ?? ['domain-vendor-leak', 'mobile-purity', 'api-contract']
const RUNS = args?.runs ?? 3
const ANSWER_MODEL = args?.answerModel ?? 'sonnet'
const JUDGE_MODEL = args?.judgeModel ?? 'opus'

const SCORE_SCHEMA = {
	type: 'object',
	required: ['found', 'missed', 'score'],
	properties: {
		found: { type: 'array', items: { type: 'string' }, description: 'planted violations correctly identified' },
		missed: { type: 'array', items: { type: 'string' }, description: 'planted violations the response failed to identify' },
		score: { type: 'number', description: 'fraction of planted violations found, 0..1' },
		notes: { type: 'string' },
	},
}

const results = await pipeline(
	CASES.flatMap((name) => Array.from({ length: RUNS }, (_, run) => ({ name, run }))),

	// Stage 1 — blind answer. Only the prompt body from case.yaml is passed through.
	({ name, run }) =>
		agent(
			`Read the file plugins/dev/skills/review/evals/cases/${name}/case.yaml relative to the ` +
			`skills-marketplace repo root (~/repos/bokendell/skills-marketplace). Extract ONLY the ` +
			`value of its "prompt:" key — ignore every other field, and do not read any other file ` +
			`in that directory. Then carry out that prompt as a normal request. Return only your ` +
			`review. Run variant ${run + 1}.`,
			{ label: `answer:${name}#${run + 1}`, phase: 'Answer', model: ANSWER_MODEL },
		),

	// Stage 2 — independent judge, different model, grader loaded fresh.
	(review, { name, run }) =>
		agent(
			`You are grading one response against a fixed rubric.\n\n` +
			`Read the rubric at plugins/dev/skills/review/evals/cases/${name}/graders/criteria.md ` +
			`(relative to ~/repos/bokendell/skills-marketplace) and apply it exactly as written. ` +
			`Do not invent additional criteria.\n\n` +
			`--- RESPONSE UNDER TEST ---\n${review ?? '(the answering agent returned nothing)'}\n--- END ---`,
			{ label: `judge:${name}#${run + 1}`, phase: 'Judge', model: JUDGE_MODEL, schema: SCORE_SCHEMA },
		).then((verdict) => ({ case: name, run: run + 1, ...verdict })),
)

const scored = results.filter(Boolean)
const byCase = {}
for (const r of scored) (byCase[r.case] ??= []).push(r.score)

const summary = Object.entries(byCase).map(([name, scores]) => ({
	case: name,
	runs: scores.length,
	mean: Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(3)),
	min: Math.min(...scores),
}))

for (const s of summary) log(`${s.case}: mean ${s.mean} (min ${s.min}, n=${s.run ?? s.runs})`)

const dropped = CASES.length * RUNS - scored.length
if (dropped > 0) log(`WARNING: ${dropped} run(s) produced no verdict and are excluded from the means`)

return { summary, detail: scored, dropped }
