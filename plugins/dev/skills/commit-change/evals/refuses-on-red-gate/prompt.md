---
name: "commit-change: A red gate blocks the commit and names the failing check"
tags: [guardrail, gate]
runs: 2
max_turns: 6
timeout_seconds: 240
allowed_tools: [Read, Grep, Glob, Bash]
---

Run `commit-change "GOLF-512 — record skipHole as a durable round event"`. When you run the gate, assume `pnpm check:types:affected` fails with `TS2339: Property 'appendRoundEvent' does not exist on type RoundEventRepository` in packages/domains/src/packages/rounds/application/round/round.service.ts.
