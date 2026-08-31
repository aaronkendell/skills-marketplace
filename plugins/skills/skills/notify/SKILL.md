---
name: notify
description: "Send Aaron a message from any repo or agent — iMessage for things that need him now, email for long-form, Discord as the archive. Covers the escalation filter (what actually earns a text), credential sourcing from Infisical, recipient allowlists, and the message formats that survive a phone screen. Use whenever an agent, routine, app, or CI job needs to reach Aaron rather than just log something."
---

# notify — reaching Aaron

Three channels, one rule each. **The hard part is not sending; it is deciding whether to
send at all.** Read the filter before the mechanics.

## The filter — what earns a text

> **A text is for something wrong right now that only Aaron can fix, or something genuinely
> great that just happened. Everything else goes to Discord.**

This is a technical constraint, not taste. Photon flags lines for **burst sending** and
**broadcasting without conversation**, and the line is **shared** — its reputation is not
Aaron's alone to spend. Ten chatty integrations is how the channel dies for everything,
including the messages that mattered.

| Earns a text | Does not |
|---|---|
| Payment/autopay failed | CI on a branch, PR reviews, dependency bumps |
| Production down (golf, portfolio) | Stage deploys, preview builds |
| Prod deploy failed on `main` | Anything Discord already archives fine |
| Anomalous charge, possible fraud | Routine completion, task done |
| Golf: first real signup or payment | Weekly digests other than the agreed financial one |
| Infra cost spike | Anything Aaron will see next time he opens a terminal |

**Two more rules that follow from the flag patterns:**

- **Send during waking hours.** A 3am automated text reads as a bot to Apple's spam
  detection. The weekly financial text fires Sunday morning; keep new senders in daylight.
- **No follow-ups.** One message per event. Chasing is the third flag pattern.

When unsure, it is Discord. A missed Discord post costs nothing; a flagged line costs the
whole channel.

## Channels

| Channel | For | Does Aaron read it |
|---|---|---|
| **iMessage** | urgent, plus the agreed weekly financial text | yes |
| **Email** | long-form, rich formatting, archival — monthly reports | when he chooses |
| **Discord** | machine archive | no, and that is fine — its job is to exist |

Discord stays wired precisely *because* it is unread. It is the durable record for when
iMessage breaks, which it eventually will: hosted iMessage relays are not Apple-sanctioned
and have been shut down before.

## Sending

### Never embed a credential in a skill, a prompt, or a repo

This plugin is installed at user scope with `autoUpdate: true` — anything written here lands
on every machine. **Keys come from Infisical at runtime, every time.** See the workspace
`CLAUDE.md` for the machine-identity pattern; never ask Aaron to run `infisical login`.

### Two paths, same guard

| Caller | Path |
|---|---|
| Deployed app, CI, a running service | **hive** — it already holds the credentials and owns channel routing |
| CLI, script, local agent with Infisical access | **`@bokendell/imessage` directly**, or `swarm notify` |

Both are safe because **the recipient allowlist lives inside `@bokendell/imessage`**, not in
any one caller. It fails closed: an empty or missing `IMESSAGE_ALLOWED_RECIPIENTS` refuses
every send rather than permitting every send. A guard that lives in one caller is a guard the
next caller forgets.

Email is guarded differently and deliberately: the allowlist sits at hive's **notification
dispatch**, not inside `@bokendell/emails`, because that package sends real transactional
mail and a global allowlist there would break legitimate sends.

### Config

Photon is **shared infrastructure, not an app secret** — it lives once at
`/infrastructure/photon` in the `bokendell` (workspace-level) account, alongside
`/infrastructure/github`, `/infrastructure/inngest` and the rest. Apps reach it through
Infisical references rather than holding their own copy, so **a rotation propagates instead
of leaving a stale copy in the path someone forgot.**

| Key | Notes |
|---|---|
| `SPECTRUM_PROJECT_ID` · `SPECTRUM_PROJECT_SECRET` | Photon project |
| `IMESSAGE_ALLOWED_RECIPIENTS` | Comma-separated E.164. **Empty = nothing sends.** |
| `IMESSAGE_DEFAULT_RECIPIENT` | Aaron. Who gets a message when no recipient is named. |

**A CLI is not scoped to the repo it runs in.** `swarm notify` works from golf, portfolio or
hq, so it pins its lookup to the `bokendell` account explicitly rather than inheriting the
current repo's Infisical context — where Photon secrets do not exist.

### Aaron by default. Emma is always explicit.

**The allowlist says who MAY be texted. It is not a distribution list.** Those are different
questions and conflating them is how a household channel gets muted.

- **Default recipient is Aaron.** Every alert, every CLI notification, every trigger.
- **Emma is named explicitly, per message, or she does not get it.**
- She is on the allowlist only because a small number of messages are genuinely for her.

**What Emma actually gets:** the weekly household spending number — variable spend against
budget, one figure, business and sinking funds excluded. Not the HSA, not the 401(k), not RSU
vesting, not infra costs. If a message would not change what she does this week, it is not
for her.

## Format — what survives a phone screen

**iMessage uses a proportional font.** Block-bar charts with inline labels go ragged, because
`Groceries` and `Dining` are different widths. Tested and confirmed.

**Put the bar on its own line under the label:**

```
Groceries 412/550
████████░░░░░░
Dining 487/460 - OVER by 27
██████████████
```

Other format notes:

- **Markdown renders** — iMessage converts it to native formatting ranges rather than showing
  raw syntax. Bold and italic survive.
- **URLs unfurl** natively; a bare artifact link on its own line reads well.
- **No emoji** — the house rule applies here too.
- Lead with the number. A phone notification shows the first line and little else, so the
  first line has to carry the message on its own.
- Available beyond text: attachments, voice notes, contact cards, rich links, polls, tapback
  reactions, message effects, edits, unsend. **Polls are worth remembering** for inbox items
  that need a yes/no.

## A note on the one recurring send

The weekly financial text is the single agreed recurring iMessage. It is a **broadcast to an
established thread**, which is defensible at two messages a week to two registered users —
but it is the one place this system deliberately runs against Photon's "inbound-first"
guidance. **Do not add a second recurring broadcast without a real reason**; each one moves
the line closer to a pattern that gets flagged.

## Related

- `@bokendell/imessage` (core) — Photon port, holds the allowlist
- `@bokendell/sms` (core) — Twilio, the documented fallback if Photon breaks. Not provisioned.
- hive `notifications` domain — channel enum, dispatch service, per-channel adapters
- `hq/.claude/skills/message/SKILL.md` — hq's area-to-Discord-channel routing map
