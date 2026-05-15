---
name: dev-research
description: >
  Use when the user asks for the dev research workflow to create PRDs, database designs,
  architecture docs, API specs, and UX mocks for a new feature or app. Triggers on
  `/dev research <app> <idea>` or when the user says "research this", "design this feature",
  "create a PRD", "brainstorm this idea". Combines codebase scanning, brainstorming dialogue,
  and design document generation into one phase.
disable-model-invocation: true
---

# Phase 1: Research

Deep research and design for a new feature or app. Outputs a complete design document with PRD, database design, architecture, API docs, and optionally UX mocks.

**This phase uses superpowers:brainstorming as its core workflow.** The brainstorming skill handles the iterative dialogue, approach exploration, and design document creation. This skill wraps it with app-specific context loading and Linear integration.

## Input

Parse `$ARGUMENTS`: first word is the **app name** (golf, portfolio, hive), rest is the **idea description**.

Can also start from:
- An existing Linear project (pass project name or URL)
- A pasted spec or requirements document

## Steps

### 1. Load App Context

1. Read `.claude/planner.local.md` for app config (team key, work path)
2. Read `docs/context/apps/<app>.md` for condensed app context
3. Read relevant pattern docs from `docs/context/patterns/`:
   - Always: `testing.md`
   - If backend: `ddd.md`, `api.md`
   - If frontend: `frontend.md`
   - If mobile: `mobile.md`
4. Read existing planning docs at `docs/apps/<app>/planning/` to understand what's already planned

### 2. Architecture Scan

Launch an architecture-scanner agent (from this plugin's `agents/` directory) to gather:
- Existing domain structure in `packages/<app>/domains/`
- Database schema in `packages/<app>/db/src/models/`
- API surface in `apps/<app>/api/src/`
- Recent git activity in the app's directories

### 3. Brainstorm

**Invoke `superpowers:brainstorming` via the Skill tool.**

Provide all context gathered in steps 1-2. The brainstorming skill will:
- Explore the user's intent through clarifying questions (one at a time)
- Propose 2-3 approaches with tradeoffs
- Design the solution collaboratively
- Present the design for approval

**For visual features:** Invoke the `design` skill (from this plugin). It's the unified orchestrator — it internally loads `taste-skill`, `ui-ux-pro-max`, `impeccable`, and the app-specific token files. Use `design` instead of calling those individually so the taste floor, token loading, and mock-first decision flow all fire correctly.

**MOCK-FIRST DECISION RULE (applies to every clarifying question during brainstorm):**

When the brainstorming skill is about to ask the user to pick between options, **build a visual comparison instead of asking a text question** whenever possible:

- **UI/layout/component choices** → HTML mock showcase with options side-by-side, styled with the real app tokens, realistic scenario data, Pro/Con annotations. Save to `docs/apps/<app>/planning/<initiative>/mocks/NN-<question-slug>.html`.
- **Backend / data-flow / schema / architecture choices** → Mermaid diagram (flowchart, sequence, ERD, or state diagram). Inline in the message or in a Mermaid-rendering HTML file. Show the options visually — which tables differ, which arrows flip, which nodes appear in A but not B.
- **Decision-tree / branching options** → comparison table matrix, not a prose list.
- **Only fall back to plain text questions when the decision is truly abstract** (tone, naming, yes/no confirms, priority ordering). Never for layout, color, component, data flow, schema, or flow ordering.

**Mock versioning and single persistent tunnel:** see the `design` skill's "Mock versioning + single persistent tunnel" section for the full rule. Summary:
1. Every iteration gets its own numbered file in the mocks folder (`NN-<question-slug>.html` / `NN-<question-slug>-v2.html` etc.) — never overwrite history.
2. Maintain a `current.html` in the same folder — always a copy of the newest iteration.
3. Start ONE tunnel per initiative serving `current.html`. On subsequent iterations, `cp <new>.html current.html` and tell the user to refresh the same URL. Do not start new tunnels.
4. Tear the tunnel down at the end of the decision session with `stop.sh <label>`.

After generating a mock, follow the "Sharing Mocks & Previews" rule from the `design` skill: ask the user if they want it opened locally, tunneled for phone review, both, or skipped. Do not default to any mode.

### 4. Generate Design Document

After brainstorming approval, create the design document. The document should include all sections relevant to the feature:

- **PRD** — Problem, solution, user stories, success criteria
- **Database Design** — New tables, columns, relationships, migrations
- **Architecture** — Domain structure, service boundaries, data flow
- **API Design** — New endpoints, request/response schemas, auth requirements
- **UX/UI** — Screen descriptions, interaction flows, component hierarchy (if visual)
- **Testing Strategy** — What tests are needed (unit, integration, E2E, performance)

### 5. Save Design Document

Save to: `docs/apps/<app>/planning/<initiative>/design.md`

Where `<initiative>` is derived from the feature name (kebab-case, e.g., `round-join-codes`, `ai-caddy-intelligence`).

If the initiative directory doesn't exist, create it.

### 6. Save Design Mocks

If the feature has visual/UI components, generate an HTML mock showcase and save it:
- `/tmp/design-mock-<initiative>.html` — for immediate browser preview
- `docs/apps/<app>/planning/<initiative>/design-showcase.html` — permanent record with the design doc

This file captures what was decided visually. It lives alongside design.md so future sessions have full context on both the written spec and the visual direction.

**After saving, ask the user how they want to review the mock — do NOT default to any option:**

> "Mock saved to `docs/apps/<app>/planning/<initiative>/design-showcase.html`. How do you want to review it?
> 1. **Open locally** in your desktop browser (`open <path>`) — fastest
> 2. **Host on a tunnel** so you can tap through it on your phone — uses `remote-preview` skill's `host.sh`, takes ~5 seconds to spin up, gives you a `*.trycloudflare.com` URL
> 3. **Both**
> 4. **Skip** — just continue the conversation
>
> What works for you?"

Only tunnel when the user explicitly asks for it. If they pick tunnel, invoke the remote-preview skill and run `bash .claude/skills/remote-preview/scripts/host.sh <path> <short-label>`. Remember to tear the tunnel down with `stop.sh <label>` before the final message in the turn where the review ends, unless the user says to leave it running.

### 7. Linear Integration (Optional)

Ask the user if they want to create a Linear initiative:
- If yes: use Linear MCP tools to create the initiative
- Link the design doc in the initiative description

### 7. Handoff

After saving, offer: "Design saved. Run `/dev plan <app> <initiative-path>` to break this into projects and issues."

## Templates

Reference templates in the `templates/` directory for consistent document structure:
- [prd-template.md](templates/prd-template.md) — PRD section structure
- [db-design-template.md](templates/db-design-template.md) — Database design format

## Rules

- NEVER skip the brainstorming dialogue. Even "simple" features benefit from exploration.
- ALWAYS load context patterns before brainstorming so the design aligns with existing architecture.
- ALWAYS read existing planning docs to avoid proposing something that's already planned or conflicts.
- The design document is the source of truth for all subsequent phases.
