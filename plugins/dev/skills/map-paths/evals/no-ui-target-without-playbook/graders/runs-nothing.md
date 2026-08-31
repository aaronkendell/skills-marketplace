---
type: tool_used
tool: Bash
input_match: 'vitest run|pnpm (test|e2e)|maestro test|playwright test|curl '
max: 0
target: trace
---

map-paths documents; exercise-paths runs. Narrowed from bare tool names (an `ls` of a path
containing 'maestro' tripped the old pattern) to actual invocations.
