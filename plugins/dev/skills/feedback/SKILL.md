---
name: feedback
description: Post agent feedback to the repo's living feedback ticket at the end of a session, including what you could not do but wanted to, so tooling and skills improve from use. Use when a session hit a wall, a skill was wrong, a tool answered badly, or something was missing.
---

# Feedback

Every session that hits friction leaves one structured comment on the repo's living feedback ticket.
The ticket never closes; it is triaged daily into real tickets, skill-notes and the marketplace's drift file.

## Where to post

1. Look for a line `Agent feedback: <TEAM-n>` in the repo's `CLAUDE.md`. That is the ticket.
2. If the repo has none, create an issue titled `Agent feedback log` in the repo's Linear team
   (priority High, never close it), add the `Agent feedback:` line to `CLAUDE.md` in your PR, and post there.
3. A session that used the simrig rig posts its rig friction to the rig's own log (`SIM-248`) as the golf
   testing skill describes, and app or skill friction to the repo's ticket. Two comments when both apply.

## When to post

At the end of any session where at least one of these happened. A clean session posts nothing here.

- You wanted to do something and could not: a tool, permission, connector, secret, build, device or
  environment that was missing or refused. Say what you tried, what you got, and what would have unblocked it.
- A skill was wrong, missing a step, or contradicted the repo: name the skill and section, quote the
  sentence, say what reality was.
- A tool answered in a way that sent you down the wrong path: which tool, the input, the answer, the cost.
- You worked around something silently: say what, so the workaround becomes a fix.
- Steps you spent that a better answer would have saved.

## The comment, one per session

```
Session: <claude.ai session link, or "local">  Repo: <owner/name>  Branch or PR: <ref>
Task: <one line: what the session was doing>

Could not (one line each):
- <what I wanted> · <what happened> · <what would unblock it>

Skill or tool wrong (one line each):
- <skill or tool> · <what it said or did> · <what was true> · <cost: steps, minutes, a retry>

Worked around (one line each):
- <what> · <how> · <should become: fix | doc | ticket>
```

Be specific and vocal. Never paste tokens, cookies, signed URLs, or customer content. Do not open tickets
yourself from here; the triage does, once per day, so one problem gets one ticket.

## What the triage does with it

Each morning the entries are folded: a new ticket for a new failure, a comment on the existing one for a
known failure, a skill-notes line and a marketplace drift entry when a skill was wrong, and a reply on the
entry naming the ticket, so the trail is two-way. Recurring "could not" items become capabilities on the
roadmap; that is how missing tools get prioritised by real demand rather than by guess.
