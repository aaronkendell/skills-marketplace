---
name: app-store
description: App Store Connect as code for any bokendell mobile app. Use when touching store metadata, screenshots, TestFlight, review submission or a mobile release; it names the folder, scripts, secrets and authentication every app shares, and defers the command detail to the installed `asc` binary's own help.
---

# App Store as code

The tool is [asc](https://github.com/rorkai/App-Store-Connect-CLI) (MIT, self-contained binary, JSON
output). This skill is only the bokendell convention on top of it. The `app-store-connect` entry in this
marketplace (`rorkai/app-store-connect-cli-skills`, community-maintained and unaffiliated with Apple) adds
per-command skills; it complements this convention rather than replacing it.

## Never write an asc invocation from documentation or memory

Run `asc <command> --help` against the installed binary and copy the flags from it. The other two sources are
incomplete in opposite directions: the upstream README documents only `--private-key <path>` and never names
the environment variables, while `asc auth --help` says environment variables can supply credentials without
saying which. Only the binary is authoritative. Traps confirmed by running asc 4.11.0:

| Looks right | Is |
|---|---|
| `--app-id <id>` | `--app <id>`, always |
| `metadata pull` / `metadata apply` on their own | `--version <marketing version>` is **required** on both |
| `asc metadata init` to fetch a listing | `init` scaffolds **blank** templates and would write empty files over real metadata; `asc metadata pull` reads the live listing |
| `asc publish appstore` as a submit-only step | It uploads a build, so it needs `--ipa <path>` or `--workspace <path>` |

## Convention, same in every app

| Thing | Where |
|---|---|
| Listing as files (descriptions, keywords, release notes, review info, per locale) | `apps/mobile/store/`, read with `asc metadata pull` |
| Screenshots | `apps/mobile/store/screenshots/<locale>/<device>/`, applied with `asc screenshots apply` |
| Scripts | `apps/mobile/package.json`: `store:pull`, `store:push` (metadata only), `store:submit` (build + review) |
| Credentials | Infisical `<app>` project, `/infrastructure/apple`: `APPLE_ASC_KEY_ID`, `APPLE_ASC_ISSUER_ID`, `APPLE_ASC_PRIVATE_KEY` |
| Hosted run | `.github/workflows/mobile-store.yml`, `workflow_dispatch` only, inputs `action` (push-metadata, submit) and `version` |
| Runbook | `docs/runbooks/app-store.md`, linked from `docs/MAP.md` |

The `ASC_` infix is not decoration. `/infrastructure/apple` already holds `APPLE_KEY_ID` and
`APPLE_PRIVATE_KEY` for the **Sign in with Apple** key that better-auth reads — a different Apple key at the
same path. Reading those names hands App Store Connect the wrong key for an opaque failure from Apple; writing
them overwrites a working auth credential. Never reuse the auth key, and never rename either pair. The App
Store Connect key may not exist yet in a given app's project; if it is missing, stop and say so on the ticket.

## Authenticating

No login step, no config file, nothing written to disk. Export four variables and run:

| Infisical `/infrastructure/apple` | asc |
|---|---|
| `APPLE_ASC_KEY_ID` | `ASC_KEY_ID` |
| `APPLE_ASC_ISSUER_ID` | `ASC_ISSUER_ID` |
| `APPLE_ASC_PRIVATE_KEY` | `ASC_PRIVATE_KEY` — the key **content**, not a path |
| — | `ASC_BYPASS_KEYCHAIN=1` |

`asc auth login` is not the way in: it takes `--private-key <path>`, a file, and Infisical hands you content.
`ASC_BYPASS_KEYCHAIN=1` is about correctness rather than convenience — without it a developer key already in
the login keychain can be picked ahead of the credentials you supplied, and the run then succeeds against the
wrong account. Confirm the environment with `asc apps list` before anything that writes.

## What an agent may do

- **Pull and diff** any time: `store:pull`, then read the diff. That is how a session learns what the listing says.
- **Edit the files** in a PR like any other change; the PR review is the copy review.
- **Push metadata or submit** only when the task says so in the payload and the session runs the release routine
  or the owner is in the loop. `asc metadata apply --dry-run` and `asc validate` first, always.
- Never touch pricing, in-app purchases or availability from a session; those stay in the console.

`store:push` and `store:submit` refuse to run without an explicit confirmation flag. Nothing in this convention
runs on push; a store write is a person or a release routine deciding, never a side effect of a merge.

## In a cloud session

Install with `curl -fsSL https://asccli.sh/install | bash` (Linux fine); if the environment's network allowlist
blocks it, say so in the feedback comment and stop at scaffolding. Then export the four variables above from
the app's Infisical identity — there is no login to run.

## Release routine shape (level 1)

Payload: `release mobile <marketing version>`. Steps: EAS production build, `store:push` for the version's release
notes, `asc validate --strict`, `store:submit`, comment the build and submission ids on the release ticket. The
routine's fire token stays with the owner until this has run clean by hand twice.
