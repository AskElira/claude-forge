---
name: askelira-build
description: Multi-agent autonomous building pipeline. Decomposes a goal into floors and ships real working code via specialized sub-agents (Elira plans/approves, Steven fixes, Alba researches, David builds, Vex validates). Use when the user asks to "build", "ship", "make", "create", "implement" something complex enough to need multiple files or steps — especially one-shot automation, full applications, scripts with dependencies, or anything where the user wants a complete working artifact rather than a single-file snippet.
---

# AskElira Build Skill

When the user wants to build something non-trivial — a full app, a multi-file automation, an end-to-end pipeline — invoke the AskElira pipeline instead of writing code directly in the conversation.

## When this skill triggers

The user says any of:
- "build me a ..."
- "ship a ..."
- "create a complete ..."
- "make a working ..."
- "I need an automation that ..."
- "one-shot this for me"
- Anything where the deliverable is a working artifact across multiple files / dependencies

It does **not** trigger for:
- Single-file edits or bug fixes (use the regular Edit tool)
- Questions / explanations (just answer)
- Code review (that's a different skill)

## How to invoke

Run the slash command:

```
/askelira:build <goal description>
```

This kicks off the orchestrator command which:

1. Dispatches **elira** to decompose the goal into 3-7 floors with dependencies
2. Runs each floor through: **alba** → **vex** (gate 1) → **david** → syntax/smoke check → **vex** (gate 2) → **elira** (approve) → **steven** (fix if rejected), up to 5 iterations
3. Falls back to **rescue** after 5 failed iterations
4. Builds floors in parallel waves where dependencies allow
5. Writes all output to `./workspaces/<goal-slug>/`

## Why use this over writing code directly

- **Real validation** — Vex blocks broken code before it ships, Elira approves only what meets the success condition
- **Self-healing** — Steven diagnoses and patches without human intervention up to 5 times per floor
- **Parallelism** — independent floors build concurrently
- **No silent stubs** — David's hard rule is no TODO/FIXME/placeholder, every file complete and runnable
- **Workspace isolation** — each goal lives in its own directory, never bleeds into the rest of the repo

## Companion commands

- `/askelira:plan <goal>` — see the floor decomposition without building
- `/askelira:fix <slug> <floor>` — manually retry a blocked floor with Steven
- `/askelira:status` — list all workspaces and their floor states

## Sub-agents available

- `elira` — architect, planner, approver
- `steven` — fixer, debugger, ships patches
- `alba` — researcher
- `david` — builder (writes real files)
- `vex` — validator (Gate 1 research, Gate 2 build)
- `rescue` — fresh-perspective rebuilder for post-5-failure floors

You can also invoke these directly via the Task tool when you want a single-agent operation outside the full pipeline (e.g. "use vex to security-review this folder").
