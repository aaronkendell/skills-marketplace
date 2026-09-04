---
name: orchestrate
description: One tick of the agent orchestrator. Read the board (Linear + open PRs), decide what to dispatch, fire it, post one digest, write the journal. Use when running the dispatch loop by hand from a local session, and later as the prompt of the scheduled orchestrator routine.
---

# Orchestrate

A tick is stateless. Everything it needs is in Linear, the open PRs and `notes.md` beside this file. Run it
from a local session for now; the same steps become the scheduled routine once `notes.md` stops growing.

## 1. Controls

- Max new dispatches per tick: 2. Max per day: 6 (count today's `Dispatched` comments across teams).
- Depth for anything you fire: 0.
- Never fire a release. Never merge a "Version Packages" PR. Never touch a ticket labeled `needs-decision`.

## 2. Read the board

For each repo with routines (`dispatch/routines.json`):

- **Awaiting land:** open PRs from agent branches whose issue is not Done and that have no `Dispatched
  <repo>-land` comment. These go first.
- **Stuck:** issues In Progress with a `Dispatched` comment over two hours old and no PR. Re-dispatch once
  with `retry` in the text; the second time, label `needs-decision` and comment why.
- **Ready:** Todo issues labeled `agent-ready`, priority order, not blocked. Fill the remaining slots.
- **Unblocked:** issues whose blocked-by just went Done. If the blocker was in another repo, check whether
  a release is still needed before the change is consumable; if so, comment that and leave it blocked.

## 3. Fire

Use the dispatch skill for each, with the text template. One comment per dispatch on the issue.

## 4. Digest

One comment on the orchestrator log issue (or one message to the owner when run by hand): what was fired,
what is waiting, what needs a decision, today's count against the cap. Nothing changed: say so in one line.

## 5. Journal

Append to `notes.md` whenever something surprised you: what happened, what broke, what rule you adopted.
This file is the product of the trial period. When a rule is stable, move it into a skill and delete the entry.
