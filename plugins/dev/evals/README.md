# Skill evals — the reproducible runner

Cases are files next to each skill (`<skill>/evals/<case>/prompt.md + graders/*.md`, the native
`claude plugin eval` layout — see golf's `.claude/skills/README-evals.md` for the format). This
directory holds the runner that executes them today, while `plugin eval` is early-access gated,
and the conventions that make a run comparable to the next one.

## Run

```
// From a session whose cwd is NOT the marketplace, Workflow refuses an outside scriptPath —
// pass the file's contents as `script` the first time; the tool returns a persisted path to reuse.
Workflow({
  scriptPath: "~/repos/bokendell/skills-marketplace/plugins/dev/evals/run-skill-evals.workflow.js",
  args: {
    skillsDir: "<repo>/.claude/skills",        // or <marketplace>/plugins/dev/skills
    skills: ["api-endpoint", "db-change"],     // required — never blind over everything
    repo: "<repo>",                             // where the answering agent reads code
    answerModel: "opus",                        // default opus — never the session model (may be the expensive tier)
    judgeModel: "sonnet",                       // default sonnet; must differ from the answerer
    baseline: true, runs: 1,
    stamp: "2026-08-31"                         // scripts cannot read the clock
  }
})
```

Two arms per case: **with_skill** (agent reads the SKILL.md first) and **without_skill**
(forbidden from opening it). `regex` and `tool_used` graders are scored in code; `llm` graders
go to a judge on a different model that may read the repo to verify claims. Tool calls are
self-reported by the answering agent (the harness exposes no trace to a script) — treat
`tool_used` verdicts as honest-agent evidence, not proof.

The log prints one line per case: `with · without · Δ`. **Δ ≤ 0 means the case does not
discriminate** — rewrite the graders to assert what the baseline got wrong (compare the two
answers), not what any competent answer includes.

## Record

Append one line per (case, arm) to `<skill>/evals/results.jsonl` after the run:

```
{"date":"2026-08-31","case":"contract-first-no-inline-schema","arm":"with_skill","passed":5,"total":5,"answerModel":"session","judgeModel":"opus","skillSha":"<git hash of SKILL.md>","note":""}
```

That file is the regression record: a skill edit or a new model that drops a case is visible as a
diff. Never commit agent transcripts.

## Trigger sets

`<skill>/evals/trigger.json` — 8–10 realistic should-trigger prompts and 8–10 near-miss
should-not (same words, different need). Run with skill-creator:

```
PYTHONPATH=<skill-creator dir> python3 -m scripts.run_eval --eval-set <skill>/evals/trigger.json \
  --skill-path <skill dir> --model sonnet
```
(from the skill-creator plugin dir; needs `pyyaml`).

**Measured limitation (2026-08-31): this harness reads ~0% in this estate.** It marks a query
triggered only if the session's FIRST tool call is Skill/Read naming the temp command — but with
~120 user-scope skills loaded and sessions that orient first (hooks, git status), the first call
is never the skill, even for `drive GOLF-640` from an empty project (sonnet probe: False). Treat
trigger.json files as documentation of intended coverage; the working instrument for
description-triggering is skill-watch's expected-skill telemetry from REAL sessions (a miss there
is a real miss).

## When `plugin eval` opens

Same files, no conversion: `claude plugin eval ./plugins/dev --eval-dir skills --case '<skill>*' --model <m>`.
`scripts/evals-to-skill-creator.py` derives `evals.json` for the skill-creator viewer loop.

## Prompt shape (policy, 2026-08-31)

Mixed by skill: **planning-shaped** ("show, don't write") for knowledge skills (authz, secrets,
ci-gate, observability, testing…); **build-shaped** for implementation skills (api-endpoint,
db-change, domain-change, mobile-feature, email-template). Build mode (to implement in the
runner): case frontmatter `mode: build` → the answer agent runs with worktree isolation and MAY
Write/Edit and stage (never commit); graders may then assert on files and `git status` (staged
set contains X, `.env*` unstaged). Until that lands, all cases are planning-shaped.

## Δ0 policy

A Δ0 case proves one claim is convention/arch-rule-held — slim THAT section of the skill to a
pointer naming the rule or exemplar (mark it "eval-verified"), keep the eval as a tripwire, and
do not cut the untested sections on that evidence.

## Judge calibration (measured 2026-08-31)

Sonnet-vs-opus on identical answers and criteria (33 llm verdicts, 6 skills): ~94% agreement;
both disagreements were sonnet verdicts contradicting their own quoted evidence, and opus flipped
them toward the evidence. Policy: sonnet is the default judge; on any negative or borderline
delta, re-judge with opus via `resumeFromRunId` + `judgeModel: "opus"` (answers replay from
cache — only judges rerun) before blaming the skill.

## Grader rule: never `not_contains` a bare name (3 strikes, promoted 2026-08-31)

A `regex not_contains` on a bare identifier/domain/tool-name convicts answers that MENTION the
thing while correctly rejecting it (invented schema named while refusing it; example minted link
printed; "not Testcontainers because…"). Scope negative regexes to USE/ASSEMBLY sites
(definition, `.output(`, template-literal/concat, a proposed filename) — or give the negative
judgement to an llm grader, which can tell a mention from a use.
