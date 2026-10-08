# Agent tooling landscape — September 2026

Research date **2026-09-05**. Solo dev, two products (Bagman `aaronkendell/golf`, simrig `simrig-dev/*`),
many parallel agents, holds **Claude Max 20x** and **Cursor**, will not pay for additional memberships.

> **Revision note.** An earlier draft of this file said Warp was disqualified on economics. That was
> half wrong and is corrected here. Warp's *own agent* still can't use your Claude subscription — but
> **Claude Code running in a Warp tab logs into your Claude account normally and needs no Warp plan.**
> Warp Free is a real $0 option. The trade is no longer money; it is iOS automation and scriptability.

---

## The verdict, up front

**Switch to Warp for Bagman work if you want to — the data backs your instinct. Keep cmux installed for
simrig. Both are free. Run both.**

That is not a hedge, it's the shape of the problem: the two tools are strong at different things and
neither costs anything.

**Why Warp is a legitimate choice now, at $0:**

- Warp's docs: *"The first time you run Claude Code, it opens your browser for login"* — your normal
  Claude account OAuth, i.e. your Max 20x. *"Claude Code requires a paid plan or API credits"* refers to
  **Anthropic's** plan, not Warp's; **no Warp-specific plan is mentioned as necessary**
  ([Set up Claude Code](https://docs.warp.dev/guides/external-tools/how-to-set-up-claude-code/), 2026-09-03).
- Warp Free *"doesn't include bundled AI usage for the Warp Agent"* ([Pricing FAQs](https://docs.warp.dev/support-and-community/plans-and-billing/pricing-faqs/), 2026-09-04) — but that is Warp's *own* agent. The terminal, vertical tabs, tab configs, notifications and code review are terminal features, and Warp *"auto-detects Claude Code when you run it"* to layer them on ([Claude Code in Warp](https://docs.warp.dev/agent-platform/cli-agents/claude-code/), 2026-09-03).
- So: **use Warp as a shell, never touch Warp Agent, pay $0, keep your Max subscription funding everything.**

**And you're right that the vertical tabs are better.** Not marginally — Warp's are richer on every axis
(detail in Q1). cmux invented the pattern; Warp out-built it.

**The one thing Warp cannot do at all is iOS.** No simulator pane, no simulator automation, nothing.
cmux has a full iOS automation harness — taps, gestures, multitouch, hardware buttons, permissions,
camera, the accessibility tree, and Web Inspector attach. For simrig that is not a nice-to-have, it is
the product's subject matter.

**So: `cmux` for simrig and any iOS work. Warp for everything else, if you prefer it.** Two free apps,
each doing what it is best at. If that feels untidy, the tidy version is "stay on cmux" — but you told
me you prefer Warp's tabs, and you're not wrong, so don't fight it.

**The one caveat I have to flag honestly:** Warp's docs never state in writing that a third-party CLI
agent in a tab consumes zero Warp credits. Every piece of evidence says it does not (Claude Code
authenticates to Anthropic separately; Warp credits are scoped to Warp Agent conversations; Free is
described as lacking bundled usage *for the Warp Agent*). Confidence is high, but it is an inference,
not a quoted guarantee. Verify by running Claude Code in Warp Free for a day and watching the credit
counter — if it doesn't move, you're clear.

---

## Q1 — Warp vs cmux, local, in detail

### Vertical tabs: Warp wins, clearly

You asked me to look up the latest docs. Here they are
([Vertical Tabs](https://docs.warp.dev/terminal/windows/vertical-tabs/), last updated **2026-09-03**).

**Enable:** Settings → Appearance → Tabs → *"Use vertical tab layout"*.

**Every config knob:**

| Setting | Options | Default |
|---|---|---|
| View as | Panes or Tabs | Panes |
| Tab item | Focused session or Summary | Focused session |
| Density | Compact or Expanded | Compact |
| Pane title as | Command/Conversation, Working Directory, or Branch | Command/Conversation |
| Additional metadata | Branch, Working Directory, Command/Conversation | Branch |
| Show details on hover | On/Off | On |

**Metadata per row:** git branch for the pane's cwd, **active git worktree path**, agent status badge,
unread-activity dot. Expanded density adds **diff stats and pull-request badges**.

**Agent status badges:** magenta clock (in progress), green check (done), red triangle (error), gray stop
(cancelled), yellow stop (blocked). Third-party agents show their brand icon inside the pane icon
alongside the badge — so a Claude Code tab is visibly a Claude Code tab.

**Search:** filter tabs and panes *"by title, working directory, Git branch, PR label, or diff stats."*
That is the feature that matters at 10+ agents, and cmux has nothing equivalent.

**Hover sidecar:** floating card with full un-clipped paths, branch names and conversation titles; stays
open when you move into it.

**Tab groups** (shipped July 2026, #13230): named, collapsible, colour-customisable; **pin tabs and
groups** to keep them at the front (August 2026, #13767); double-click empty space for a new tab;
drag group headers to reorder, drag pane headers between groups; double-click a row to rename inline.

**cmux's equivalent:** vertical tabs showing git branch and notification status, workspace groups via
`--group`/`--group-placement`, `reorder-workspaces`, `rename-tab`. Functional, plainer. No PR badges, no
diff stats, no density modes, no metadata search, no hover sidecar.

**Verdict: Warp, and it isn't close.** Your preference is correct.

### Tab Configs — the feature that should actually sell you on Warp

This is the one I'd flag as most valuable for how you work, and the brief didn't mention it
([Tab Configs](https://docs.warp.dev/terminal/windows/tab-configs/), **2026-09-03**).

TOML files in `~/.warp/tab_configs/`. Schema:

- Top level: `name` (required), `title` (supports `{{param}}`), `color`
- Flat `[[panes]]` array; first entry is root. Leaf nodes: `id`, `type` (**`"terminal"`, `"agent"`, or
  `"cloud"`**), `directory`, `commands` (array, run in sequence, each waits for the previous),
  `shell`, `is_focused`. Split nodes: `split` (`"horizontal"`/`"vertical"`), `children` (≥2 ids)
- `[params.<name>]` prompts at launch: `type` of `"text"`, **`"branch"` (git picker)** or
  **`"repo"` (repository picker)**, plus `description` and `default`
- Special variable **`{{autogenerated_branch_name}}`** for unique worktree branches
- Launch from the `+` menu, right-click → "Save as new config", or the URI
  **`warp://tab_config/<name>`** (`?new_window=true` for a new window) — that URI is your scripting hook
- **New worktree config** in the `+` menu generates a worktree-based Tab Config for a chosen repo
  automatically ([Git worktrees](https://docs.warp.dev/code/git-worktrees/))
- Built-in `/skills` for **Create Tab Config** and **Update Tab Config** from natural language
- Limits: children in a split are equally sized (no flex), one `is_focused` per config, params limited
  to text/branch/repo

**Why this matters to you specifically:** you already run `swarm workspace dev` per worktree, with
branch-isolated Neon DBs and tunnels, and you have `.worktrees/qa` conventions. A Tab Config with a
`repo` param, `{{autogenerated_branch_name}}`, a split of `type = "agent"` and `type = "terminal"` panes,
and a `commands` array that runs your workspace bring-up, is a one-click version of a thing you currently
do by hand. It's TOML, so it's version-controllable. cmux's `new-workspace --layout <json> --command` can
approximate it, but there's no saved-config UI, no repo/branch pickers, no URI launcher.

### Everything else local, side by side

| | cmux | Warp |
|---|---|---|
| **Renderer** | libghostty, GPU | Rust, GPU |
| **Ghostty config reuse** | Yes — reads `~/.config/ghostty/config`; `cmux reload-config` reloads both | No |
| **Blocks / command output model** | Plain terminal | Warp's block model, sharable blocks, Warp Drive |
| **Notifications on agent finish** | Pane rings, sidebar badges, popovers, desktop; `cmux notify` for hooks | In-app + desktop; your local `settings.toml` already has `is_agent_task_completed_enabled`, `is_needs_attention_enabled`, `is_long_running_enabled` (30s) |
| **Code review / diff** | `cmux diff --source last-turn\|unstaged\|staged\|branch`, split or unified | **Code Review panel with inline comments sent back to the running agent** — better |
| **Agent dashboard** | Sidebar + `list-workspaces`, `surface-health`, `set-status`, `set-progress`, `todo` | **Agent Management Panel** across all tabs; hover conversation summaries |
| **Session resume / hibernation** | `agent-hibernation on\|off`; resume for 13 harnesses via `cmux hooks setup` | *"Codex and Claude Code agents now support local continuation"* (Aug 2026) |
| **Checkpoint / restore** | `restore <kind> <checkpoint-id>`, `restore --surface`, `restore-session`; layout, cwd, scrollback, browser history | Session restore; no per-surface checkpoint ids documented |
| **Project rules** | Whatever the agent reads | **Reads `WARP.md` and `AGENTS.md`** at project root (June 2026) |
| **MCP** | Whatever the agent reads | **Auto-discovers from `~/.claude.json`, `.mcp.json`, `.codex/config.toml`** — shares one set across Claude Code, Codex and Warp; approval gates on file-based MCP edits |
| **Rich input** | Terminal | Multi-line editor, `@` mentions, slash commands, **voice**, images |
| **Model routing** | n/a | Custom model routers (July 2026, #13052) — Warp Agent only |
| **Remote / mobile** | `remotes`, `ssh`/`mosh`/`ssh-tmux`; iOS app in TestFlight beta | **Remote Control** + Oz web app from any browser or phone |
| **Scriptable control plane** | **~150-command Unix socket CLI**: `read-screen`, `send`, `send-key`, `events --reconnect --cursor-file`, `rpc <method>`, `pipe-pane`, `wait-for`, `capture-pane`, `swap-pane`, `top`, `memory` | `warp://tab_config/<name>` URI; `oz` CLI (cloud only); Factory MCP. **No local pane-control API** |
| **Embedded browser** | **~40 subcommands**: `snapshot`, `click`, `fill`, `eval`, `wait`, `screenshot`, `cookies`, `storage`, `profiles`, `state save/load`, `addinitscript`, `react-grab`, `devtools`, `design-mode` | None |
| **iOS Simulator** | **Full harness (below)** | **None** |
| **Agent-drivable** | Ships `skills/cmux/SKILL.md` — Claude Code can drive cmux natively | Warp Agent has skills; no equivalent skill for driving Warp from Claude Code |
| **License / price** | GPL-3.0-or-later, free forever; Pro $40/mo annual ($50 monthly) only for Cloud VMs | Proprietary; Free tier sufficient for this use |

**Honest summary of "besides iOS, is Warp the same or better?"**

**Better in Warp:** vertical tabs (much), Tab Configs + worktree configs, code review with inline
comments routed back to the agent, agent management panel, rich input with voice, MCP auto-discovery
across tools, WARP.md/AGENTS.md rules, remote/mobile control, blocks and Warp Drive.

**Better in cmux:** the socket CLI (this is the big one), the automatable embedded browser, iOS
simulator panes, Ghostty config reuse, per-surface checkpoint/restore, `--source last-turn` diffs,
broader hibernation coverage, native `claude-teams`/`codex-teams`, open source.

**What you'd actually lose by switching:** the ability to script your terminal. If your dispatcher,
routines or QA lanes ever call `cmux read-screen`, `cmux send`, `cmux notify` or `cmux events`, those
have no Warp equivalent and would need rewriting. If they don't — if cmux is purely a UI for you — then
switching costs you nothing but the iOS panes.

---

## Q2 — How the iOS stuff works in cmux (and why Warp has no answer)

### cmux

A simulator is a **first-class surface type**, not a shell command. `cmux new-pane --type simulator`
(or `new-surface --type simulator`) puts an iOS Simulator inside a cmux pane, alongside your terminal
and browser panes in the same workspace.

Then two command families drive it. `cmux ios` is the pane-management layer:

```
cmux ios list [--workspace <ref>]        # Simulator panes + device identifiers
cmux ios context [--udid]                # the selected Simulator identity
cmux ios select <device-udid>            # bind a pane to an iPhone/iPad Simulator
cmux ios screenshot [--all] [--out <p>]  # capture one, or up to 8 Simulators at once
```

And `cmux simulator` is the **automation harness** — *"Every native `cmux simulator` subcommand is
accepted unchanged"* by `cmux ios`:

```
type [text] [--stdin|--file]        tap <x> <y> [x2 y2]        swipe <x1> <y1> <x2> <y2> [steps]
gesture <json>   # 1..256 ordered normalized touch events      multitouch <json>
button <name>    # hardware buttons                            rotate <orientation>
permissions <list|grant|revoke|reset>   camera <configure|switch|mirror|status>
accessibility    # bounded native accessibility tree           foreground   # foreground app
ca <diagnostic> <on|off>   memory-warning   event-log [limit]   ui [status|get|set]
targets | attach <target-id> | send <json> | highlight | release   # Web Inspector
```

*"Each command waits for its correlated Simulator-worker result"* — so it's synchronous and scriptable,
not fire-and-forget. Note what's in there: a **native accessibility tree**, **permission grant/revoke**,
**camera control**, **memory-warning simulation**, and a **Web Inspector attach** for debugging web
views. That is a QA harness, not a screenshot button.

**Why it matters to you:** this overlaps simrig's own surface almost exactly (`ios-screenshot-and-element-tree`,
`ios-use`, `ios-permissions`-shaped things, `ios-a11y-report`, `ios-devtools`). cmux gives you a **local,
free, offline** version of that in the same window as the agent driving it — no lease, no relay, no rig
budget. For iterating on a Bagman screen while a Claude Code agent edits it two panes over, that loop is
hard to beat.

### Warp

**Nothing.** No simulator surface, no simulator commands. Warp is a terminal, so you can obviously run
`xcrun simctl` in it like in any shell — but that's Terminal.app parity, not a feature. The only iOS
thing in Warp's orbit is a long-standing user request for a Warp *client* on iPhone
([warpdotdev/warp#6391](https://github.com/warpdotdev/warp/issues/6391)), which is the opposite thing.

**Nothing else in this entire landscape drives a simulator either** — not Cursor, Devin, Factory, Jules,
Copilot, Conductor, OpenHands. The exceptions are cmux, Claude Code (via the iOS Simulator MCP and via
simrig's own MCP), and simrig. That's the whole list. It is a genuine moat for simrig and the single
strongest reason to keep cmux on the machine regardless of what you use day to day.

---

## Q3 — Warp's software factory: how it actually works

Announced **2026-08-18** ([Warp blog](https://www.warp.dev/blog/open-infrastructure-for-building-a-software-factory);
[TechCrunch](https://techcrunch.com/2026/08/18/warps-new-system-is-an-out-of-the-box-software-factory-for-ai-development/)).
The mechanics, from the platform docs ([Oz Platform overview](https://docs.warp.dev/agent-platform/cloud-agents/platform/), **2026-09-03**):

**The loop is trigger → task → environment → harness → run → output.**

1. **Trigger** — *"a schedule, an integration event like a Slack mention or a CI failure, an API call, or
   a manual start."*
2. **Task** — a tracked record carrying context from the trigger through the whole run.
3. **Environment** — *"a Docker image with your toolchain, the repositories to clone, and setup commands."*
   Automated runs require one; interactive local runs use your machine.
4. **Host** — Warp-hosted infrastructure by default; self-hosted runners on Enterprise.
5. **Harness** — Warp Agent (default), **or Claude Code, or Codex**. Warp Agent is *"the only harness that
   can spawn cross-harness subagents."*
6. **Surface** — `oz agent run` from the CLI, an HTTP API (submit prompt, poll status, fetch results),
   Python and TypeScript SDKs, a **Factory MCP server** (built into Warp for logged-in users since
   August 2026), and the Oz web app for watching or steering a live run from a browser or phone.

Factories layers SDLC phases on top — triage, specification, implementation, review, verification — each
step optionally automated, with version-controlled factory definitions and "AI sovereign" deployment
(your inference, your hosting, Zero Data Retention).

**The catch, and it's fatal for you:** *"Third-party cloud agents, like Claude Code and Codex, call their
providers directly, so set up an Anthropic or OpenAI credential once before launching a third-party
harness"*, and *"Cloud runs of Claude Code and Codex always use Warp-managed secrets"*
([harness auth](https://docs.warp.dev/platform/harnesses/authentication/), 2026-09-03). **Cloud Claude
Code on Warp is API-key funded.** Your Max 20x does not reach it. The desktop BYOK story explicitly
*"applies to local agent runs only."*

**Pricing:** not public. Closed beta with *"$10k of factory use on us to get started"*, otherwise book a
demo. That is an enterprise motion.

**What it would replace for you:** your RemoteTrigger routines, the golf·qa-board routine, and the
dispatcher skill — which already do trigger → isolate → run → gate → report, on Claude Code cloud
sessions funded by your subscription, at $0. Factories adds governance you don't need (team secrets,
audit, ZDR, evals surface) and charges retail for inference you already own. **Skip it.**

---

## Q4 — Every cloud agent platform, as of today

### The table

| Platform | What it is | Price | Uses your Claude / Cursor sub? | Isolation | Headless | iOS |
|---|---|---|---|---|---|---|
| **Claude Code cloud sessions** | First-party async runs | Included in Max 20x | **Yes — it is the sub** | Cloud sandbox | Yes | Via MCP |
| **Cursor cloud agents** | Background agents from desktop/web/mobile/Slack/GitHub | Included in Pro $20 pool; Pro+ $60; Ultra $200 (buys $400 usage) | **Yes — draws your Cursor pool** | Isolated cloud VM | Yes | No |
| **Codex cloud** | OpenAI async runs | ChatGPT plan budget; credits $0.04 ea since 2026-04-02 | Yes, to a ChatGPT plan (you hold none) | Cloud sandbox | Yes | No |
| **Conductor** (conductor.build) | Parallel Claude Code / Codex / Cursor in isolated local workspaces, Mac-only | **Free** tier: *"Bring your own subscriptions and keys"*; Pro $50/mo adds cloud workspaces + API; Teams $60/user | **Yes, on the free tier** | Local workspaces (worktree-style) | Pro only (API) | No |
| **Sculptor** (Imbue) | Claude Code agents in local Docker containers | Free / OSS-ish | Yes — runs real Claude Code | Local Docker | Partial | No |
| **Namespace Devboxes** | Persistent cloud dev VMs for agents; Mac M5, Linux, Windows | **$0.004/Devbox Minute**: S(4vCPU/8GB) $0.24/hr, M $0.48, L $0.96, XL $1.92. Auto-shutdown after 15 min idle. Plans: Developer PAYG, Team $100/mo, Business $250/mo | **Compute only — bring any agent, so yes** | Dedicated VM per agent, egress filtering | Yes — SDK, CLI, SSH, GUI debug | **macOS instances exist** (see below) |
| **Runloop Devboxes** | microVM sandboxes, SWE-bench harness, snapshot branching | Suspend/resume gated behind **$250/mo** Pro | Compute only | microVM | Yes | No |
| **Fly Sprites** | Agent sandboxes with persistent filesystem (Jan 2026) | ~$0.083/vCPU-hr, $200 free credits; ~$10/mo for 3 boxes 8h×5d | Compute only | microVM, persistent FS | Yes | No |
| **Warp Oz / Factories** | Cloud agent orchestration + SDLC factory | Oz on Warp plans; Factories closed beta, $10k credit | **No — cloud harnesses use API keys** | Warp-hosted or self-hosted runners | Yes — CLI, API, SDK, MCP | No |
| **Devin** | Autonomous agent, own cloud | Core $20/mo + **$2.25/ACU**; Team $500/mo incl. 250 ACU @ $2.00 (1 ACU ≈ 15 min work) | No | Cloud VM (can run on Namespace Devboxes) | API | No |
| **Factory (Droids)** | Agent platform | Pro $20 (≈20M tokens), Plus $100, Max $200; overage **$2.70/1M** | No | Cloud + local | Yes (`droid` CLI) | No |
| **Jules** (Google) | Async agent | Free 15 tasks/day; Pro $10 (+$10 credits), Pro+ $39; Ultra tier ~$124.99 | To a Google sub only | Cloud VM | Limited | No |
| **Copilot coding agent** | GitHub-native agent | Usage-based since 2026-06-01: Pro $10 (+$15 cr), Pro+ $39 (+$70), Max $100 (+$200); 1 cr = $0.01 | To a GitHub sub only | **GitHub Actions runners** | Yes (GH API) | No |
| **OpenHands** | Open-source agentic dev env (ex-OpenDevin), SDK + CLI + web GUI + hosted cloud | OSS free, self-host; cloud paid | BYO key (not sub) | Your own sandbox | Yes | No |
| **Antigravity** (Google) | VM-model agent + CLI (GA 2026-05-19) | Google tiers | Google sub | Cloud VM | Yes | No |
| **Amp** (Sourcegraph) | CLI + IDE agent, "Deep mode" | Metered | No | Local/cloud | Yes | No |
| **Vibe Kanban** | Kanban board for agents | Free OSS — **Bloop shut down April 2026**, community-maintained, hosted cloud switched off | Yes (drives your CLIs) | Worktrees | Partial | No |
| **Terragon** | — | **Shut down January 2026** | — | — | — | — |

### The three that are actually worth your attention

**1. Conductor — the only real cmux/Warp alternative in this list, and it's free.**
*"Run parallel coding agents on your Mac"*, supporting **Claude Code, Codex and Cursor**, with the free
tier explicitly offering *"Run multiple coding agents in parallel"*, *"Local workspaces on your Mac"* and
**"Bring your own subscriptions and keys"** ([conductor.build/pricing](https://conductor.build/pricing)).
Reported strengths: isolated workspaces per agent and a strong diff-review flow with little ceremony.
Mac-only, which is fine for you. **Worth 20 minutes of trial** — it's the purpose-built version of what
you're using a terminal for. Its weakness versus both cmux and Warp is that it's an app, not a terminal:
you don't get your shell, your Ghostty config, or arbitrary panes. Pro ($50/mo) buys cloud workspaces and
an API — don't.

**2. Namespace Devboxes — the interesting one for simrig, and nobody has told you about it.**
`$0.004` per Devbox Minute, sizes S/M/L/XL at 1/2/4/8 minutes-per-minute, i.e. **$0.24–$1.92/hr**, with
**automatic shutdown after 15 minutes idle** ([namespace.so/pricing](https://namespace.so/pricing)). The
Developer tier is pure pay-as-you-go, no per-seat charge. It runs your own agents on its VMs — so your
Claude Max subscription funds the inference and Namespace only bills compute. Critically, the Devbox page
lists **Mac M5 instances and references iOS app building on macOS**
([namespace.so/devbox](https://namespace.so/devbox)). **That is a possible answer to simrig's host-Mac
problem** — the launchd-on-the-main-checkout recipe, the load-70 incident, the rationed mode. Rented
macOS that boots per lease and shuts down after 15 idle minutes is a different operating posture from one
Mac mini you must not overload. They also run GitHub Actions runner acceleration and Docker/BuildKit
caching, which touches your Actions-cost problem. **This is the one thing in the whole sweep I'd
genuinely investigate**, with a caveat: I did not verify macOS instance pricing, availability, or whether
simulators are usable on them. That needs a direct check before you plan anything around it.

**3. Fly Sprites — because you already run on Fly.** Persistent-filesystem agent sandboxes, ~$0.083/vCPU-hr,
$200 free credits, Linux only. Not needed today; the right thing to know about if you ever want cheap
disposable Linux hosts for Bagman workers or agent runs.

### Everything else, briefly

Devin, Factory, Jules, Copilot agent, Amp, Antigravity, OpenHands: all meter their own inference or bind
to a subscription you don't hold, none drive simulators, and none do anything your Claude Code + Cursor
pair can't. Vibe Kanban is orphaned (Bloop shut down April 2026); Terragon is dead (January 2026). The
sandbox vendors (Runloop, E2B, Daytona, Modal, Blaxel, Northflank) are compute, not agents — relevant
only if you outgrow Fly.

---

## Q5 — Your configs, templates, plugins and connectors: what actually ports

This is the question nobody's comparison table answers, and it's the one that decides real switching cost.

**The load-bearing fact: your investment is in Claude Code, not in a terminal.** 17 enabled plugins from
your own `bokendell-skills` marketplace, per-repo `.claude/skills/`, hooks, `CLAUDE.md`, feature-map,
workflows, routines. **All of that lives inside the `claude` binary.** Any host that runs the real binary
inherits 100% of it; any host that runs its *own* agent inherits 0%.

| Asset | cmux | Warp (as a shell) | Warp Agent | Conductor | Cloud platforms w/ own agent |
|---|---|---|---|---|---|
| Claude Code plugins + skills (17) | ✅ full | ✅ full | ❌ none | ✅ full | ❌ |
| `CLAUDE.md` / memory | ✅ | ✅ | ❌ (reads `WARP.md`/`AGENTS.md` instead) | ✅ | varies |
| `AGENTS.md` | ✅ via agent | ✅ **Warp reads it natively** (June 2026) | ✅ | ✅ | most read it |
| Hooks (`~/.claude/hooks/`, Xirp) | ✅ | ✅ | ❌ | ✅ | ❌ |
| MCP (`.mcp.json` simrig server) | ✅ via agent | ✅ **plus Warp auto-discovers `~/.claude.json`, `.mcp.json`, `.codex/config.toml`** | ✅ same discovery | ✅ | varies |
| Cursor `.cursor/` rules + skills | ✅ (Cursor separate) | ✅ | ❌ | ✅ (runs Cursor) | ❌ |
| Terminal config (Ghostty) | ✅ **reads `~/.config/ghostty/config`** | ❌ Warp has its own | ❌ | ❌ | ❌ |
| Layout / workspace templates | `new-workspace --layout <json> --command` | **Tab Configs TOML + worktree configs** | — | app-managed | — |

**Two real findings here.**

**Warp's MCP auto-discovery is better than cmux's story, and better than you'd expect.** It reads your
existing `~/.claude.json`, `.mcp.json` and `.codex/config.toml` so Claude Code, Codex and Warp share one
set of servers, and it puts **approval gates on file-based MCP edits** so an agent can't silently add a
server ([MCP docs](https://docs.warp.dev/agent-platform/capabilities/mcp/)). Your `golf/.mcp.json`
simrig server would just work in Warp. That's a genuine point in Warp's favour on the "connects all of
it" question.

**Warp reads `AGENTS.md` — which makes your stale one a bigger problem.** `golf/AGENTS.md` was last
modified **2026-05-15**, 27 lines; `golf/CLAUDE.md` was modified **2026-09-03**, 164 lines. AGENTS.md says
*"The canonical instructions are in CLAUDE.md"* but does not import it. Today that only misleads Cursor
agents (8 PRs and counting). **If you move to Warp, it becomes the file Warp's project rules load**, and
four-month-old instructions become your default context. Fix this before switching, not after.

### "Talking to each other" — how agents coordinate

Blunt answer: **there is no cross-vendor agent-to-agent protocol, and nothing in this landscape gives you
one.** What exists:

- **Within Claude Code:** agent teams (you have `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=true` set),
  subagents, `SendMessage`. Real coordination, single vendor.
- **cmux:** `claude-teams` / `codex-teams` launch teammate modes with native splits; the socket CLI plus
  `skills/cmux/SKILL.md` means **a Claude Code agent can drive cmux itself** — spawn panes, read other
  panes' screens with `read-screen`, send input with `send`, watch `events`. That is a homemade but real
  coordination substrate, and it's the most capable option here.
- **Warp:** Warp Agent can spawn **cross-harness subagents** — but only Warp Agent, i.e. metered. Third-party
  agents in tabs don't talk to each other. Code Review comments route back into the running agent, which is
  a nice human-in-the-loop channel, not agent-to-agent.
- **ACP** (Zed's Agent Client Protocol) standardises *editor → agent*, not *agent ↔ agent*. 50+ registered
  agents by late June 2026, native in Zed and JetBrains — but Cursor is not an ACP server, so it can't
  unify your stack anyway.
- **MCP** standardises what an agent can *reach*, not how agents coordinate. Different layer.

**So if inter-agent coordination matters, cmux's socket API is the only lever in this comparison**, and
switching to Warp gives it up. Whether that matters depends entirely on whether your dispatcher and
routines actually call it today — check before deciding.

---

## Q6 — My idea, concretely

**Run both. It costs $0 and each does what it's best at.**

1. **Make Warp your daily driver for Bagman** if the tabs are what you want. Settings → Appearance → Tabs →
   vertical layout, Density = **Expanded** (that's where PR badges and diff stats live), Additional
   metadata = Branch, Show details on hover = On.
2. **Never open Warp Agent.** Run `claude` in tabs. Warp auto-detects it and you get notifications, code
   review, status badges and the management panel for free. Watch the credit counter for a day to confirm
   it doesn't move.
3. **Build two or three Tab Configs** — one per worktree lane. `type = "agent"` pane + `type = "terminal"`
   pane, a `repo` param, `{{autogenerated_branch_name}}`, and a `commands` array that runs your workspace
   bring-up. Commit them. This is the highest-value thing in Warp for your workflow and it's ten minutes
   of work.
4. **Keep cmux, and reach for it for anything iOS.** simrig development, Bagman screen iteration against a
   simulator, QA passes. `cmux new-pane --type simulator`, then `cmux ios`/`cmux simulator` to drive it.
   Nothing else on this machine can do it.
5. **Before switching, grep your automation for `cmux `.** If your dispatcher, routines or QA lanes call
   `cmux read-screen`, `send`, `notify` or `events`, those break in Warp with no equivalent. If they don't,
   the switch is clean.
6. **Fix `golf/AGENTS.md` first** — Warp reads it, Cursor reads it, and it's four months stale.
7. **Try Conductor for 20 minutes.** Free, Mac-only, runs Claude Code + Codex + Cursor in parallel isolated
   workspaces on your own subscriptions. It may be a better shape than either terminal for the specific job
   of "supervise eight agents", and it costs nothing to find out.
8. **Look into Namespace Devboxes for simrig** — $0.24/hr S-size, 15-minute idle shutdown, macOS instances,
   pay-as-you-go with no seat fee. Verify the macOS/simulator story directly before planning on it.

**Do not buy:** Warp Build/Max/Business, Warp Factories, Conductor Pro, cmux Pro, Runloop, Factory,
Devin, Copilot Max. Every one of them charges you for inference or compute you already have.

**The two triggers that would change this answer:** Warp shipping a local control API or simulator panes
(then drop cmux entirely), or Anthropic permitting subscription auth in third-party clients (then the
whole metered tier of the market becomesworth reconsidering and the ranking reopens).

---

## Verified vs inferred

**Verified on this machine, 2026-09-05:** Claude **Max 20x** (`organizationType: claude_max`,
`organizationRateLimitTier: default_claude_max_20x`, `billingType: stripe_subscription`, since
2025-07-22; extra usage user-disabled; 10% of the 5h window, 29% of the 7d window; `limit_dollars: null`
— a time meter, not a currency meter). Claude Code native, 806 startups, `opus[1m]`, agent teams enabled,
17 plugins. **cmux 0.64.22**, stock `~/.config/cmux/cmux.json`; full CLI surface read from `cmux --help`,
`cmux ios --help`, `cmux simulator --help`, `cmux vm --help`, `cmux docs`. **Warp
0.2026.08.26.17.59.01**, `~/.warp/settings.toml` modified 2026-09-05 11:31, with agent execution profiles,
a shell/network command denylist, `computer_use = "never"`, and agent notifications enabled. **Cursor**
IDE present, `cursor-agent` **not** on PATH, `~/.cursor/cli-config.json` with allowlist approvals and
agent attribution on; 8 `origin/cursor/*` branches → golf PRs #74, 75, 76, 77, 78, 81, 82, 84.
`golf/AGENTS.md` dated 2026-05-15 (27 lines) vs `golf/CLAUDE.md` 2026-09-03 (164 lines).
`golf/.mcp.json` is **tracked** and registers the simrig HTTP MCP server — contradicting `golf/CLAUDE.md`,
which says MCP was removed by design.

**Inferred, not quoted:** that a third-party CLI agent running in a Warp tab consumes zero Warp credits.
Strongly supported (Claude Code authenticates to Anthropic by browser login; Warp Free lacks bundled usage
*for the Warp Agent*; no Warp plan is named as required) but **never stated outright in Warp's docs**.
Verify empirically. Also inferred: that Namespace macOS Devboxes can run iOS Simulators — the page
mentions Mac M5 instances and iOS app building, but simulator support and macOS pricing were not verified.

**Sources conflict on:** Warp BYOK availability (secondary reporting says paid-only from 2026-05-21; Warp's
docs say Free and all eligible paid plans for orgs ≤10 employees — trust the docs); whether Claude Code
reads `AGENTS.md` natively as of August 2026 (two sources disagree — use a bridge either way); the
opencode/Crush lineage (one source claims a rebrand under Charm, but cmux ships separate `omo` and `omx`
subcommands, implying two live projects).

---

## Sources

**Warp local** — [Vertical Tabs (2026-09-03)](https://docs.warp.dev/terminal/windows/vertical-tabs/) · [Tab Configs (2026-09-03)](https://docs.warp.dev/terminal/windows/tab-configs/) · [Git worktrees](https://docs.warp.dev/code/git-worktrees/) · [Claude Code in Warp (2026-09-03)](https://docs.warp.dev/agent-platform/cli-agents/claude-code/) · [Set up Claude Code (2026-09-03)](https://docs.warp.dev/guides/external-tools/how-to-set-up-claude-code/) · [Run multiple AI coding agents (2026-09-03)](https://docs.warp.dev/guides/agent-workflows/how-to-run-multiple-ai-coding-agents/) · [MCP](https://docs.warp.dev/agent-platform/capabilities/mcp/) · [Changelog 2026](https://docs.warp.dev/changelog/2026/) · [Universal Agent Support (2026-04-14)](https://www.warp.dev/blog/universal-agent-support-level-up-coding-agent-warp) · [Migrate to Warp from Claude Code](https://docs.warp.dev/getting-started/migrate-to-warp/migrate-to-warp-from-claude-code/)

**Warp money & cloud** — [Pricing](https://www.warp.dev/pricing) · [Pricing FAQs (2026-09-04)](https://docs.warp.dev/support-and-community/plans-and-billing/pricing-faqs/) · [BYOK (2026-09-03)](https://docs.warp.dev/support-and-community/plans-and-billing/bring-your-own-api-key/) · [Harness authentication (2026-09-03)](https://docs.warp.dev/platform/harnesses/authentication/) · [Oz platform overview (2026-09-03)](https://docs.warp.dev/agent-platform/cloud-agents/platform/) · [Warp Factories (2026-08-18)](https://www.warp.dev/blog/open-infrastructure-for-building-a-software-factory) · [TechCrunch on Factories](https://techcrunch.com/2026/08/18/warps-new-system-is-an-out-of-the-box-software-factory-for-ai-development/) · [iPhone support request #6391](https://github.com/warpdotdev/warp/issues/6391)

**cmux** — [Pricing](https://cmux.com/pricing) · [GitHub](https://github.com/manaflow-ai/cmux) · [Docs](https://cmux.com/docs/api) · local `cmux --help` / `ios` / `simulator` / `vm` / `docs`

**Orchestrators** — [Conductor](https://conductor.build) · [Conductor pricing](https://conductor.build/pricing) · [Best tools to run multiple coding agents (2026)](https://agentsroom.dev/blog/best-multi-agent-coding-tools) · [9 open-source agent orchestrators](https://www.augmentcode.com/tools/open-source-agent-orchestrators) · [Best multi-agent tools for Claude Code and Codex users](https://nimbalyst.com/blog/best-multi-agent-coding-tools-2026/) · [vibe-kanban alternatives](https://aq.dev/alternatives/vibe-kanban/)

**Cloud compute / devboxes** — [Namespace Devbox](https://namespace.so/devbox) · [Namespace pricing](https://namespace.so/pricing) · [Namespace: introducing Devboxes](https://namespace.so/blog/introducing-devboxes) · [Claude managed agents on Devboxes](https://namespace.so/blog/claude-managed-agents-on-devboxes) · [Devin on Devboxes](https://namespace.so/docs/devbox/devin) · [Best agent sandboxes (2026-08-27)](https://www.marktechpost.com/2026/08/27/best-agent-sandboxes-2026-cold-start-pricing-network-policy/) · [Northflank sandbox pricing](https://northflank.com/blog/ai-sandbox-pricing) · [Namespace alternatives](https://northflank.com/blog/namespace-alternatives)

**Agents & pricing** — [Cursor: $20 buys two usage pools](https://omidsaffari.com/blog/cursor-pricing) · [Cursor background agents](https://www.morphllm.com/cursor-background-agents) · [Codex pricing](https://uibakery.io/blog/openai-codex-pricing) · [Codex credits](https://help.openai.com/en/articles/12642688-using-credits-for-flexible-usage-in-chatgpt-freegopluspro) · [Factory Droid pricing](https://saastruecost.com/guides/factory-droid-pricing-decoded/) · [Devin pricing & rate limits](https://usagebar.com/blog/devin-pricing-and-rate-limits) · [Jules explained](https://www.morphllm.com/comparisons/jules-google-coding-agent) · [Copilot vs Jules 2026](https://vibecoding.app/compare/github-copilot-vs-google-jules) · [OpenHands: 9 best coding agents](https://www.openhands.dev/blog/best-coding-agents) · [Artificial Analysis coding agents](https://artificialanalysis.ai/agents/coding) · [Claude Code vs OpenCode (subscription block)](https://www.firecrawl.dev/blog/claude-code-vs-opencode) · [crush#457](https://github.com/charmbracelet/crush/issues/457)

**Protocols** — [Zed ACP](https://zed.dev/acp) · [ACP progress report](https://zed.dev/blog/acp-progress-report) · [ACP registry live](https://groundy.com/articles/acp-registry-is-live-zed-and-jetbrains-just-did-for-ai-agents-what-lsp-did/) · [AGENTS.md field guide 2026](https://www.iuriio.com/blog/posts/2026/05/agents-md-field-guide-2026)
