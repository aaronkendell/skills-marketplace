---
name: handoff-session
description: >
  Use when the user wants to switch tools mid-task — hand off the current or a prior session
  from Codex CLI to Claude Code, or from Claude Code to Codex — or asks "how do I turn this on
  in my Codex session", "continue this in Claude", "give me something to paste into the other
  tool", or "switch off and resume elsewhere". Produces a paste-ready handoff brief.
---

# Handoff Session

Emit a compact, paste-ready brief so the **other** agent tool can pick up an in-flight task
without re-reading the whole history. This is the write side of the bridge; `resume-session`
is the read side.

## Tool

```bash
BIN="${CLAUDE_PLUGIN_ROOT:-$CODEX_PLUGIN_ROOT}/bin/session-bridge"

# Brief for the other tool (auto-detects target: codex→claude, claude→codex):
python3 "$BIN" handoff <id>

# Force the target tool:
python3 "$BIN" handoff <id> --to codex
```

The brief includes: source tool + session id, cwd/branch, the original goal, the most recent
instructions, files the session touched, where it left off, and a "re-verify first" next step.

## Workflow

1. **Pick the session.** Usually the one the user just finished — `session-bridge list --cwd .`
   shows the newest first. Use its id.
2. **Generate the brief.** `session-bridge handoff <id>`.
3. **Deliver it the way the user asked:**
   - *Paste into a live session* → give them the brief to paste, plus how to start the other
     tool if needed.
   - *Fresh Codex run* → `codex exec --yolo "<brief>"` or `codex -a never --dangerously-bypass-approvals-and-sandbox "<brief>"`.
   - *Fresh Claude run* → start Claude Code in the same cwd and paste the brief as the first message.
4. **Always end the brief with a verification step** (the CLI already appends one): the target
   tool must check `git status` and re-read touched files before trusting any claim.

## Turning on shared plugins/skills in the other tool

A common handoff is "I added skills/plugins here — how do I use them in my other Codex/Claude session?"

- **Marketplace skills** (this repo) are shared: Codex reads `.codex-plugin/` manifests and
  `skills/`, Claude reads `.claude-plugin/`. After adding/enabling a plugin, the other tool
  needs a **reload** — a new session, or its plugin-refresh command — because both tools load
  plugins at startup, not mid-session.
- **Claude Code:** enable in `~/.claude/settings.json` → `enabledPlugins`, then start a new session.
- **Codex CLI:** add the marketplace (`codex ... marketplace add ~/repos/bokendell/skills-marketplace`)
  and reload; hooks live in each plugin's `hooks/hooks.json` and are honored once trusted.

## Notes

- Handing off is a workflow boundary — if `skill-watch` is active, this is a good moment to
  record the tool switch so the learning loop keeps the lineage across tools.
- Keep briefs honest: they summarize, they don't guarantee. The "re-verify" step is not optional.
