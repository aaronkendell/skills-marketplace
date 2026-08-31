---
name: commit-change
description: >
  Run the local gate — the lefthook / CI-equivalent checks via `dev:ci-local` and the repo's
  verification skill — then stage deliberately and commit. Only runs when the user asks to
  commit; never auto-invoked by another stage. Refuses to commit on a red gate.
argument-hint: "[message] [--amend] [--skip=<check> --reason=...]"
---

# commit-change

**Invoked = asked.** No other stage calls this; the workspace rule is that nothing commits
unless the user says so, and this skill is how they say so.

## 1 · Gate — before staging

Run the repo's gate as `dev:ci-local` and its `verification` skill define it: biome, typecheck
(affected), arch rules, lockfile/catalog drift, warm build where the repo needs it, the tests for
the change type. Stop on the first red — fix, don't skip. A skip needs `--skip=<check>
--reason=...` and the reason goes in the commit body.

The commit itself uses `--no-verify` (workspace convention) because you just ran the equivalent
by hand — that is the deal, and it only holds if the gate actually ran.

## 2 · Stage deliberately

`git add <file>` per file. Never `-A` or `.` — that's how `.env.workspace`, scratch files and
`.qa-kickoff.md` get committed. Read the diff of anything that could carry a credential.

Never stage: env files, `.worktrees/`, `docs/qa/passes/*.json` unless the pass is the
deliverable, another worktree's files.

## 3 · Message — read the diff, not the filenames

```
GOLF-123 — record skipHole as a durable round event        # ticketed
fix: keypad blur hoist on score commit                      # one-off, conventional type
```

Body: bullets of what changed and why; a skipped gate and its reason; `Co-Authored-By` and
`Claude-Session` trailers as the harness supplies them. Several logical changes → several commits.

## 4 · Push

`git push -u origin <branch> --no-verify`. Then `open-pr`.

## Report

Gate results (each check, pass/fail), files committed, message, push status. An unstated skip
becomes a surprise in CI.
