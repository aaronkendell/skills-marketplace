---
name: design-review
description: >
  Multi-agent taste review for a design flow. Composes
  `/design-verify` (structural / HARD-RULES evidence) with parallel passes
  through `/taste-skill`, `/impeccable:impeccable`, `/ui-ux-pro-max`, and
  `/huashu-design`. Each agent writes its findings to swarm-api as
  annotations tagged with its own author (`agent:taste`, `agent:impeccable`,
  `agent:ui-ux-pro-max`, `agent:huashu`). The pin layer's `agent` badge
  surfaces who said what. Triggers when the user says: "review the flow",
  "do a design review", "what would taste-skill say about this", "have
  impeccable polish-check it", or invokes `/design-review`.
---

# Design Review — Skill

The opinionated layer on top of `/design-verify`. Where verify finds
structural drift, review finds taste drift — proportions, hierarchy,
finishing, polish, UX heuristics.

This skill runs **four parallel sub-agents** (via the `Agent` tool, with
multiple invocations in a single response so they run concurrently). Each
agent gets the same evidence bundle and produces annotations attributed
to its author. An orchestrator pass dedupes near-duplicates and writes a
`REVIEW-<date>.md` summary at the flow root.

Build on top of `/design-verify` rather than re-capturing screenshots so
you only pay the playwright cost once per review.

## Required external skills (verify before spawning agents)

All four sub-agents come from upstream resources. See
`references/design-stack.md` for full details. Quick check:

```bash
ls ~/.claude/plugins/cache/bokendell-skills/taste/*/skills/ 2>/dev/null
ls ~/.claude/plugins/cache/impeccable/impeccable/*/         2>/dev/null
ls ~/.claude/plugins/cache/ui-ux-pro-max-skill/*/*/         2>/dev/null
ls ~/.claude/plugins/cache/bokendell-skills/huashu-design/*/ 2>/dev/null
```

If any returns nothing, **stop and ask the user to install** before
proceeding (install commands in `references/design-stack.md`). A review
with only 3 of 4 voices is fine *if* the user explicitly opts in; default
is fail-closed.

---

## On invocation, do these in order

1. **Run `/design-verify` first** — it captures the screenshot + DOM +
   computed-styles bundle into `.annotations/cache/<flow>/`. The review
   skill reads from there rather than re-driving playwright. Pass the
   `--no-write` flag (if/when verify gets one) to skip its own POST step
   when the only goal is to seed evidence for review.

2. **Spawn four sub-agents in parallel** via the `Agent` tool, all in
   the same response (so they run concurrently, not serially). Each
   agent gets:
   - The artboard's screenshot path + DOM dump path + computed styles
   - The flow's `decisions.md` + `meta.json`
   - `packages/ui/HARD-RULES.md`
   - The relevant tokens file
   - A focused prompt for the agent's specialty:

     **Taste agent** (`/taste-skill`)
       Voice: senior UI/UX engineer. Strict on typography (ban Open Sans /
       Inter overuse — always favor the tokens), motion principles, layout
       diversification (no grid soup, no centered-monoculture). Output: 3-7
       findings per artboard, terse one-liner each + suggested fix.

     **Impeccable agent** (`/impeccable:impeccable`)
       Voice: agency-grade finisher. Catches micro-issues — uneven
       spacing, off-tokens, missing micro-interactions, weak edges,
       overconfident defaults. Output: prioritized P0/P1/P2 list with the
       smallest possible diff per finding.

     **UX-pro agent** (`/ui-ux-pro-max`)
       Voice: heuristics + accessibility + color-system review. Output:
       accessibility issues (contrast, hit targets, focus rings),
       palette/font alignment with the brand, anti-patterns.

     **Huashu agent** (`/huashu-design`)
       Voice: HTML-native design philosophy reviewer. Runs the 5-dimension
       review (visual hierarchy, type system, color discipline, layout
       rhythm, motion). Strong opinions on prototype fidelity vs.
       implementation drift. Output: 5 dimensions × short verdict + 1-3
       concrete findings per dimension. Especially valuable when the
       flow involves slide-like or high-fidelity prototype-style mocks.

