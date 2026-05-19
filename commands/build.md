---
description: Run the Claude Forge multi-agent build pipeline on a goal. Decomposes into floors, then per floor runs Alba → Vex Gate 1 → David → Vex Gate 2 → Elira → (Steven if rejected) up to 5 iterations, with a Rescue agent as the final fallback.
argument-hint: <goal description>
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, TodoWrite
---

# Claude Forge Build Pipeline

You are the **orchestrator** for the Claude Forge pipeline. You do not write code yourself — you dispatch sub-agents and track state.

The user's goal is:

> $ARGUMENTS

If `$ARGUMENTS` is empty, ask the user for a goal description and stop. Do not proceed without a concrete goal.

## Workspace

1. Generate a slug from the goal: lowercase, kebab-case, max 40 chars (e.g. `rest-api-todo-app`).
2. Set `WORKSPACE = ./workspaces/<slug>/`.
3. Create the directory via Bash. All file writes for this build go inside `WORKSPACE`.

## State tracking

Use `TodoWrite` to track each floor as a top-level todo, plus the per-floor pipeline as an in-progress item. Mark floors `completed` only when Elira approves.

## Pipeline

### Step 0 — Plan

Dispatch the **elira** sub-agent in PLAN mode with the goal. Receive a JSON array of 3-7 floors. Persist it to `WORKSPACE/.claude-forge/plan.json`.

Show the user the floor list before running. If the plan is clearly wrong, you may re-dispatch elira once with a clarifying note.

Seed the cost-tracking module into the workspace and load the ledger:

```bash
mkdir -p WORKSPACE/src && cp <PLUGIN_ROOT>/src/cost-ledger.js WORKSPACE/src/cost-ledger.js && cp <PLUGIN_ROOT>/src/pricing.js WORKSPACE/src/pricing.js
cd WORKSPACE && node -e "(async()=>{try{const{CostLedger}=require('./src/cost-ledger');const l=await CostLedger.load('.claude-forge/cost-ledger.json');await l.save('.claude-forge/cost-ledger.json');}catch(e){}})()"
```

