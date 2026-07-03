---
name: resume-session
description: >
  Use when the user wants to resume, pick up, inspect, look at, or continue a previous
  agent session — either a Codex CLI session or a Claude Code session — or asks "where did
  I leave off", "what was that other session doing", "continue where Codex/Claude stopped",
  or references a session id / rollout file. Works in both directions (Codex↔Claude Code).
---

# Resume Session

Read and continue a prior agent session from **either** tool. The same conversation
history exists on disk for both Codex CLI and Claude Code; this skill parses it so you can
pick up with full context instead of starting cold.

## Tool

A single stdlib-only Python CLI ships at `${CLAUDE_PLUGIN_ROOT:-$CODEX_PLUGIN_ROOT}/bin/session-bridge`
(no pnpm/tsx needed — runs from any repo). Prefer it over hand-parsing JSONL.

```bash
BIN="${CLAUDE_PLUGIN_ROOT:-$CODEX_PLUGIN_ROOT}/bin/session-bridge"

# What sessions exist here, newest first, both tools:
python3 "$BIN" list --cwd . --limit 15

# Summarize one (id / uuid / filename fragment / path). Shows opening goal,
# recent user turns, files touched, shell commands, and where it left off:
python3 "$BIN" read <id>

# Full conversation instead of a summary:
python3 "$BIN" read <id> --transcript

# Machine-readable:
python3 "$BIN" read <id> --json
```

## Where sessions live

- **Codex:** `~/.codex/sessions/YYYY/MM/DD/rollout-<ts>-<uuid>.jsonl`
- **Claude Code:** `~/.claude/projects/<slug-cwd>/<uuid>.jsonl` (one file per session)

See `references/session-formats.md` for the record shapes if the CLI ever needs extending.

## Workflow

1. **Locate.** `session-bridge list --cwd .` to find the session (or take an id the user gives).
2. **Read.** `session-bridge read <id>` for the summary; add `--transcript` if you need detail.
3. **Verify before trusting.** The transcript reflects what was true *when written*. Run
   `git status`, and re-read any file the summary says was changed — the working tree may
   have moved on. Treat prior claims as leads, not facts.
4. **Continue.** Resume the unfinished thread using the current repo state.

## Cross-tool notes

- Matching is fuzzy: an id, a uuid, or a unique filename fragment all resolve. Codex ids look
  like `019f1437-…`; Claude ids are the transcript uuid.
- To move *to* the other tool instead of just reading, use the **`handoff-session`** skill,
  which emits a paste-ready brief.
- If `skill-watch` is active, resuming another tool's session is exactly the kind of workflow
  boundary worth a note — record which session you resumed so drift analysis has the lineage.
