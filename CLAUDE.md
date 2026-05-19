# Claude Forge — Multi-Agent Building Pipeline

This project ships the Claude Forge pipeline as a Claude Code plugin. When installed, the plugin provides 6 sub-agents and 4 slash commands that turn a goal description into shipped, validated, working code.

## Pipeline shape

```
Goal
 └─► Elira plans floors (3-7)
      └─► For each floor (in dependency-aware parallel waves):
           Alba research
            └─► Vex Gate 1 (research valid?)
                 └─► David builds real files
                      └─► Syntax check + smoke test
                           └─► Vex Gate 2 (build valid?)
                                └─► Elira approve / reject
                                     ├─ approve → LIVE
                                     └─ reject → Steven patches → loop back to Vex2 (max 5 iterations)
                                                                   └─ after 5: Rescue rebuilds → Elira final review
```

## Agent roles

| Agent  | Role                                  | Mode                                              |
|--------|---------------------------------------|---------------------------------------------------|
| Elira  | Architect, planner, approver          | PLAN at start, APPROVE per floor                  |
| Steven | Fixer, ships patches                  | Invoked when Elira rejects or runtime fails       |
| Alba   | Researcher                            | First step of every floor                         |
| David  | Builder (writes real files)           | After Vex Gate 1 passes                           |
| Vex    | Validator (two gates)                 | Gate 1: research. Gate 2: build.                  |
| Rescue | Fresh-perspective rebuilder           | Only after 5 failed iterations on the same floor  |

## Workspace conventions

- Each goal builds into `./workspaces/<goal-slug>/`
- Plan persisted at `<workspace>/.claude-forge/plan.json`
- Per-floor history at `<workspace>/.claude-forge/floor-<N>-history.json`
- Final report at `<workspace>/.claude-forge/report.md`
- Real source files live at the workspace root and standard subdirs (`src/`, `tests/`, etc.)

## Hard rules across all agents

1. **No stubs.** No TODO, FIXME, placeholder text, `pass`/`...` bodies. Every file ships complete.
2. **JSON-only outputs from sub-agents.** Each agent returns one JSON document. Malformed JSON → retry once with a strict-JSON reminder; after two failures it's a pipeline failure.
3. **Workspace boundary.** No agent writes outside the goal's workspace dir.
4. **Approval is final.** Elira's verdict ends the iteration loop. Steven and Rescue cannot bypass it.
5. **Bias toward passing.** Vex blocks only on real, blocking issues. Style and naming go in feedback, not in rejections.
6. **5-iteration cap.** Per floor. After 5 rejections, Rescue runs once. After Rescue + Elira reject, the floor is BLOCKED.

## Design intent (UI floors only)

If a floor produces frontend files, agents enforce:
- CSS custom properties (`var(--accent)`, `var(--panel)`) — never hardcoded hex
- `Inter` for prose, `JetBrains Mono` for data/code
- 3-layer elevation model: bg → surface → panel
- No drop shadows on dark backgrounds
- Status colors are semantic (gold = decision, red = broken, green = live, yellow = pending)

These rules are reproduced in `agents/david.md` and `agents/vex.md`.

## Slash commands

- `/claude-forge:build <goal>` — full pipeline
- `/claude-forge:plan <goal>` — preview floor decomposition only
- `/claude-forge:fix <slug> <floor>` — manual Steven retry on a blocked floor
- `/claude-forge:status` — list all workspaces + floor states

## When NOT to use this plugin

- Single-line edits, typo fixes, simple refactors → use the normal Edit tool
- "Explain this code" / "what does X do" → just answer
- Reviewing existing code → use a code-review skill, not this builder
