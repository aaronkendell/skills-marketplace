---
name: secrets
description: >
  How config and secrets reach running code — the zod config boundary, the three
  injection paths (local, CI, Fly runtime), why a value in Infisical is not yet a
  value on a machine, and the NEXT_PUBLIC build-time exception. Use when adding a
  config value, rotating a key, or debugging "it's set but the app can't see it".
---

# Secrets and config

**Repo specifics live in the repo.** golf and portfolio each have their own
`.claude/skills/secrets/` naming their paths, apps and machine lifecycles. This skill
carries what is true everywhere.

For *reading* a credential in a session — machine identity, never `infisical login` —
see `skills:vendor-access`.

## Never `process.env` in app code

Every value goes through the app's zod-validated config. Enforced by the
`no-process-env-outside-config` arch rule. A schema-validated value fails at boot with
a name; a raw `process.env` fails at 3am as `undefined`.

Adding one takes three steps, and skipping the third breaks CI:

1. Add it to the zod schema — optional or required **deliberately**. Required means the
   app refuses to boot without it, which is right for anything whose absence is a
   silent wrong answer rather than a visible outage.
2. Add it in Infisical at the right path and environment.
3. Add it to the env stubs so CI and tests still boot (`env-stubs-cover-required`).

Check the injected environment before deploy, not Infisical's API. Querying Infisical
directly can pass while the injection silently failed — you want the same path the
deploy uses. **Present-but-empty counts as missing**: a dangling `${{ … }}` resolves to
an empty string and looks configured.

## The three ways a value reaches code

| Context | How |
|---|---|
| Local dev | `swarm workspace dev` injects from Infisical |
| CI | OIDC → `load-ci-secrets`, one identity per app |
| Fly runtime | Infisical's native Fly integration syncs into Fly's own secret store |

## A value in Infisical is not yet a value on a machine

The integration pushes into Fly's vault. Whether a **machine** sees it depends on
lifecycle:

- A machine that **starts** picks up staged secrets. Scale-to-zero apps often take a
  rotated value by themselves on the next cold start.
- A machine already **running** keeps the old value until updated. Always-on apps need
  an explicit apply.

```bash
fly secrets list -a <app>      # status: Staged | Deployed
fly secrets deploy -a <app>    # applies staged, no rebuild, current release
```

`fly secrets deploy` rolls machines on the image they are **already running** — unlike
a redeploy, which ships whatever else has landed on main since. Rotating a key must not
become a code deploy.

Infisical's auto-restart toggle does this for you. Keep it **off for production**: the
risk is not the sync, it is the timing — a save in a web UI would roll the fleet at a
moment nobody chose.

## The `NEXT_PUBLIC_*` exception — build time, not runtime

`NEXT_PUBLIC_*` values are inlined at `next build`. They are **not** runtime secrets,
and setting one on the running machine changes nothing.

CI collects them from the Infisical-injected job env into a single build secret. An
image built by hand that omits it will silently bake the localhost stubs into the
bundle — the build succeeds and the app points at nothing.

They are public by construction: they ship in the browser bundle. Never put a value in
a `NEXT_PUBLIC_*` name that should stay secret.

## Never

Echo a fetched secret or a client secret into output, a file, or a commit. Names and
digests (`fly secrets list`) are fine; values are not.
