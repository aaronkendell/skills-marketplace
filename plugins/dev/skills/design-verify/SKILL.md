---
name: design-verify
description: >
  Visual verifier for design studios. Captures rendered screenshots + DOM
  + computed styles per artboard via the playwright-cli skill, then audits
  each one against the flow's `decisions.md`, `packages/ui/HARD-RULES.md`,
  and the design tokens. Findings POST to swarm-api as annotations tagged
  `origin: "agent:verify"`. Triggers when the user says: "verify the
  studio", "check this flow's design", "run the visual verifier", "make
  sure the artboards match my decisions", or invokes `/design verify`.
  Use INSIDE Claude Code only — it authenticates as the shared `Claude`
  agent identity (`/apps/swarm/agents` in Infisical) so findings are
  attributed to the agent persona, not the user.
---

# Design Verify — Skill

Visual-fidelity check across an app's design studio. The output is a set of
annotations attached to specific artboards (visible in the studio's pin
layer + via `swarm-api`'s `/v1/annotations` API).

This is the **first half** of the agentic review loop. `design-verify` is
the *evidence gatherer*: it produces screenshots + DOM context + structural
checks. `design-review` (the F′ skill) composes verify with `/taste-skill`,
`/impeccable:impeccable`, and `/ui-ux-pro-max` for opinionated taste passes.

---

## On invocation, do these in order

1. **Resolve target flow + app.** Required args: an app (`golf` / `hive` /
   `portfolio`) and a flow slug. If the user didn't supply one, list the
   available flows under `apps/design/flows/` and ask.

2. **Authenticate as `Claude` (agent identity).** Every request wraps
   in `infisical run --path=/apps/swarm/agents -- ...` so the
   `SWARM_API_KEY` (`swarm_*` bearer) and `SWARM_API_URL` are injected
   at runtime. Never hard-code the key, never write it to disk, never
   echo it to logs. If `infisical run` reports "not logged in", surface
   `infisical login` and stop. Health check:
   ```bash
   infisical run \
     --projectId=1714e2f7-d947-45f8-8332-56017efbffb0 \
     --path=/apps/swarm/agents --env=production \
     -- bash -c 'curl -fsS "$SWARM_API_URL/api/v1/health"'
   ```

3. **Boot the studio dev server if it isn't already.** Run
   `pnpm --filter @bokendell/<app>-design dev` in background unless the
   flow URL already responds with 200. Wait for ready.

4. **Use the `playwright-cli` skill** to drive a headless browser through
   the flow URL. Per artboard discovered via `[data-dc-slot]`:
   - Capture a full-page screenshot pinned to the artboard's bounding box
   - Dump the artboard's inner HTML
   - Dump computed styles for the root + first N children (depth 3)
   - Save into `apps/design/.annotations/cache/<flow>/<artboard>.{png,html,styles.json}`
     (`.annotations/cache/` is gitignored — these are agent artifacts)

5. **Read the flow's intent** so findings land scoped to the design brief:
   - `apps/design/flows/<flow>/decisions.md`
   - `apps/design/flows/<flow>/meta.json`
   - `packages/ui/HARD-RULES.md`
   - `packages/ui/.impeccable.md` (if present)
   - The flow's `main.tsx` — only the artboard definitions (skip imports)

6. **Audit each artboard.** For each one, hold the screenshot + DOM +
   computed styles + decisions.md alongside the catalog of issues to look
   for:
   - HARD-RULES violations (hex outside tokens, banned fonts, glass over
     solid, etc.)
   - Tokens vs raw values — surface any computed style that doesn't map
     to a known token
   - Primitive misuse — clickable text not in a Button, headings not in
     Text scale-XL, etc.
   - Decision drift — anything in `decisions.md` that the artboard
     contradicts
   - Visual-only issues that need a screenshot to see — spacing balance,
     hierarchy, hit-target sizes, color contrast

7. **File findings as annotations.** For each issue, POST to
   `${swarmApiUrl}/api/v1/annotations` with:
   ```
   {
     "app": "<app>", "flow": "<flow>", "artboard": "<slot-id>",
     "component": "<primitive-name | screen>",
     "nth": <0 if screen-level>, "total": 1,
     "note": "<finding text + suggested fix>",
     "origin": "agent:verify"
   }
   ```
   Include the data-component handle + nth/total when the issue is on a
   specific primitive (so the studio's pin can anchor it).

8. **Summarize.** Print a table grouped by artboard with finding counts
   by severity. Link each row to the swarm-api annotation URL so the user
   can jump straight to the thread in the studio.

---

## Trade-offs the skill makes

- **Screenshot vs DOM**: the agent should pick per-finding. Structural checks
  (right primitive? right token?) read the DOM; visual checks (does it
  *look* right?) read the screenshot. Never burn vision tokens on a finding
  the DOM can answer.
- **Every endpoint requires the agent bearer**: reads and writes both go
  through `Authorization: Bearer $SWARM_API_KEY` (the public-read model
  was retired). The bearer is injected by `infisical run` per step 2 — the
  skill never touches the value directly.
- **No CLI fallback**: this skill does NOT call the Anthropic SDK. It is
  invoked from Claude Code, authenticates as the shared `Claude` agent
  identity, and orchestrates `playwright-cli` + sub-agents via the
  `Agent` tool. Same primitives the rest of the dev plugin uses.

---

## Skipping work

- If `decisions.md` is missing, surface that as a finding ("no decisions
  doc — add one") and continue against HARD-RULES only.
- If the studio dev server can't boot (port collision, etc.), fall back
  to the deployed Vercel preview URL if `VITE_VERCEL_ENV=preview`. Don't
  fail loudly — designers can always re-run.
- Skip artboards whose `data-dc-slot` is missing from the rendered output
  (the section may be hidden, or the flow may be mid-edit). Note them in
  the summary as "not captured".

---

## Composing with `/design-review`

The F′ review skill calls this one first to get the artifact bundle, then
fans out parallel sub-agents (`/taste-skill`, `/impeccable:impeccable`,
`/ui-ux-pro-max`) over the same bundle. Each writes annotations with their
own author tag. The pin layer's `agent:` badge surfaces who said what.

When invoked alone, `design-verify` is the structural-correctness pass.
Pair it with `design-review` when you want opinionated taste review on top.

---

## Example invocation

User: "Verify the round flow"

Me:
1. `swarm-api` health → ok
2. Boot golf-design dev → port 5173 ready
3. Discover artboards: `sg-skins-light`, `sg-skins-dark`, `sc-greenies-light`,
   ...
4. Per artboard: playwright captures → cache dir populated
5. Read `decisions.md` + HARD-RULES
6. Audit: 12 findings, 3 errors, 9 warns
7. POST 12 annotations with `origin: "agent:verify"`
8. Print summary table:
   ```
   sg-skins-light       4 findings (1E, 3W)
   sg-skins-dark        2 findings (0E, 2W)
   sc-greenies-light    6 findings (2E, 4W)
   ```
9. Tell the user to open the studio → switch to the round flow → pins
   appear. Click each red dot to see the thread + agent finding.
