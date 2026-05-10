---
description: Manually trigger Steven to fix a specific floor. Reads the workspace state and the floor's failure history (if any), then dispatches Steven to diagnose and patch. Re-validates via Vex Gate 2 and Elira after the fix lands.
argument-hint: <workspace-slug> <floor-number-or-name> [error description]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
---

# AskElira Fix

Parse `$ARGUMENTS`:
- First token: workspace slug (folder name under `./workspaces/`)
- Second token: floor number (integer) or floor name
- Remaining tokens: optional error description

Set `WORKSPACE = ./workspaces/<slug>/`. Read `WORKSPACE/.askelira/plan.json` to find the target floor.

If the plan or workspace is missing, stop and tell the user to run `/askelira:build` first.

## Steps

1. **Gather context** — read the workspace files (use Glob to list, Read on the relevant ones). Read any prior failure log at `WORKSPACE/.askelira/floor-<N>-history.json`.
2. **Dispatch Steven** — pass: floor spec, current workspace state, error report (or "Floor blocked" if no error given), prior failure history.
3. **Steven patches** the workspace in-place.
4. **Vex Gate 2** — dispatch `vex` (gate 2 mode) on the patched workspace.
5. **Elira approve** — dispatch `elira` (APPROVE mode) with the patched output.
6. If approved → mark floor LIVE, update `WORKSPACE/.askelira/report.md`.
7. If rejected → report the new feedback. Suggest re-running this command up to 2 more times before falling back to `/askelira:build` from scratch.

## Hard rules

- Steven gets max 5 fix attempts ever per floor (across all `/askelira:fix` invocations). Track count in `WORKSPACE/.askelira/floor-<N>-history.json`.
- Never modify floors other than the one specified.
- If the user provides no error description, ask Elira to assess what's wrong first, then pass that to Steven.
