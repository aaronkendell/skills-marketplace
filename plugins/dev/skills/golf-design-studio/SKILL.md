---
name: golf-design-studio
description: >
  Compatibility alias for the name people still type. The golf design pack now lives in the
  golf repo at .claude/skills/design/SKILL.md and loads automatically there; the cross-app
  method lives in dev:design. This file only redirects.
---

# golf-design-studio → use `dev:design` + the repo's own pack

This skill no longer carries golf's design content. It exists so the remembered name still
resolves.

**Where the content went:**

| What | Where |
|---|---|
| Method (ground truth, exploration program, sketch conventions, mock-first) | `dev:design` |
| Golf brand, primitive catalog, studio workflow, fidelity anchors | `golf/.claude/skills/design/SKILL.md` — auto-loads in the golf repo |
| Tokens | `golf/DESIGN.md` — generated from `packages/tokens/src/theme-source.ts`, CI-diffed |
| Law | `golf/packages/ui/HARD-RULES.md` |

**Why it moved.** The pack used to live here, away from the code, and it drifted: every OKLch
value in the old `references/apps/golf.md` was wrong against the shipped tokens — `bg` listed as
`oklch(0.962 0.012 85)` against a shipped `oklch(0.956 0.013 87)`, the accent off by 0.06 chroma.
Anything designed off it was off-brand while looking correct. In the repo the pack is reviewed in
the same PR as the code it describes, and the token half is generated rather than transcribed.

**Do not add app content back here**, and do not create `<app>-design-studio` skills for new
apps — that scales linearly with apps and puts app truth back where it drifts. A new app needs
only its own `.claude/skills/design/SKILL.md` (plus a generated `DESIGN.md` where it has a
`theme-source.ts`). See the Studio Router section of `dev:design`.
