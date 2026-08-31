# The dev loop

One entry point, single-purpose primitives underneath, per-repo playbooks at the side. Names
follow the `dev-loop` design (drive / draft-approach / review-change / map-paths / …) so the
shape reads the same in every repo; the machinery for teams (ownership, vet, watch, chat, lock
registries, capability config) is deliberately absent — this is a solo loop.

```
/drive  ─┬─ open-branch        branch + worktree + Linear In Progress + plan file (medium+)
         ├─ draft-approach     grill · receipts · lock (blocked by open questions)
         ├─ implement          (in drive) repo skills lead; stage, never commit
         ├─ review-change      dev:review + /code-review <explicit level> + /security-review
         ├─ map-paths          enumerate targets, runs nothing
         ├─ exercise-paths     run them; N of M with ✗ in the denominator; device items handed over
         ├─ record-qa          plan Gate · PR body · Linear · docs/qa
         ├─ commit-change      local gate (ci-local = lefthook/CI equivalent) → commit, on ask only
         └─ open-pr            DRAFT — Actions don't run yet; --ready undrafts → CI → merge, each on its own yes
         supporting: use-worktree · consult-knowledge · record-knowledge · onboard
         loop:       close-out → improve (signals) → weekly-skill-review → automations/monthly-skill-audit.md
         still here: dev-research (open-ended), dev-plan (design doc → issues)
```

## Facts hardcoded (no capabilities file)

Linear · GitHub + Actions · draft PRs · no chat · no human or automated reviewers · cloud sessions
(Claude Code cloud, Cursor) run the same skills on a fresh checkout · state = the branch's plan
file (`docs/planning/**/<ID>-plan.md`, `## Gate`) — never a machine-local file.

## Per-repo playbooks = repo-local skills

`<repo>/.claude/skills/verification` (changed X → run Y, gate commands, traps) and `testing`
(lanes) are required; `onboard` writes them by running the commands first. Domain skills
(`api-endpoint`, `db-change`, …) accumulate per repo. Cursor loads the same directories.

## Bands

low: implement → review low → gate → ship (no ticket, no plan file) · medium: light plan, review
high · high: hard grill, review xhigh, full map, security review on auth.

## Evals

Every primitive ships `evals/<case>/prompt.md + graders/*.md` asserting a **refusal** — a failure
that doesn't error (a commit nobody asked for, an unrun check reported green, a plan locked over
an open question). No ship-check and no PR-size gate: there is nobody to announce to, and the
user decides any split. Run: `claude plugin eval dev@bokendell-skills --eval-dir skills --case 'drive*'`.
Quality is what review is for; guardrails are what evals are for.

Runner that works today: `plugins/dev/evals/run-skill-evals.workflow.js` (with-skill vs baseline arms,
judge on another model, results appended to `<skill>/evals/results.jsonl`; see `plugins/dev/evals/README.md`).
`claude plugin eval` is early-access gated on this account (2026-08-29: "`plugin eval` is currently
in early access"). Until it opens, the cases are still the spec: run a case by hand by pasting its
`prompt.md` into a fresh session with the plugin loaded and checking the graders yourself, or via
the Workflow runner pattern in `skills/review/evals/runner.workflow.js` (llm/regex graders only —
`tool_used` graders need the trace the CLI provides).
