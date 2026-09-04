---
name: app-store
description: App Store Connect as code for any bokendell mobile app. Use when touching store metadata, screenshots, TestFlight, review submission or a mobile release; it names the folder, scripts, secrets and workflow every app shares, and defers the command detail to asc-cli's own skills.
---

# App Store as code

The tool is [asc](https://github.com/rudrankriyam/App-Store-Connect-CLI) (MIT, self-contained binary, JSON
output, ships 23 agent skills of its own). This skill is only the bokendell convention on top of it; run
`asc install-skills` once for the command detail and never re-document asc here.

## Convention, same in every app

| Thing | Where |
|---|---|
| Listing as files (descriptions, keywords, release notes, review info, per locale) | `apps/mobile/store/` (`asc metadata init --dir`) |
| Screenshots | `apps/mobile/store/screenshots/<locale>/<device>/`, applied with `asc screenshots apply` |
| Scripts | `apps/mobile/package.json`: `store:pull`, `store:push` (metadata only), `store:submit` (build + review) |
| Credentials | Infisical `<app>` project, `/infrastructure/apple`: `APPLE_ASC_KEY_ID`, `APPLE_ASC_ISSUER_ID`, `APPLE_ASC_PRIVATE_KEY`, plus the shared `APPLE_TEAM_ID` |
| Hosted run | `.github/workflows/mobile-store.yml`, `workflow_dispatch` only, inputs `action` (push-metadata, submit) and `version` |
| Runbook | `docs/runbooks/app-store.md`, linked from `docs/MAP.md` |

The `ASC_` names are deliberate: `/infrastructure/apple` in an app's project already holds `APPLE_KEY_ID` and
`APPLE_PRIVATE_KEY` for the **Sign in with Apple** key that better-auth reads, and that is a different Apple key —
handing it to App Store Connect gets an opaque failure from Apple, not a useful error. The App Store Connect key may
not exist yet in a given app's project; if it is missing, stop and say so on the ticket. Never reuse the auth key,
and never rename it.

`store:push` and `store:submit` refuse to run without an explicit confirmation flag. Nothing in this convention
runs on push; a store write is a person or a release routine deciding, never a side effect of a merge.

## What an agent may do

- **Pull and diff** any time: `store:pull`, then read the diff. That is how a session learns what the listing says.
- **Edit the files** in a PR like any other change; the PR review is the copy review.
- **Push metadata or submit** only when the task says so in the payload and the session runs the release routine
  or the owner is in the loop. `asc metadata apply --dry-run` and `asc validate` first, always.
- Never touch pricing, in-app purchases or availability from a session; those stay in the console.

## In a cloud session

`asc auth login --bypass-keychain` with the four `ASC_`/team secrets read through the app's Infisical identity.
Install with `curl -fsSL https://asccli.sh/install | bash` (Linux fine); if the environment's network allowlist
blocks it, say so in the feedback comment and stop at scaffolding.

## Release routine shape (level 1)

Payload: `release mobile <marketing version>`. Steps: EAS production build, `store:push` for the version's release
notes, `asc validate --strict`, `store:submit`, comment the build and submission ids on the release ticket. The
routine's fire token stays with the owner until this has run clean by hand twice.
