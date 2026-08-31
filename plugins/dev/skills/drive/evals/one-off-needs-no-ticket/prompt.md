---
name: "drive: A one-off fix runs without a ticket or a plan file"
tags: [guardrail, band]
runs: 2
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Grep, Glob]
---

Run `drive "the empty-state copy on the friends list says 'No friend's' with a stray apostrophe"`.
 There is no Linear issue for this and I don't want one.
