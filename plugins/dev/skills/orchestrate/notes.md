# Orchestrator journal

What happened, what broke, what rule came out of it. Newest first. Stable rules graduate into a skill and leave
this file.

## 2026-09-04 · fourth wave: the feedback loop pays for itself, and the routine prompts are the thing being debugged

Where it stands: three sessions posted structured friction to the golf feedback log today. One of them caught a
wrong secret claim in `dev:app-store` — a skill written the same evening, naming the Sign in with Apple key as the
App Store Connect key — and cost itself fifteen minutes finding it.

Rules adopted:

- Read the feedback log before writing a skill, and distrust a skill written from a ticket rather than from the
  running system: it will contain claims like that one. The log is how they get caught; it is worth the read.
- Sessions criticise the routine prompt itself and are usually right. One reported the mandated pre-push gate is
  unreachable from a stage branch in the sandbox; another that the mandated `gh pr merge` fails because gh is
  unauthenticated there. A prompt rule the environment cannot satisfy is a bug in the prompt, not a session that
  gave up — fix the prompt.
- A gate must be proportionate to the diff. Demanding a full build and test run for an eight-file YAML change made
  a session invent its own checks and then explain itself. Name the smaller gate for documentation- and
  workflow-only changes rather than making every session improvise one.
- Verify a private publish against the registry with a read token, never a bare `npm view`: unauthenticated it
  returns a stale version and then a not-found, which reads exactly like a failed publish.
- A landing session that ends without merging AND without commenting loses its findings. Commenting is not
  optional; holding silently is worse than holding.

## 2026-09-04 · third wave: seven routines, three simrig tickets shipped and landed with no human in the loop

Where it stands: seven routines across four repos (core, golf, skills-marketplace, simrig). SIM-239, SIM-291 and
SIM-297 each went ship → land → merge without a person touching them, and each landing session wrote its own
retro PR.

Rules adopted:

- The dominant failure mode is the sandbox permission prompt on a file the sandbox deems sensitive (`.npmrc`,
  `lefthook.yml`). A parked session is invisible unless someone checks: `list_runs` reports `requires_action`,
  and that is the signal an orchestrator polls for. The routine API accepts an `auto_mode_allow` field and
  silently drops it, so pre-approval is not available — the owner clicks, or the edit happens locally.
- A fire always starts a NEW session; there is no way to message a live one. An agent that needs something
  stops and writes it on the ticket. That is the only inter-agent channel, and it is durable — which is why
  Linear is the registry.
- A landing session verifies, never trusts. The SIM-332 landing plants the violation each guard should catch;
  the core landing rebuilt main in a worktree to diff the published types. Both found real defects.
- Deploy archaeology: a GitHub run that fails with zero jobs is an invalid workflow file, not a failing step.
  Golf had not deployed since 2026-08-11 for exactly that reason.

## 2026-09-04 · second wave: five routines, one stalled session, three weeks of deploys that never ran

What broke:

- A routine session hit a sandbox permission prompt on `.npmrc` and stalled indefinitely. Nobody can answer a
  permission prompt from the API; the session burns until it is killed.
- Landing a draft PR necessarily flips it to ready, which fired hosted CI on both core and golf.
- Landing golf's own CI PR surfaced that both golf deploy workflows had been invalid since 2026-08-11 — a duplicate
  job block nested under `permissions:`. GitHub recorded a zero-job failed run on every push, and no stage or
  production deploy had run for three weeks.
- A rig MCP 401 that a QA session diagnosed as a missing `Bearer` prefix was an empty `RIG_TOKEN` at session start.

Rules adopted:

- A routine prompt forbids editing credential files (`.npmrc`, anything holding a token) and says to describe the
  needed change in the PR instead. All five routine prompts now carry that line.
- Gate hosted PR workflows on a `ci` label, not on draft state. Done in core (#331) and golf (#89).
- A failed run with zero jobs means an invalid workflow file, never a failing step. `actionlint` catches it in a
  second; GOLF-495 puts it in the pre-push gate.
- Anything an MCP server config interpolates has to exist in the environment before the session starts. The MCP
  client expands `${VAR}` from the process environment at session start, so a SessionStart hook cannot fix it —
  the `rig` CLI works because it reads Infisical at run time.

Still open: the fire-token path is untested; every fire so far came from the owner's login. Five routines now
exist (core ship/land, golf ship/land, marketplace ship).

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
