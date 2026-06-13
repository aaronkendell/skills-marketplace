---
name: dev-build
description: >
  Use when the user asks for the dev build workflow to implement a feature from a Linear issue
  with full TDD, automated testing, code review, and verification. Triggers on
  `/dev build <LINEAR-ID>` or `/dev build <issue-path>` or when the user says "build this",
  "implement this issue", "start coding GOLF-123". Full lifecycle: branch, worktree, context
  loading, TDD, API/web testing, 2 code review rounds, lefthook checks, stage files.
disable-model-invocation: true
---

# Phase 3: Build

Full implementation lifecycle for a single Linear issue: branch, implement with TDD, test, review, verify, stage.

## Input

Parse `$ARGUMENTS`:
- A **Linear issue ID** (e.g., `GOLF-123`, `PORT-42`, `AGENTS-15`) — starts with letters, dash, numbers
- OR a **local file path** to an issue spec (e.g., `docs/planning/.../issues/GOLF-123.md`)

## Steps

### Step 0: Resolve Issue and Load Context

1. **Derive the app** from the issue ID prefix (GOLF → golf, PORT → portfolio, AGENTS → hive)
2. **Fetch the Linear issue** using Linear MCP tools (`get_issue`)
3. **Find local issue file**: search `docs/planning/` for a file with `linear_id: <ID>` in frontmatter
4. **Find existing plan**: look for `<ID>-plan.md` alongside the issue file
5. **Read the parent project README** (navigate up from `issues/` directory)
6. **Load ALL context patterns** from the marketplace pattern docs (resolve via the context-patterns skill: `${CLAUDE_PLUGIN_ROOT}/../../references/patterns/`):
   - `ddd.md` — DDD service/repository patterns (ALWAYS for backend)
   - `testing.md` — test types, Testcontainers, factories (ALWAYS)
   - `api.md` — Hono, tRPC, OpenAPI patterns (if API changes)
   - `frontend.md` — component patterns (if web frontend changes)
   - `mobile.md` — Expo, RN, hooks/stores/containers (if mobile changes)
7. **Update Linear status** to "In Progress"

### Step 1: Branch and Worktree

1. **Create a branch** following Linear naming convention:
   ```bash
   git checkout -b bokendell/<issue-id-kebab-title>
   ```
   Use the `gitBranchName` field from the Linear issue if available.

2. **Create a worktree** using `superpowers:using-git-worktrees` for isolation.

3. **Check for an active workspace** (optional — recommended for multi-session work):
   ```bash
   cat .workspace.json 2>/dev/null || echo "No workspace found"
   ```
   If `.workspace.json` exists, workspace URLs and DATABASE_URL are already configured via `.env.workspace`.
   If not in a workspace, use `pnpm swarm workspace create <name> --project <project> --path $(pwd)` to create one.
   When a workspace is active:
   - Use tunnel URLs (e.g., `https://golf-api-ws1.dev.bokendell.com`) instead of `http://localhost:<port>` in test commands
   - DATABASE_URL in `.env.workspace` points to an isolated Neon branch — safe to run migrations

4. **Start dev servers** if the feature requires API or UI testing:
   ```bash
   # For API changes
   turbo dev --filter='@bokendell/<app>-api'
   
   # For admin/web changes  
   turbo dev --filter='@bokendell/<app>-admin'
   ```
   Note the port numbers for testing.

### Step 2: Write Implementation Plan

If no plan exists (`<ID>-plan.md`):

1. **Launch exploration agents** in parallel to understand the codebase:
   - Agent 1: Domain & pattern analysis (find closest existing implementation, note patterns)
   - Agent 2: Integration points (files to modify, test infrastructure, E2E/perf gaps)

2. **Invoke `superpowers:writing-plans`** with all context from Step 0 and exploration findings.

3. **Save plan** to `docs/planning/.../<ID>-plan.md`

4. **Confirm plan with user** before proceeding.

**MOCK-FIRST DECISION RULE (applies to any plan-time decision):** If the plan has multiple viable approaches — different data flows, different schema shapes, different component decompositions, different flow orderings — present them as a **Mermaid diagram comparison**, not a prose list. For UI plan decisions (what screens, what components, what layout), generate an HTML mock comparison. Visual beats prose for anything with structure. Fall back to plain text only for truly abstract decisions (tone, naming, priority). See the `design` skill's "Mock-First Decisions" section for the full rule.

If a plan already exists, present it and ask: "Use this plan, or create a new one?"

### Step 3: TDD Implementation

**Invoke `superpowers:subagent-driven-development`** (recommended) or `superpowers:executing-plans`.

Each subagent MUST receive in its prompt:
- The relevant context patterns (ddd.md, testing.md, etc.)
- The issue spec and acceptance criteria
- The testing checklist from the issue

**Per-task cycle:**
1. Write failing test
2. Verify it fails
3. Implement minimal code
4. Verify test passes
5. Run type check: `pnpm check-types`
6. Run lint: `pnpm check`

