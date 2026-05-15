---
name: dev-ship
description: >
  Use when the user asks for the dev ship workflow to commit, push, create a PR, update Linear,
  and optionally merge. Triggers on `/dev ship` or when the user says "ship it", "commit and push",
  "create a PR", "we're done". Handles the full git + Linear + GitHub flow.
disable-model-invocation: true
---

# Phase 4: Ship

Commit staged changes, push, create PR with Linear link, update Linear status, and optionally merge.

## Prerequisites

- Files are staged (`git add` done by build phase)
- All automated checks passed (verified by build phase)
- User has manually reviewed the diff and any manual checklist items

## Steps

### Step 1: Verify Staged Changes

```bash
git status --short
git diff --cached --stat
```

If nothing is staged, tell the user and stop.

### Step 2: Determine Issue Context

Extract the Linear issue ID from the current branch name:
```bash
git branch --show-current
# e.g., bokendell/golf-123-score-editing → GOLF-123
```

Fetch the issue from Linear to get the title and project.

### Step 3: Commit

Create a conventional commit message. Format: `<linear-id> — <short description>`

```bash
git commit -m "$(cat <<'EOF'
GOLF-123 — implement score editing with in-place updates

- Add isHoleScored utility with tests
- Update score entry sheet for edit mode UX
- Make scorecard cells tappable for editing past holes

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

Commit message rules:
- First line: `<LINEAR-ID> — <short description>` (under 72 chars)
- Blank line, then bullet points of what changed
- Always include `Co-Authored-By` line

### Step 4: Push

```bash
git push -u origin $(git branch --show-current)
```

### Step 5: Create PR

```bash
gh pr create --title "<LINEAR-ID> — <title>" --body "$(cat <<'EOF'
## Summary
- What was implemented and why (2-3 bullets)

## Changes
| Action | File | Description |
|--------|------|-------------|
| Created | path/file.ts | What it does |
| Modified | path/other.ts | What changed |

## Testing
- Unit tests: X passing
- Integration tests: X passing  
- Type check: passing
- Lint: passing
- API tested: [specific endpoints]
- Manual verification: [what was checked]

## Linear
[<LINEAR-ID>](https://linear.app/bokendell/issue/<linear-id-lowercase>)

---
Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### Step 6: Update Linear

1. **Update issue status** to "In Review"
2. **Add comment** with PR link:
   ```
   PR created: <PR_URL>
   
   Changes: <brief summary>
   Tests: all passing
   ```

### Step 7: Monitor and Merge

Ask the user:
```
PR created: <PR_URL>
Linear updated to "In Review".

GitHub Actions will run. Options:
1. I'll monitor and merge when checks pass
2. I'll just leave it — you handle the merge
```

If option 1:
- Poll `gh run list --branch <branch> --json status,conclusion` every 30 seconds
- When all checks pass: ask "All checks passed. Merge into main?"
- If user confirms: `gh pr merge <PR_NUMBER> --squash --delete-branch`
- Update Linear to "Done"

If option 2:
- Done. User handles the rest.

### Step 8: Cleanup

After merge (if applicable):
- Switch back to main: `git checkout main && git pull`
- Clean up worktree if one was created
- Update Linear to "Done"

## Rules

- ALWAYS include Co-Authored-By in commit message.
- ALWAYS create PR with Linear link.
- ALWAYS update Linear status.
- NEVER force push.
- NEVER merge without user confirmation.
- If GitHub Actions fail, report the failure and stop — don't retry blindly.
