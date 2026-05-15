---
name: design-comments
description: >
  Inbox + address workflow for design annotations. Lists every `open`
  annotation across an app's flows (or filters to one flow), then walks
  through each — reading the comment + the source file + the flow's
  decisions.md, making the fix, and posting a reply that marks the
  annotation `addressed`. Triggers when the user says: "check comments",
  "address feedback", "any new design comments", "let's go through the
  feedback", or invokes `/design-comments` / `/design-address`.
---

# Design Comments — Skill

Operational inbox for the annotation system. Replaces "scroll through
.annotations/ files" with "walk through the open list in claude code,
fix as you go."

## Three modes

### `/design-comments` (list mode)

Default behavior. Pulls every annotation with `status=open` from swarm-api
for the configured app + flow filter, displays them as a table grouped by
flow → artboard, and asks what to do.

Args:
- `--app <golf|hive|portfolio>` (required)
- `--flow <slug>` (optional — defaults to all flows)
- `--since <iso>` (optional — only annotations newer than this)
- `--author <id|"agent:*">` (optional — filter by who left it)

Example output:
```
Open annotations for golf (12 across 3 flows)

round
  sg-skins-light
    1. [bo] "The Bar height looks off — should be 8px not 12px"
    2. [agent:taste] "Spacing between rows feels arbitrary"
  sc-greenies-light
    3. [agent:impeccable] "Title hierarchy weak — use scale-XL"
...

What now? [a]ddress one · [b]atch all · [d]rop one · [q]uit
```

### `/design-address <id>` (single mode)

Address one annotation. The skill:
1. Fetches the thread via `${swarmApiUrl}/api/v1/annotations/<id>/thread`
2. Reads the artboard's source (`apps/<app>/design/flows/<flow>/main.tsx`)
3. Reads decisions.md + HARD-RULES
4. Decides the fix (uses Edit on the source file)
5. POSTs a reply: "addressed in <commit ref / file path>"
6. Marks the annotation `status: addressed` via PATCH

Doesn't commit — just stages. User commits themselves.

### `/design-address-all --max <N>` (batch mode)

Walk through open annotations in order, addressing each. Stops after N
findings (default 10) or on the first error. Skips findings tagged
`agent:` if `--humans-only` is passed.

Useful at the end of a review session: `/design-review` filled the flow
with 23 agent findings, you start with `/design-address-all --max 10` to
tackle the obvious wins, then hand-pick the rest via `/design-address <id>`.

---

## How it talks to swarm-api

All operations go through swarm-api's `/api/v1/annotations` endpoints:

| Action | Request |
|---|---|
| List | `GET /annotations?app=...&flow=...&status=open` |
| Thread | `GET /annotations/<id>/thread` |
| Reply | `POST /annotations/<id>/replies` with `{ note }` |
| Status flip | `PATCH /annotations/<id>/status` with `{ status: "addressed" }` |

### Authenticating as Claude

Every request authenticates with the `Claude` agent bearer key stored at
`/apps/swarm/agents` in Infisical. Wrap each curl with `infisical run`
so the secret is injected at runtime — never write it to disk, never echo
it to logs:

```bash
infisical run \
  --projectId=1714e2f7-d947-45f8-8332-56017efbffb0 \
  --path=/apps/swarm/agents --env=production \
  -- bash -c 'curl -sS -H "Authorization: Bearer $SWARM_API_KEY" \
    "$SWARM_API_URL/api/v1/annotations?app=golf&status=open"'
```

The user owns the `infisical login` session — if `infisical run` errors
with "not logged in", the skill prints the fix (`infisical login`) and
stops. Don't fall back to the user's browser cookie.

### Marking replies as agent-authored

When this skill POSTs a reply or addresses an annotation, include
`origin: "agent:design-comments"` in the body. The inline-thread card
renders agent-origin rows as **Claude · design-comments** with a small
agent tag, distinct from human comments which show the email's local
part. Always identify which skill spoke.

---

## What the address-flow looks like in practice

User: "Let's go through the round-flow comments"

Me:
1. `/design-comments --app golf --flow round`
2. Print the table (12 open)
3. User: "address the first 5"
4. For each of 1-5:
   - Fetch thread
   - Read source file
   - Make the edit (Edit tool)
   - POST reply: "addressed — Bar height moved from 12px to 8px via token"
   - PATCH status → "addressed"
5. Print final state:
   ```
   Addressed 5 of 12. Remaining 7 — run /design-comments again or
   /design-address <id> for individual handling.
   Staged files:
     apps/golf/design/flows/round/sections/06-skins-light.tsx
     apps/golf/design/flows/round/sections/06-greenies-light.tsx
     packages/golf/ui/src/components/Bar/Bar.variants.ts
   Commit when ready.
   ```

---

## Skill composition

This is the workflow you run *after* `/design-review`. Typical loop:

```
/design-review --flow round       # agents file 23 findings
/design-comments --flow round     # see what landed
/design-address-all --max 10      # take the easy wins
/design-comments --flow round     # see what's left
/design-address <id>              # walk through manually
```

Per the CLAUDE.md design-annotations convention, all of this happens in
Claude Code — no separate CLI binary. The skill authenticates with the
shared **Claude** agent identity (`/apps/swarm/agents` in Infisical, see
the auth section above) and posts annotations with
`origin: "agent:design-comments"` so they're attributed to me rather than
the user's account.