**Rules for subagents:**
- Only `git add` files. NEVER `git commit`.
- Load context patterns before writing any code.
- Follow DDD patterns from the marketplace `ddd.md` (resolve via the context-patterns skill) for all backend code.
- Follow mobile patterns from the marketplace `mobile.md` (resolve via the context-patterns skill) for all mobile code.

### Step 4: Testing

After implementation, run the testing checklist from the issue spec:

**Automated tests:**
```bash
# Unit + integration tests
TEST_DB=true turbo test --filter='@bokendell/<affected-workspaces>'

# Type check
pnpm check-types

# Lint
pnpm check
```

**API testing** (if feature adds/modifies endpoints):
```bash
# Use stored API credentials
# Golf API
curl -s "$GOLF_API_URL/api/v1/<endpoint>" -H "Authorization: Bearer $GOLF_API_KEY" | jq .

# Portfolio API
curl -s "$PORTFOLIO_API_URL/api/v1/<endpoint>" -H "Authorization: Bearer $PORTFOLIO_API_KEY" | jq .

# Hive API
curl -s "$HIVE_API_URL/api/v1/<endpoint>" -H "Authorization: Bearer $HIVE_API_KEY" | jq .
```

**Web UI testing** (if feature changes admin/web app):
```bash
# Use playwright-cli for screenshots and verification
playwright-cli open <admin-url>
playwright-cli screenshot
playwright-cli snapshot
```

**Mobile testing:**
Mobile UI changes go on the **manual verification checklist**. Include specific screens to check, flows to test, and what to look for.

### Step 5: Code Review (2 rounds)

**Round 1: Spec + Standards Compliance**

Dispatch a patterns-reviewer agent (from this plugin's `agents/` directory) with:
- The full diff (`git diff`)
- The issue spec and acceptance criteria
- ALL context patterns (ddd.md, testing.md, api.md, frontend.md, mobile.md)

The reviewer checks:
- Does implementation match the issue spec and acceptance criteria?
- Does it follow DDD patterns (service layer, repository, mapper, no cross-domain repo access)?
- Does it follow testing patterns (correct test types, factories, test DB)?
- Does it follow API patterns (tRPC, OpenAPI, error handling)?
- Does it follow mobile patterns (hooks/stores/containers split, form hooks, Zustand)?
- **If the diff touches UI/mobile:** invoke the `design` skill (from this plugin) for compliance — it loads `taste-skill`, app tokens, the anti-pattern checklist, and app-specific reference rules. Check against the tiered component architecture, three-voice typography, OKLch tokens, and motion/haptic rules.

Fix all Critical and Important findings.

**Round 2: Code Quality + Edge Cases**

Dispatch a second review checking:
- Logic errors, null handling, off-by-one
- Security (injection, XSS, auth bypass)
- Performance (N+1 queries, missing indexes)
- Edge cases not in the spec

Fix all Critical findings. Important findings are at user's discretion.

### Step 6: Verification

**Invoke `superpowers:verification-before-completion`.**

Run ALL verification commands and check output:
```bash
# Lefthook pre-commit checks
pnpm turbo check-types --affected
pnpm check:fix

# Lefthook pre-push checks
TEST_DB=true pnpm turbo test --affected
pnpm check:architecture --changed
```

If any check fails, fix and re-verify. Do not declare ready until all pass.

### Step 7: Stage and Report

1. **Stage all changed files** (`git add`). NEVER commit.

2. **Generate manual verification checklist** — things the AI cannot verify:
   - Mobile: "Open the app, navigate to X, tap Y, verify Z"
   - Visual: "Check that the scorecard looks correct for a 9-hole round"
   - Real device: "Test on iPhone simulator with Expo Go"
   - Network: "Test with airplane mode, verify offline behavior"

3. **Update Linear issue** — add a comment with:
   - Files changed
   - Tests added
   - Testing checklist results (which passed, which need manual verification)

4. **Present to user:**
   ```
   All automated checks pass. Files staged (not committed).

   Manual verification needed:
   - [ ] Check 1
   - [ ] Check 2

   Run `/dev ship` when ready to commit and create PR.
   ```

## API Credentials

API credentials are stored as environment variables. The build phase reads them from the shell environment. The user should have these set:

- `GOLF_API_URL`, `GOLF_API_KEY`
- `PORTFOLIO_API_URL`, `PORTFOLIO_API_KEY`
- `HIVE_API_URL`, `HIVE_API_KEY`
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` (for playwright-cli web testing)

## Rules

- NEVER commit. Only `git add`.
- ALWAYS load context patterns before writing code or reviewing.
- ALWAYS run verification commands and check output before declaring ready.
- ALWAYS present a manual verification checklist for things AI can't test.
- 2 code review rounds are mandatory, not optional.
- Subagents MUST receive context patterns in their prompts.
- Testing checklist from the issue spec MUST be executed, not skipped.
