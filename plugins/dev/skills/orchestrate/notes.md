# Orchestrator journal

What happened, what broke, what rule came out of it. Newest first. Stable rules graduate into a skill and leave
this file.

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
