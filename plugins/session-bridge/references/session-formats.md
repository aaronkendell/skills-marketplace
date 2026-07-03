# Session file formats

Reference for extending `bin/session-bridge`. Both tools persist the full conversation as
line-delimited JSON on disk.

## Codex CLI

Path: `~/.codex/sessions/YYYY/MM/DD/rollout-<ISO-ts>-<uuid>.jsonl`

Record types (top-level `type`):

| type | meaning |
|---|---|
| `session_meta` | first line; `payload` has `id`, `cwd`, `timestamp`, `git.branch`, `git.commit_hash` |
| `response_item` | a message or tool call; `payload.role` = `user`/`assistant`, `payload.content[]` blocks with `type` `input_text`/`output_text` and `.text`; tool calls have `payload.type == "function_call"` with `name` + `arguments` (JSON string) |
| `event_msg` | UI/stream events (mostly ignorable for summaries) |
| `turn_context` | per-turn context snapshot |
| `compacted` | a compaction summary; `payload.replacement_history` holds the pre-compaction messages |

Shell commands: `function_call` where `name == "shell"`, `arguments.command` (string or array).
File edits: `function_call` whose name matches write/edit/patch/apply, path in `arguments.path`/`file_path`.

## Claude Code

Path: `~/.claude/projects/<slug-cwd>/<uuid>.jsonl` — one file per session; the uuid is the
session id. `<slug-cwd>` is the absolute cwd with `/` and `.` replaced by `-`.

Record types (top-level `type`): `user`, `assistant`, `system`, plus harness bookkeeping
(`last-prompt`, `mode`, `permission-mode`, `bridge-session`, `attachment`, `file-history-snapshot`,
`ai-title`). Each `user`/`assistant` record carries top-level `cwd`, `sessionId`, `gitBranch`,
`timestamp`, and a `message` dict:

- `user`: `message.content` is a **string** (or a list of blocks for tool results).
- `assistant`: `message.content` is a **list** of blocks — `{type:"text", text}` and
  `{type:"tool_use", name, input}`.

Shell commands: `tool_use` with `name == "Bash"`, `input.command`.
File edits: `tool_use` with name `Write`/`Edit`/`MultiEdit`/`NotebookEdit`, path in
`input.file_path` (or `input.notebook_path`).

## Noise filtering

Both tools inject non-conversational first-user content (AGENTS.md / CLAUDE.md instructions,
`<environment_context>`, `<system-reminder>`, permission blocks). The CLI skips messages that
start with `<`, `# AGENTS.md`, or contain `<INSTRUCTIONS>` / `<environment_context>` /
`<system-reminder>` in their head so the "opening request" is the real first prompt.
