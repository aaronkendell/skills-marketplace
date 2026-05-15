---
linear_id: {TEAM-NNN}
title: {Issue title}
priority: {urgent|high|medium|low}
estimate: {1|2|3|5|8}
labels: [{feature|bug|refactor|chore}]
---

## Problem
What needs to change and why. Include user impact.

## Expected Behavior
Describe the end state after implementation.

## Acceptance Criteria
- [ ] Specific, testable criterion
- [ ] Another criterion

## Testing Checklist

### API Tests
- [ ] `curl -s "$API_URL/endpoint" -H "$AUTH" | jq .field` — expected: value
- [ ] `curl -s "$API_URL/endpoint" -X POST -d '{"key":"value"}' -H "$AUTH"` — expected: 201

### UI Tests (Playwright)
- [ ] Navigate to /path — page loads without errors
- [ ] Click button X — expected behavior Y
- [ ] Screenshot comparison at /path

### Unit/Integration Tests
- [ ] `turbo test --filter='@bokendell/{package}' -- --run {test-name}` passes
- [ ] New test: {describe what needs a new test}

### Manual Verification
- [ ] {Steps that require human verification}

## Files to Touch
- `path/to/file.ts` — what changes
- `path/to/other.ts` — what changes

## Notes
Any additional context, links to design doc sections, or related issues.
