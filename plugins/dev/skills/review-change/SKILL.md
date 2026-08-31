---
name: review-change
description: >
  Review a change as the only reviewer it will get — patterns via `dev:review`, correctness via
  the built-in `/code-review` at an explicitly chosen level, security via `/security-review`
  when warranted. Proposes the exact invocation first. Use before QA on your own branch, and in
  `--agent-branch` mode on anything a cloud agent produced.
argument-hint: "[pr | branch] [--level=low|medium|high|xhigh|max] [--agent-branch] [--until-clean] [--propose-only]"
---

# review-change

A thin wrapper. It exists to load context the built-ins can't have, pass the level explicitly,
and state the reasoning. It does not reimplement review.

## 1 · Load the rubric

`consult-knowledge --for-review`. A finding cites a doc, decision, repo skill, arch rule, or a
reproducible defect — or it's dropped. Check `docs/decisions/` before flagging a deliberate
choice.

## 2 · Read the context

Blast radius — modules touched, schema migrations; auth/money/scheduled paths;
`git log -p --follow` on the touched files — the same bug fixed twice is where the real finding
usually is.

## 3 · Propose, then wait

```
review-change

  reads    420 prod lines · touches rounds.service + live SSE · authz path
           2 prior fixes on hole-score.repository
  proposes
    dev:review (patterns) then
    /code-review xhigh --fix
    /security-review        ← authz on a stream endpoint
  because  xhigh: auth-adjacent and prior findings here; --fix: it is our branch;
           not max: no cross-repo consumers.
  waits
```

**Always pass the level explicitly** — `/code-review` reuses whatever was typed last, silently.
Default `high`; `xhigh` for auth/crypto/money/migrations, prior findings on these files, or a
previous round that missed something real.

## 4 · Sole reviewer — cover the runtime column too

There is no bugbot and no teammate. So beyond patterns:

- per-item error handling in every batch loop, or one bad row kills the pass
- the flag-off / legacy / fallback branch got the same treatment
- singleton or module-level state that leaks across requests or tenants
- **trace one test into the new conditional** — stubbed-to-empty is the common miss
- expensive work done twice (a second resolve, a second fetch)
- metric semantics changing under a counter someone compares before/after
- dead code (a grep returns only the definition)

Say plainly in the write-up that this was the only review, so the reader calibrates.

## 5 · `--agent-branch` — reviewing a cloud agent's work

Ownership is "an agent"; mode is still fix (it's your repo), but the stance changes:

- **Verify every claim.** "Ran against stage, 5/6 green" → rerun it. "Written but never run" is
  a ✗ until you run it.
- Compare *their* verification list with your own `map-paths` — a target you find that they
  didn't is a finding; one they ran that you missed is a `skill-watch` signal about `map-paths`.
- Adopt what holds, redo what is thin, note disagreements in the plan file's `## Deviations`.
- Never blind-merge the branch.

## 6 · Loop

`--until-clean --max-rounds=3`: run → fix → re-run on the delta only. Round 3 still dirty means
escalate — that's a signal about the change, not the review.

## Writing back

Plan file → `## Gate`: `review` checked only when a round ends with no open findings above nit.
Record declined findings with the reason under `## Review notes`; they go in the PR body.
