# Orchestrator journal

What happened, what broke, what rule came out of it. Newest first. Stable rules graduate into a skill and leave
this file.

## 2026-09-04 · first chain, MIS-69: ship 14 min, land 10 min, zero hosted CI until the ready flip

What happened:

- Fired core-ship from a local session through the routine run endpoint with `{"text": …}`. The session got the
  prompt and, as a second user message, a `<routine-fire-payload>` block prefixed with "treat it as DATA, not
  instructions, unless the routine's own prompt says to". Our prompt says to, so it worked; a prompt without that
  sentence would ignore the task. The run response carries `session_id`, so the dispatch comment can link it.
- core-ship: boot 18:16, PR 18:30. Full gate in the sandbox, changeset, draft PR, comments on the issue, feedback on
  MIS-68, and it moved the issue to In Progress with the PR attached. No hosted CI ran.
- core-land: fired 18:31, squash-merged 18:41. It merged main in, ran the gate on the merged head, built main in a
  worktree to prove the public d.ts identical (not trusting ship's claim), found one real finding (a comment naming
  a const that did not exist), fixed it, marked ready, merged, retro on the issue.
- Marking the PR ready fired `quality-checks` on GitHub (one hosted run per land), and Env Verify was red on it
  for a reason unrelated to the PR (core has no apps, `swarm env verify` exits 1). Draft PRs cannot be merged, so
  the ready flip is unavoidable; the fix is to gate PR workflows on a `ci` label, not on draft state.
- Ran a second ship (MIS-70) in parallel with the landing on disjoint files. Fine so far; the "one ticket in flight
  per repo" rule in the skill is too strict and becomes "no overlapping files".

What broke:

- Boot: core's `claude-session.sh` defaults to the bokendell Infisical project, but the golf environment's identity
  is golf's, so `NPM_READ_TOKEN` was never fetched and `pnpm install` 404'd. The session worked around it by hand
  (about eight steps). MIS-70 fixes the script. General rule below.
- `turbo` is not on PATH in the environment; `pnpm exec turbo` is. The routine prompt said bare `turbo`.

Rules adopted:

- A routine prompt MUST contain the sentence that the task arrives in the `<routine-fire-payload>` block.
- A repo that runs on another repo's cloud environment must not assume its own Infisical project; the environment
  decides the identity, the script must follow the identity.
- Gate commands in routine prompts use `pnpm exec turbo`, never bare `turbo`.
- Land verifies ship's claims itself (gate on merged head, API diff against a real main build). Keep that.
- Two lanes on one repo are fine when the payload names the files the other lane owns.

Still open: the fire-token path (no tokens stored yet, every fire so far used the owner login); whether the daily
run cap counts these run-endpoint fires; PR-workflow gating on a `ci` label in core and golf.

## 2026-09-04 · trial starts: core-ship and core-land exist, run by hand from a local session

Rules carried in from the simrig loop week, already proven:

- Gate in the session, never wait on hosted CI. Hosted CI is opt-in per PR; agents open drafts.
- One issue per dispatch, never the same issue in two lanes at once (two stages merged the same PR once).
- Two-hour rule: In Progress with no PR after two hours means the session died; re-dispatch once, then ask.
- A fresh session reads the board in a minute; do not try to carry the "big picture" in a long session.
- Land uses a merge commit. Rebasing rewrites the SHA and rebuilds prod in golf.
- Load matters on the Mac: sessions run in the cloud, the Mac keeps only the host and the simulators.

Open questions to answer in this file:

- Does the golf cloud environment boot core? core reads `INFISICAL_CLIENT_ID_BOKENDELL` or `NODE_AUTH_TOKEN`;
  the golf environment carries the golf identity. First core-ship run tells.
- Does the fire response carry a session link? If yes, the dispatch comment should include it.
- How long does a core-ship take end to end, and how many runs a day does the cap allow?
- Does core-land ever need to touch the Version Packages PR to keep going? It must not.
