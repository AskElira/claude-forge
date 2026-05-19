---
description: Manually trigger Steven to fix a specific floor. Reads the workspace state and the floor's failure history (if any), then dispatches Steven to diagnose and patch. Re-validates via Vex Gate 2 and Elira after the fix lands.
argument-hint: <workspace-slug> <floor-number-or-name> [error description]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
---

# Claude Forge Fix

Parse `$ARGUMENTS`:
- First token: workspace slug (folder name under `./workspaces/`)
- Second token: floor number (integer) or floor name
- Remaining tokens: optional error description

Set `WORKSPACE = ./workspaces/<slug>/`. Read `WORKSPACE/.claude-forge/plan.json` to find the target floor.

If the plan or workspace is missing, stop and tell the user to run `/claude-forge:build` first.

## Steps

1. **Gather context** — read the workspace files (use Glob to list, Read on the relevant ones). Read any prior failure log at `WORKSPACE/.claude-forge/floor-<N>-history.json`. Then load the cost ledger from `WORKSPACE`:

```bash
node -e "(async()=>{try{const{CostLedger}=require('./src/cost-ledger');const l=await CostLedger.load('.claude-forge/cost-ledger.json');await l.save('.claude-forge/cost-ledger.json');}catch(e){}})()"
```

If `src/cost-ledger.js` is missing, skip silently. (SPEC-037)

2. **Dispatch Steven** — pass: floor spec, current workspace state, error report (or "Floor blocked" if no error given), prior failure history.
3. **Steven patches** the workspace in-place. After Steven returns:

```bash
node -e "(async()=>{try{const{CostLedger}=require('./src/cost-ledger');const l=await CostLedger.load('.claude-forge/cost-ledger.json');l.addUsage({agent:'Steven',floor:FLOOR_N,inputTokens:STEVEN_INPUT,outputTokens:STEVEN_OUTPUT,model:'claude-opus-4-7'});await l.save('.claude-forge/cost-ledger.json');}catch(e){}})()"
```

Replace placeholders with response metadata. (SPEC-037, SPEC-043)

4. **Vex Gate 2** — dispatch `vex` (gate 2 mode) on the patched workspace. After Vex Gate 2 returns:

```bash
node -e "(async()=>{try{const{CostLedger}=require('./src/cost-ledger');const l=await CostLedger.load('.claude-forge/cost-ledger.json');l.addUsage({agent:'Vex2',floor:FLOOR_N,inputTokens:VEX2_INPUT,outputTokens:VEX2_OUTPUT,model:'claude-sonnet-4-6'});await l.save('.claude-forge/cost-ledger.json');}catch(e){}})()"
```

Replace placeholders. (SPEC-037, SPEC-043)

5. **Elira approve** — dispatch `elira` (APPROVE mode) with the patched output. After Elira returns:

```bash
node -e "(async()=>{try{const{CostLedger}=require('./src/cost-ledger');const l=await CostLedger.load('.claude-forge/cost-ledger.json');l.addUsage({agent:'Elira',floor:FLOOR_N,inputTokens:ELIRA_INPUT,outputTokens:ELIRA_OUTPUT,model:'claude-opus-4-7'});await l.save('.claude-forge/cost-ledger.json');}catch(e){}})()"
```

Replace placeholders. (SPEC-037, SPEC-043)

6. If approved → mark floor LIVE, update `WORKSPACE/.claude-forge/report.md`.
7. If rejected → report the new feedback. Suggest re-running this command up to 2 more times before falling back to `/claude-forge:build` from scratch.

## Hard rules

- Steven gets max 5 fix attempts ever per floor (across all `/claude-forge:fix` invocations). Track count in `WORKSPACE/.claude-forge/floor-<N>-history.json`.
- Never modify floors other than the one specified.
- If the user provides no error description, ask Elira to assess what's wrong first, then pass that to Steven.
