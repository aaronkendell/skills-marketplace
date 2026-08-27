---
name: verify
description: >
  The verification loop for app changes — pick the cheapest check that would
  catch the change breaking, run it, and LOOK at the result. Covers the six
  lanes (unit, integration, api-e2e vs the live workspace, Maestro UI flows on
  an isolated simulator, guards/arch, and visual judgment via screenshots).
  Triggers when the user says "verify this", "prove it works", "run the
  verification loop", after any non-trivial app change, and ALWAYS before
  declaring a feature done.
---

# Verify — the loop, not the vibe

An unverified change is a guess. Every change gets the cheapest loop that
would actually catch it breaking; a bug found by a human earns a regression
test in the cheapest lane that would have caught it (docs/qa/README.md owns
the lane table). "It compiles" is not a lane.

## Pick the lane (cheapest that bites)

| The change is… | Run |
|---|---|
| Pure logic (utils, math, reducers) | co-located `*.test.ts` (`pnpm vitest run <file>`) |
| Service + DB (repos, transactions, Inngest logic) | `*.integration.test.ts` (Testcontainers) |
| Wire contract (authz, typed errors, response shape) | api-e2e spec in `packages/e2e/api` vs the LIVE qa workspace API |
| A user journey (taps, sheets, deep links, funnels) | Maestro flow in `packages/e2e/mobile/.maestro` on an ISOLATED sim |
| Layout / material / copy (anything eyes judge) | run it, screenshot it, LOOK at it (steps below) |
| Cross-cutting invariants | the guard tests (`apps/mobile/src/lib/arch/*.guard.test.ts`) + `check:architecture:changed` |

Static floor for EVERY batch: `turbo check-types` (affected filters) + `biome
check` + the guard tests. These are seconds; there is no excuse to skip them.

## api-e2e against the live workspace

- The qa workspace API serves on its allocated port (`.workspace.json`); specs
  read `packages/e2e/api/.env`.
- Mint throwaway ACTORS, never reuse fixed personas: `mintQaPlayers(n)` for
  parallel-safe users, or `mintQaAccount({ preset })` for entitlement states
  (`billing.free`, `billing.proPlus`, `onboarding.firstRun.*`, `friends.accepted`).
- Entitlement refusals are TYPED: assert code/status/data
  (`ENTITLEMENT_REQUIRED`, 402, `requiredEntitlements`), never just `.rejects`.

## Maestro on an isolated simulator (never the user's QA sims)

```bash
NEW=$(xcrun simctl create "QA-Maestro" "iPhone 17 Pro"); xcrun simctl boot $NEW
xcrun simctl install $NEW "$(xcrun simctl get_app_container <existing-sim-udid> <bundle-id> app)"
cd packages/e2e/mobile && maestro test --device $NEW \
  -e MAESTRO_APP_ID=<bundle-id> -e MAESTRO_APP_SCHEME=<scheme> \
  -e MAESTRO_LOGIN_EMAIL="<user>+mpqa-p4+e2e@dev.golf.test" \
  -e MAESTRO_TEST_ENV=development .maestro/regression/<flow>.yml
# afterwards: shut down + delete the sim, and DELETE any rounds/rows the flow
# created (creator = the minted account, created_at recent).
```

Hard-won rules (each cost a debugging loop on 2026-08-22):
- Flows anchor on TEST_IDS registry ids; `test-ids.guard.test.ts` closes the
  yml↔registry↔component loop — but only DEVICE runs prove an id survives to
  the native tree (primitives can accept-and-drop; ListRow and BottomSheet did).
- Maestro `text:` is FULL-string regex; iOS merges child labels — match
  `".*Name.*"`, and take strings from `inspect_screen`, never from a screenshot.
- Cold dev-client launches race overlays: reuse the hardened subflows
  (`dev-launcher-and-overlays`, `confirm-open-link`, backdrop-tap dismissals),
  `hideKeyboard` before tapping rows the keyboard covers, and wait out
  debounced searches with `extendedWaitUntil`.
- A brand-new workspace file can crash the app with "Property X doesn't
  exist" — that's Metro's stale module map, not the code: touch the file,
  refetch the bundle.
- One maestro at a time per machine: a second instance (CLI or MCP) steals the
  XCUITest driver mid-run.

## Look at it (the Opus lesson)

For anything visual, the loop is not complete until you have LOOKED:
`inspect_screen` for the truth of the tree, `take_screenshot`/`simctl io
screenshot` for the truth of the pixels, compare against the design law
(decisions.md, HARD-RULES, voice-and-copy) — then send the screenshot to the
user with the claim you're making about it.

## Done means

State what was run and what it proved, plainly: "flow X green end to end,
types 22/22, guards green, screenshot attached" — or the failure output,
unhedged. If a check was skipped, say which and why.
