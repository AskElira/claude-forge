---
description: Plan a goal into floors without building. Dispatches Elira in PLAN mode and prints the resulting floor decomposition. Useful for sanity-checking a goal before running /claude-forge:build.
argument-hint: <goal description>
allowed-tools: Read, Glob, Grep, Task
---

# Claude Forge Plan

Dispatch the **elira** sub-agent in PLAN mode with the goal:

> $ARGUMENTS

If `$ARGUMENTS` is empty, ask the user for a goal and stop.

Receive Elira's JSON array. Pretty-print it as a numbered table:

```
Floor 1 — <name>
  Description:    <description>
  Success:        <successCondition>
  Deliverable:    <deliverable>
  Depends on:     <dependsOn or "—">
```

After the table, briefly describe the **execution waves** (which floors can run in parallel based on `dependsOn`).

End with a one-line suggestion: `Run /claude-forge:build $ARGUMENTS to ship this.`

Do not write any files. Do not dispatch any other sub-agents.