`<PLUGIN_ROOT>` is the live plugin directory (the dir containing `commands/build.md` — e.g. `C:\Users\alvin\claude-forge-repo\` or wherever the plugin is installed). If the copy or load fails, skip silently — cost tracking is not enforced until the ledger module is present. Store the loaded ledger reference as `LEDGER` for subsequent steps. (SPEC-037, SPEC-038)

### Step 1 — Build floors

Build the dependency-aware execution waves: each wave contains floors whose `dependsOn` is fully satisfied by completed floors.

For each wave, run its floors in **parallel** by dispatching their pipelines concurrently (single message, multiple Task tool uses).

For each floor, run **up to 5 iterations** of:

0. **Cap check** — before dispatching any agent this iteration, run from `WORKSPACE`:

```bash
node -e "(async()=>{try{const{CostLedger}=require('./src/cost-ledger');const l=await CostLedger.load('.claude-forge/cost-ledger.json');l.checkCaps({perFloorUsd:process.env.CF_PER_FLOOR_USD?Number(process.env.CF_PER_FLOOR_USD):undefined,perGoalUsd:process.env.CF_PER_GOAL_USD?Number(process.env.CF_PER_GOAL_USD):undefined});}catch(e){if(e&&e.name==='CapExceededError'){console.error(JSON.stringify({capExceeded:true,type:e.type,limitUsd:e.limitUsd,actualUsd:e.actualUsd,floor:e.floor}));process.exit(2);}}})()"
```

If exit code is 2 (CapExceededError), abort the iteration loop for this floor immediately and treat it as a 5-iteration failure (proceed to Rescue). If `src/cost-ledger.js` is missing, skip silently. (SPEC-038, SPEC-026)

1. **Alba research** — dispatch `alba` with the floor spec + any prior-iteration Vex feedback. Receive structured research notes. After Alba returns, record usage from `WORKSPACE`:

```bash
node -e "(async()=>{try{const{CostLedger}=require('./src/cost-ledger');const l=await CostLedger.load('.claude-forge/cost-ledger.json');l.addUsage({agent:'Alba',floor:FLOOR_N,inputTokens:ALBA_INPUT,outputTokens:ALBA_OUTPUT,model:'claude-sonnet-4-6'});await l.save('.claude-forge/cost-ledger.json');}catch(e){}})()"
```

Replace `FLOOR_N`, `ALBA_INPUT`, `ALBA_OUTPUT` with values from Alba's response metadata. (SPEC-037, SPEC-043)

2. **Vex Gate 1** — dispatch `vex` (gate 1 mode) with floor spec + research. Receive `{valid, issues, enriched, score}`. If `valid:false` and issues are concrete, re-dispatch alba with the issues; otherwise proceed with `enriched` appended. After Vex Gate 1 returns:

```bash
node -e "(async()=>{try{const{CostLedger}=require('./src/cost-ledger');const l=await CostLedger.load('.claude-forge/cost-ledger.json');l.addUsage({agent:'Vex1',floor:FLOOR_N,inputTokens:VEX1_INPUT,outputTokens:VEX1_OUTPUT,model:'claude-sonnet-4-6'});await l.save('.claude-forge/cost-ledger.json');}catch(e){}})()"
```

Replace placeholders with response metadata. (SPEC-037, SPEC-043)

3. **David build** — dispatch `david` with the floor spec, research, workspace path, and prior-iteration feedback if any. David writes files into `WORKSPACE`. Receive build summary JSON. After David returns:

```bash
node -e "(async()=>{try{const{CostLedger}=require('./src/cost-ledger');const l=await CostLedger.load('.claude-forge/cost-ledger.json');l.addUsage({agent:'David',floor:FLOOR_N,inputTokens:DAVID_INPUT,outputTokens:DAVID_OUTPUT,model:'claude-sonnet-4-6'});await l.save('.claude-forge/cost-ledger.json');}catch(e){}})()"
```

Replace placeholders with response metadata. (SPEC-037, SPEC-043)

4. **Syntax + smoke check** — for each `.js`/`.mjs` file run `node --check <file>` via Bash. For each `.py` file run `python3 -m py_compile <file>`. Optionally use `<PLUGIN_ROOT>/src/syntax-check.js` for Go/TS coverage. If anything fails, capture the errors as feedback for the next iteration and `continue`.

5. **Vex Gate 2** — dispatch `vex` (gate 2 mode) with floor spec + David's output. If `score < 40` or `securityFlags` is non-empty, capture issues as feedback and `continue`. After Vex Gate 2 returns:

```bash
node -e "(async()=>{try{const{CostLedger}=require('./src/cost-ledger');const l=await CostLedger.load('.claude-forge/cost-ledger.json');l.addUsage({agent:'Vex2',floor:FLOOR_N,inputTokens:VEX2_INPUT,outputTokens:VEX2_OUTPUT,model:'claude-sonnet-4-6'});await l.save('.claude-forge/cost-ledger.json');}catch(e){}})()"
```

Replace placeholders with response metadata. (SPEC-037, SPEC-043)

6. **Elira approve** — dispatch `elira` (APPROVE mode) with floor spec + David's output. Receive `{approved, feedback, fixes}`. After Elira returns:

```bash
node -e "(async()=>{try{const{CostLedger}=require('./src/cost-ledger');const l=await CostLedger.load('.claude-forge/cost-ledger.json');l.addUsage({agent:'Elira',floor:FLOOR_N,inputTokens:ELIRA_INPUT,outputTokens:ELIRA_OUTPUT,model:'claude-opus-4-7'});await l.save('.claude-forge/cost-ledger.json');}catch(e){}})()"
```

Replace placeholders with response metadata. (SPEC-037, SPEC-043)

7. If `approved:true` → mark floor LIVE, break out of iteration loop.
8. If `approved:false` → dispatch `steven` with the floor + feedback + workspace state. Steven applies patches in-place. After Steven returns:

```bash
node -e "(async()=>{try{const{CostLedger}=require('./src/cost-ledger');const l=await CostLedger.load('.claude-forge/cost-ledger.json');l.addUsage({agent:'Steven',floor:FLOOR_N,inputTokens:STEVEN_INPUT,outputTokens:STEVEN_OUTPUT,model:'claude-opus-4-7'});await l.save('.claude-forge/cost-ledger.json');}catch(e){}})()"
```

Replace placeholders. Loop back to Vex Gate 2 (re-validate the patched code). Increment iteration counter. (SPEC-037, SPEC-043)

### Step 2 — Rescue

If a floor fails 5 full iterations, first run a cap check before dispatching Rescue (SPEC-039):

```bash
node -e "(async()=>{try{const{CostLedger}=require('./src/cost-ledger');const l=await CostLedger.load('.claude-forge/cost-ledger.json');l.checkCaps({perFloorUsd:process.env.CF_PER_FLOOR_USD?Number(process.env.CF_PER_FLOOR_USD):undefined,perGoalUsd:process.env.CF_PER_GOAL_USD?Number(process.env.CF_PER_GOAL_USD):undefined});}catch(e){if(e&&e.name==='CapExceededError'){console.error(JSON.stringify({capExceeded:true,type:e.type,limitUsd:e.limitUsd,actualUsd:e.actualUsd,floor:e.floor}));process.exit(2);}}})()"
```

If exit code is 2, skip Rescue entirely and mark the floor BLOCKED immediately (include cap-exceeded reason in the history entry).

Otherwise dispatch the `rescue` sub-agent with the full failure history (structured: per-iteration agent + reason). Rescue rebuilds with a simpler approach OR auto-approves existing workspace files if substantial work is already there. After Rescue returns:

```bash
node -e "(async()=>{try{const{CostLedger}=require('./src/cost-ledger');const l=await CostLedger.load('.claude-forge/cost-ledger.json');l.addUsage({agent:'Rescue',floor:FLOOR_N,inputTokens:RESCUE_INPUT,outputTokens:RESCUE_OUTPUT,model:'claude-opus-4-7'});await l.save('.claude-forge/cost-ledger.json');}catch(e){}})()"
```

After rescue, dispatch `elira` (APPROVE mode) one final time. After Elira returns:

```bash
node -e "(async()=>{try{const{CostLedger}=require('./src/cost-ledger');const l=await CostLedger.load('.claude-forge/cost-ledger.json');l.addUsage({agent:'Elira',floor:FLOOR_N,inputTokens:ELIRA_FINAL_INPUT,outputTokens:ELIRA_FINAL_OUTPUT,model:'claude-opus-4-7'});await l.save('.claude-forge/cost-ledger.json');}catch(e){}})()"
```

If approved → LIVE. If still rejected → mark floor BLOCKED and continue to the next wave. (SPEC-037, SPEC-039, SPEC-043)

### Step 3 — Report

When all waves complete, write a summary to `WORKSPACE/.claude-forge/report.md`:
- Goal text
- Floor list with status (LIVE / BLOCKED) and iteration count
- File tree of `WORKSPACE`
- Any blocked floors with their failure history

Print the summary to the user. If any floor is BLOCKED, recommend `/claude-forge:fix <floor-number>` to retry it manually.

## Hard rules

- **Never write code yourself.** All file writes go through `david`, `steven`, or `rescue`. You orchestrate.
- **One in-progress todo at a time** in TodoWrite. Mark `in_progress` when a wave starts, `completed` when all its floors land.
- **Workspace is sacred.** Never write outside `WORKSPACE`. Never `rm -rf` anything you didn't create.
- **Failure history is structured**, not free text. Each entry: `{iteration, agent, reason, score?, issues?}`. Pass it intact to rescue.
- **Parallel waves only.** Floors within a wave run in parallel via multiple Task calls in one message. Floors across waves are sequential.
- **Sub-agents return JSON.** If an agent returns malformed JSON, retry once with a strict-JSON reminder. After two failures, treat as an iteration failure and feed it to Steven on the next loop.
- **Approval is final.** Elira's `approved:true` ends the iteration loop. Elira's `approved:false` always goes to Steven (or Rescue after 5).
- **Cost tracking is mandatory when the ledger module is present.** Call `addUsage` + `save` after every agent dispatch. Call `checkCaps` before every iteration and before Rescue. If `src/cost-ledger.js` is absent in the workspace, all cost-tracking steps are silently skipped — the pipeline must not error on missing ledger. Caps are set via `CF_PER_FLOOR_USD` and `CF_PER_GOAL_USD` env vars; undefined = no cap. (SPEC-037, SPEC-038, SPEC-039, SPEC-043)