3. **Collect findings** from each agent. Each agent should return a JSON
   array of `{ artboard, component, nth, total, note, severity }`. The
   orchestrator (you) merges them.

4. **Dedupe** — when two agents flag the same issue (same artboard +
   component + nth), keep the higher-signal version (longer note, or
   merge them). Annotations get a `note` that names every agent who
   raised it: "[taste + impeccable] spacing inconsistent — should snap
   to 8-pt grid".

5. **POST annotations** to swarm-api as the shared `Claude` agent
   identity. Wrap every curl with `infisical run --path=/apps/swarm/agents`
   so the `SWARM_API_KEY` (`swarm_*` bearer) is injected from Infisical
   at runtime — never written to disk, never echoed. Each annotation
   carries `origin: "agent:<name>"` where `<name>` is one of `taste`,
   `impeccable`, `ui-ux-pro-max`, `huashu`,
   `impeccable`, `ui-ux-pro-max`, or `merged` for deduped findings. The
   inline-thread card renders agent-origin rows as
   **Claude · &lt;name&gt;** with a small agent tag, distinct from human
   comments which show the email's local part.

6. **Write a summary** to `apps/design/flows/<flow>/REVIEW-<date>.md`
   committing:
   - Total findings by agent
   - Top 10 prioritized by severity
   - Link to the swarm-api flow URL where every annotation lives
   This file gets committed to git so PR reviewers see the summary inline.

7. **Print the summary** to the terminal so the user knows what just
   happened.

---

## What this skill is and isn't

- **Is**: an orchestrator that uses Claude Code to run other skills + the
  `Agent` tool. No Anthropic SDK. Authentication into swarm-api uses the
  shared `Claude` agent bearer at `/apps/swarm/agents` in Infisical.
- **Is**: opinionated. The agents disagree on purpose — that's the value.
  The orchestrator surfaces the disagreement instead of papering over it.
- **Isn't**: a one-shot auto-fixer. Findings are advisory until a human
  (or `/design-address`) acts on them.
- **Isn't**: a continuous-integration check. It runs on demand. CI runs
  HARD-RULES lint + tests; this runs when you want taste pressure.

---

## Composing with `/design-address`

Once the agents have filled the flow with annotations, the next workflow
is to walk through them via `/design-comments` (which surfaces the inbox)
+ `/design-address` (which makes the fixes one at a time, replying to
each annotation with `status: addressed`).

Recommended cycle:
```
/design-review --flow round
/design-comments --app golf --status open    # see what landed
/design-address <id>                          # tackle one
/design-address-all --max 5                   # batch the rest
```

---

## Example invocation

User: "Review the round flow"

Me:
1. `/design-verify --flow round` to capture evidence
2. Spawn three Agent invocations (all in the same response):
   - taste-agent over each artboard's bundle
   - impeccable-agent over each artboard's bundle
   - ui-ux-pro-max over each artboard's bundle
3. Collect 27 findings (10 + 12 + 9, 4 dupes)
4. Merge into 23 unique annotations
5. POST all of them with `origin: "agent:<name>"`
6. Write `REVIEW-2026-05-11.md` to the flow root
7. Print:
   ```
   Review complete for round (3 agents, 23 findings)
     • taste:        8
     • impeccable:  11
     • ui-ux-pro-max: 8
     • merged:       4 (cross-agent agreement — likely P0)

   Top 5:
     1. [merged] sg-skins-light Bar — wrong color token
     2. [impeccable] sc-greenies-light spacing breaks the 8-pt grid
     ...
   Summary: apps/design/flows/round/REVIEW-2026-05-11.md
   Live threads: https://golf-design.vercel.app/flows/round/?pins=1
   ```
