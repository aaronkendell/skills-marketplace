# The self-hosted agent box — when a cloud session is not enough

Verified 2026-09-25. The recipe from the "self-host your cloud agents" video, reduced to
what a bokendell repo actually needs and ordered by cost. Claude Code cloud sessions already
give Docker, Postgres and Infisical (`scripts/cloud/claude-session.sh`); Anthropic Remote
Control already drives an always-on machine from a phone. Reach for a box only for the gaps:
persistence between runs, a browser with video, raw egress (cloudflared's port 7844 is
blocked in Claude cloud sessions), or free CI minutes.

## Tier 0 — no box: agent-browser in the existing cloud env

Add to the environment install script:

```bash
npm install -g agent-browser && agent-browser install --with-deps
```

Headless plus auto-Xvfb covers "open the app, test it, record a video". This is the whole
value of the video for web QA and costs nothing.

## Tier 1 — the Mac that already runs simrig

- **T3 Code** (MIT, https://github.com/pingdotgg/t3code): `curl -fsSL https://t3.codes/install.sh | sh`,
  then the desktop app and the iOS app. One control plane over Claude Code, Codex, Cursor
  and OpenCode, local and remote, with phone prompting. Self-hosted only; there is no
  hosted tier to pay for.
- **Tailscale** (free personal): install on the Mac and the laptop; T3 Code connects over
  the tailnet, no ports opened.
- **Self-hosted GitHub Actions runner**: repo Settings → Actions → Runners → New. Free
  minutes when the org's Actions billing is off. Label it `self-hosted, macOS` and target it
  only for jobs that do not need a clean Linux image.

## Tier 2 — a VPS (only when the Mac cannot stay on)

Hetzner shared vCPU in Ashburn or Hillsboro, roughly $5 to $30 a month (confirm on the
console; their marketing page hides the table). Ubuntu, Tailscale, the coding agent CLI,
`git clone`, agent-browser with `--with-deps`. XFCE is optional; `--headed` uses Xvfb.
Secrets via the Infisical machine identity, never pasted into the box. Treat it as
disposable: nothing lives only there.

## What none of this changes

Agent tokens. A box adds compute and persistence, not budget. The usage limits that ration
the simrig loop and Bagman QA are the same on a VPS.
