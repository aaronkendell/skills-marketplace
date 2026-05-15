---
name: inngest
description: Use when working with Inngest - creating functions, configuring events, setting up cron jobs, using steps, error handling, or any Inngest SDK code. Also use when debugging Inngest runs, reviewing Inngest patterns, or answering questions about Inngest APIs.
---

# Inngest

## Overview

Inngest is a durable execution engine for background jobs, scheduled tasks, and event-driven workflows. **The Inngest SDK evolves rapidly** - training data is often outdated or wrong.

## The Rule

**BEFORE writing ANY Inngest code, you MUST use WebFetch to fetch the latest docs.** No exceptions.

Do NOT rely on training data for Inngest patterns. Do NOT assume you know the current API. Fetch first, then write.

**"Describing" what you would fetch is not fetching.** Actually call WebFetch on the URLs below. No code until you have real doc content in your context.

## Doc URLs

| URL | When to Use |
|-----|-------------|
| `https://www.inngest.com/llms.txt` | **Start here.** Table of contents - find the right doc page for your task, then fetch that specific page |
| `https://www.inngest.com/llms-full.txt` | Full docs in markdown. Use when you need comprehensive reference or are unsure which section applies |

## Workflow

1. **Fetch `llms.txt`** to find the relevant doc section for your task
2. **Fetch the specific doc page** URL from the table of contents
3. **Write code** using the patterns from the docs you just fetched
4. If the docs don't cover your case, fetch `llms-full.txt` for comprehensive reference

## Red Flags - You Are About to Write Outdated Code

- "I know how Inngest works" - You know how it WORKED. Fetch the docs.
- "This is standard Inngest" - Standards change. Fetch the docs.
- "I'll just use createFunction" - The API signature may have changed. Fetch the docs.
- "The patterns are straightforward" - Straightforward patterns still evolve. Fetch the docs.
- Writing `import { logger, metadata } from "inngest"` without verifying - these APIs change
- Using `EventSchemas` without checking if it still exists
- Using `schedules.task()` without verifying the cron API
- Assuming event names like `inngest/function.failed` without checking

## Common Mistakes

| Mistake | Reality |
|---------|---------|
| Fabricating import paths | SDK exports change between versions. Verify every import. |
| Using old cron patterns | Scheduled function API evolves. Check current syntax. |
| Assuming event schema API | Type-safe events API has changed multiple times. |
| Guessing serve handler setup | Framework integrations (Hono, Next.js, etc.) have specific patterns. |
| Presenting outdated code confidently | If you didn't fetch the docs THIS session, you don't know if it's current. |
