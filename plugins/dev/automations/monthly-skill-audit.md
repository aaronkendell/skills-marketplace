# Monthly skill audit — scheduled cloud routine prompt

Point `/schedule` at this file. Cadence: first Monday, 08:00. Scope: the skills marketplace and
each app repo's `.claude/skills/`. Recommends; never applies (see `improve`).

## 1 · Run every eval suite

```bash
cd ~/repos/bokendell/skills-marketplace
claude plugin eval dev@bokendell-skills --eval-dir skills --runs 2 --threshold 0.8 \
  --max-cost-usd 10 --json .skill-watch/evals/$(date +%Y-%m)-dev.json
# repo skills: from each repo root
claude plugin eval .claude/skills --runs 2 --threshold 0.8 --max-cost-usd 5
```

Report pass rate per skill and **what moved since last month**. A case that dropped is the
headline; green is a footnote. A suite at 100% since day one is uncalibrated — say so.

## 2 · Model regression

If a new model shipped, re-run with `--model <new>` and diff which *cases* changed direction.

## 3 · `/skill-doctor`

Never invoked · cost grew without usage · the expensive ones ranked.

## 4 · Read the month's signals

`.skill-watch/signals.json` + weekly outputs: accepted-but-never-applied (stalled) · stuck at 2
for three months (threshold wrong, or noise → reject) · rejected-yet-re-emitted (emitter id bug).

## 5 · The standing question

What was done by hand 3+ times this month that no skill covers?

## 6 · Drift

Repo skills whose commands no longer exist · marketplace skills naming a path/tool that moved ·
hook scripts pointing at missing files (fail-open hooks hide this for months) · stale model names
in prose.

## Output

A branch on the marketplace with `.skill-watch/monthly/YYYY-MM.md` plus unambiguous fixes and
proposed diffs — **as a draft PR, never merged by the routine**. An empty month is a fine result.
