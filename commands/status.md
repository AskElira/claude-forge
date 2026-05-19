---
description: Show the status of all Claude Forge workspaces — which goals are in progress, which floors are LIVE, BLOCKED, or pending. Reads ./workspaces/ and any .claude-forge/report.md files.
allowed-tools: Read, Glob, Bash
---

# Claude Forge Status

List every workspace under `./workspaces/`:

1. Use Glob to find `./workspaces/*/.claude-forge/plan.json`.
2. For each workspace, read `plan.json` and `report.md` (if it exists). Also attempt to read `.claude-forge/cost-ledger.json` from the same workspace. If the file does not exist, treat total cost as `$0.0000`. If the file exists, parse it as JSON and extract the `totalCostUsd` field (a number in USD). If parsing fails, treat total cost as `$0.0000`.
3. Render a table per workspace:

```
[<slug>]  Goal: <goal text>
  Floor 1 — <name>          [LIVE]
  Floor 2 — <name>          [LIVE]
  Floor 3 — <name>          [BLOCKED — 5 iterations + rescue failed]
  Floor 4 — <name>          [PENDING]
  Total spent: $X.XXXX
```

Format the total as a fixed 4-decimal USD value (e.g. `$0.0000`, `$0.1234`, `$1.2500`). If `cost-ledger.json` was missing or unparseable, render `$0.0000`. The line appears once per workspace block, after the last floor line.

If no workspaces exist, print `No workspaces yet. Run /claude-forge:build <goal> to start.` and stop.

For any blocked floor, show the most recent failure reason from the history file. Suggest `/claude-forge:fix <slug> <floor-number>`.

Do not dispatch any sub-agents. Read-only.
