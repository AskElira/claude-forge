---
description: Show the status of all AskElira workspaces — which goals are in progress, which floors are LIVE, BLOCKED, or pending. Reads ./workspaces/ and any .askelira/report.md files.
allowed-tools: Read, Glob, Bash
---

# AskElira Status

List every workspace under `./workspaces/`:

1. Use Glob to find `./workspaces/*/.askelira/plan.json`.
2. For each, read `plan.json` and `report.md` (if it exists).
3. Render a table per workspace:

```
[<slug>]  Goal: <goal text>
  Floor 1 — <name>          [LIVE]
  Floor 2 — <name>          [LIVE]
  Floor 3 — <name>          [BLOCKED — 5 iterations + rescue failed]
  Floor 4 — <name>          [PENDING]
```

If no workspaces exist, print `No workspaces yet. Run /askelira:build <goal> to start.` and stop.

For any blocked floor, show the most recent failure reason from the history file. Suggest `/askelira:fix <slug> <floor-number>`.

Do not dispatch any sub-agents. Read-only.
