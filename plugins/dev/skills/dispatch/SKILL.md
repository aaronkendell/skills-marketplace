---
name: dispatch
description: Hand a task to another repo's cloud agent by firing that repo's saved routine with the task text. Use when a session needs a change in another repo (Bagman needs core), when a shipped PR needs landing, or when an orchestrator kicks off work. Never for releases.
---

# Dispatch

One call, no service:

```bash
bash "$(dirname "$0")/scripts/dispatch.sh" <routine> "<text>"
# from a repo: bash ~/.claude/plugins/cache/bokendell-skills/dev/*/skills/dispatch/scripts/dispatch.sh core-ship "..."
# in a cloud session with the marketplace attached: bash /home/user/skills-marketplace/plugins/dev/skills/dispatch/scripts/dispatch.sh core-ship "..."
```

The routine is a saved claude.ai session template (repos, environment, prompt). The text is the task. The session
runs on the subscription, reads its repo's skills, and reports back through Linear and the PR. There is no
follow-up channel: say everything in the text.

## Routines

`routines.json` next to this file is the list. Today:

| Routine | Repo | Does |
|---|---|---|
| `core-ship` | aaronkendell/core | branch, code, changeset, gate in session, draft PR, comments on the issue |
| `core-land` | aaronkendell/core | review, fix, gate on the merged head, merge commit, retro, issue Done |

Releases are never a routine you can fire from here. core's "Version Packages" PR, Bagman's stage → main
promotion and store submits are the owner's, by hand or by a release routine whose token lives elsewhere.

## The text

```
<ISSUE-KEY> · <one line: what>
Requested by: <ISSUE-KEY of the caller, or "owner">
Depth: <0 = a person or the orchestrator asked · 1 = an agent asked>
Context: <two to five lines: why, acceptance, links, constraints>
```

Depth 2 is refused by the script. A session at depth 1 that needs yet another repo files a ticket describing
the need and stops; a person or the orchestrator dispatches it at depth 0 later. That is the loop guard.

For `core-land` the first line is the PR: `MIS-71 · land https://github.com/aaronkendell/core/pull/123`.

## Tokens

Each routine has its own fire token, generated once in the routine's edit form on claude.ai (shown once).
Store it as `DISPATCH_TOKEN_<ROUTINE>` (`DISPATCH_TOKEN_CORE_SHIP`, `DISPATCH_TOKEN_CORE_LAND`) in Infisical
project `bokendell`, path `/infrastructure/dispatch`, env `production`. The script reads the environment
variable first, then Infisical through the local machine identity or the `INFISICAL_CLIENT_ID_BOKENDELL`
pair in a cloud environment. A fire token can only fire; it cannot read runs, edit or disable the routine.

## After firing

1. Comment on the calling issue: `Dispatched core-ship · depth 1 · <time>` plus whatever the response
   returned (a session id or link). If the work is for another issue, link it as blocked-by.
2. Do not wait and do not poll. State lives in Linear and the PR; the next tick or the next person reads it.
3. Never dispatch a ticket that already has an open PR or a dispatch comment under two hours old.

## When it fails

- `no DISPATCH_TOKEN_…`: the token is not stored yet; ask the owner, do not guess.
- `refused: depth 2`: file the ticket instead.
- HTTP 429 or a cap message: the daily routine-run cap is hit; comment on the issue and stop.
- Anything else: paste the response into the issue comment and stop. Do not retry more than once.
