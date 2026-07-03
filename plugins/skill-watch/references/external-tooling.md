# External tooling: signals, not owners

Skill Watch owns bokendell standards (DDD/API/mobile/design). External projects are wired in
as **signals** or **gates** — never as the owner of our guidance. This file records which ones
we've evaluated and how they plug in.

## Adopted

### Ponytail — overbuild/debt pressure (signal)

- Source: `github:DietrichGebert/ponytail` (registered in the marketplace as `ponytail`).
- Role: a delete-list / "write only what the task needs" pressure. `dev-build` and `review`
  may run a Ponytail pass for simplification only, never architecture replacement.
- Skill Watch use: log an "overbuilt solution" event when Ponytail repeatedly flags the same
  pattern; promote a lesson only at the normal threshold.

### SkillSpector — skill/MCP security scanner (gate)

- Source: `github:nvidia/skillspector` (Python; runs as CLI or MCP server).
- Why: we install third-party skills (`ponytail`, `taste`, upstream design/expo/impeccable
  marketplaces) and vendor MCP servers (`mcp-pack`). Those execute with implicit trust.
  SkillSpector does static pattern + AST + OSV-dependency analysis (prompt injection, data
  exfil, privilege escalation, supply chain) and emits a 0–100 risk score.
- **Where it plugs in:**
  1. **Pre-install gate** — scan a skill/marketplace *before* adding it or bumping its pin.
     Run against a repo/URL/dir and read the verdict before `enabledPlugins` or `npx skills add`.
     ```bash
     # via uvx (no local install); confirm exact subcommand from the repo README on first use
     uvx --from git+https://github.com/nvidia/skillspector skillspector scan <path|url|repo>
     ```
  2. **CI check** — scan `~/repos/bokendell/skills-marketplace` on PR; SARIF output can gate merges.
     Use its baseline/suppression file so only *new* issues fail.
  3. **Skill Watch signal** — when a scan flags a skill we ship or depend on, record a
     `security` event so the finding is tracked alongside drift, not lost in tool output.
- Status: **planned**. Documented here as the security gate; not yet scripted. First use should
  verify the CLI surface (scan target flags, output formats: terminal/JSON/Markdown/SARIF) and,
  if it earns its keep, add a thin `bin/scan-skill` wrapper + a marketplace CI step.
- Scope guard: SkillSpector is defense-in-depth (it doesn't sandbox execution) and it does not
  understand bokendell standards. It gates *safety*; `dev`/`skill-watch` still own *correctness*.

## Evaluated — ideas only, not installed

### Loopy — agent-loop catalog (mine for ideas)

- Source: `github:Forward-Future/loopy` (`/loopy` skill + public loop catalog).
- Overlap: its bounded-passes + acceptance-check + debrief loop is close to what Skill Watch's
  promotion loop and the native `/loop` skill already do, so we do **not** install it.
- Ideas worth borrowing into Skill Watch:
  - **Debrief step** — after a run, summarize deviations and recommend a concrete skill edit
    (maps onto our Stop-hook promotion).
  - **Acceptance checks** — make "did the skill fire / did tests run / was it verified" explicit
    pass/fail criteria rather than soft signals.
  - **Discover** — mining recurring work patterns in a repo to propose new loops mirrors our
    "3 similar deviations → promote" recurrence detection.

### pskoett self-improvement (architecture reference)

- The learning-loop pattern (`.learnings/`, recurrence thresholds, promotion to skills/AGENTS.md,
  hook-based reminders) is the architectural basis for Skill Watch. See `learning-loop.md`.
