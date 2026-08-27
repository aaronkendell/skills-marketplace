# dev:review evals

Unit tests for the review skill. Each case is a file with violations planted on
purpose; the score is **recall** — what fraction of the planted violations the
review actually found. Recall is the right metric because review's whole job here
is to be a gate: a review that misses two of three violations is worse than no
review, since it produces false confidence.

## Cases

| Case | Plants | Why it matters |
|---|---|---|
| `domain-vendor-leak` | vendor SDK in domain code · raw `process.env` · swallowed error | Three named workspace non-negotiables |
| `mobile-purity` | screen calls domain hooks · `useMemo` outside a container · raw color literal | Enforced by arch rules in some repos, review-only in others |
| `api-contract` | raw `fetch` to own backend · unvalidated payload to the DB · unbounded list route | The raw-fetch plant has a matching `no-raw-backend-fetch` arch rule, so this also checks that review and the rule agree |

## Two rules that make the numbers mean anything

1. **The fixtures are blind.** The code in each `case.yaml` carries no "this is a
   test" marker and no list of what was planted. An agent that knows it is being
   graded behaves differently — that is the behaviour you must not measure. If you
   add a case, do not annotate the violations in the code.
2. **The judge is a different model from the answerer.** A model is never the sole
   authority on its own output.

## Running it

`claude plugin eval` is the intended runner and this suite is authored in its
native layout (`cases/*/case.yaml` + `graders/*.md`). It is currently gated behind
early access on this account:

```bash
claude plugin eval dev@bokendell-skills --eval-dir plugins/dev/skills/review/evals
# -> "`plugin eval` is currently in early access"
```

Until that opens, run the same cases and the same graders through the Workflow tool:

```
Workflow({ scriptPath: "~/repos/bokendell/skills-marketplace/plugins/dev/skills/review/evals/runner.workflow.js" })
```

Optional args: `{ cases: ["mobile-purity"], runs: 5, answerModel: "sonnet", judgeModel: "opus" }`.
Both runners read the same `case.yaml` and the same `graders/criteria.md`, so they
cannot drift apart.

## When to run it

On every edit to `plugins/dev/skills/review/SKILL.md` or to the pattern docs it
loads. A skill edit that drops recall is a regression, and without this it is an
invisible one.

Record the run in `results.jsonl` (one line per run: date, case, mean, model) so
regressions are diffable. Do not commit raw agent transcripts.

## Baseline (2026-08-27) — and why it is a problem

First run scored **1.0 on all three cases** (sonnet answering, opus judging, 1 run each).
Every planted violation was found, with the right pattern citation, in every case.

That is a **ceiling, not a pass.** An eval that scores 100% on its first run has no
discriminating power: it cannot tell a good edit from a bad one, because both score 1.0.
It is a green light that will stay green while the skill degrades underneath it.

So treat this suite as *calibrated too easy* until it fails something. The fix is harder
cases, not celebration:

- Violations that need two files to see (a contract change whose consumer is elsewhere).
- Violations that look like the correct pattern at a glance — a container that is really a
  screen, an env read hidden behind a helper.
- A **control case with NO violations**, to measure false positives. Recall alone is half a
  metric; a review that flags everything scores 1.0 on recall and is useless.

## Adding a case

Add one when review misses something in real work — the miss IS the case. Plant the
violation in plausible code, write the grader to name it explicitly, and say in the
grader what does NOT count as credit (vague adjacent findings are the main way a
recall number gets inflated).
