# Claude Forge — Claude Code Plugin

Multi-agent autonomous building pipeline for Claude Code. Describe a goal, Claude Forge decomposes it into floors and ships real working code. Reimplemented from the original [AskElira/AskElira3](https://github.com/AskElira/AskElira3) Node prototype as native Claude Code sub-agents — no separate Hermes runtime, no Node infrastructure, no SQLite. The Claude Agent SDK is the runtime.

## What it does

You say:

```
/claude-forge:build a REST API for a todo app with SQLite, JWT auth, and tests
```

Claude Forge:

1. **Elira** decomposes the goal into 3-7 floors with dependencies
2. For each floor (in dependency-aware parallel waves):
   - **Alba** researches the floor (libraries, patterns, current docs)
   - **Vex Gate 1** validates the research is sufficient
   - **David** writes real files into `./workspaces/<slug>/`
   - Syntax + smoke check (`node --check`, `python3 -m py_compile`)
   - **Vex Gate 2** validates the build
   - **Elira** approves or rejects
   - If rejected, **Steven** diagnoses + patches, loops back to Vex (max 5 iterations)
   - After 5 failures, **Rescue** rebuilds with a simpler approach
3. Reports LIVE / BLOCKED status per floor + writes a summary

All file writes happen through Claude Code's native tools (`Write`, `Edit`, `Bash`). Sub-agents are real Claude Code sub-agents in `agents/`. Slash commands are real Claude Code slash commands in `commands/`. No external runtime.

## Install

### Method 1 — Claude Code marketplace (recommended)

```
/plugin marketplace add AskElira/claude-forge
/plugin install claude-forge@claude-forge-marketplace
```

### Method 2 — Clone into your project

```bash
git clone https://github.com/AskElira/claude-forge .claude/plugins/claude-forge
```

Then reload Claude Code (`/reload` or restart). The plugin's agents, commands, and skill will appear automatically.

### Method 3 — Per-user install

Drop the cloned folder into `~/.claude/plugins/claude-forge/` to use across all your projects.

## Use it

```
/claude-forge:build a Python CLI that scrapes Hacker News top stories and emails them daily
```

```
/claude-forge:plan a Next.js dashboard with Supabase auth and Stripe billing
```

```
/claude-forge:fix workspaces/my-goal-slug 3 "the API returns 500 on /todos POST"
```

```
/claude-forge:status
```

## Pipeline diagram

```
Goal
 │
 ▼
Elira plans floors  ──►  3-7 floors with dependsOn
 │
 ▼
Build waves (parallel where deps allow)
 │
 ▼ per floor (max 5 iterations):
 │
 │   Alba research ─► Vex Gate 1 ─► David build
 │                                      │
 │                                      ▼
 │                          Syntax + smoke check
 │                                      │
 │                                      ▼
 │                                 Vex Gate 2
 │                                      │
 │                                      ▼
 │                                Elira approve?
 │                                  ┌──┴──┐
 │                                YES    NO
 │                                  │     │
 │                                LIVE   Steven patches ─► loop
 │                                              │
 │                                          (after 5)
 │                                              ▼
 │                                          Rescue rebuilds
 │                                              ▼
 │                                      Elira final review
 │                                              │
 │                                       LIVE or BLOCKED
```

## File layout

```
claude-forge/
├── .claude-plugin/
│   ├── plugin.json          # plugin metadata
│   └── marketplace.json     # for git-based marketplace install
├── agents/
│   ├── elira.md             # architect, planner, approver
│   ├── steven.md            # fixer, debugger
│   ├── alba.md              # researcher
│   ├── david.md             # builder (writes real files)
│   ├── vex.md               # validator (two gates)
│   └── rescue.md            # fresh-perspective rebuilder
├── commands/
│   ├── build.md             # /claude-forge:build — full pipeline
│   ├── plan.md              # /claude-forge:plan — preview floors
│   ├── fix.md               # /claude-forge:fix — manual Steven
│   └── status.md            # /claude-forge:status — list workspaces
├── skills/
│   └── claude-forge-build/
│       └── SKILL.md         # auto-trigger when user asks to "build"
├── examples/
│   └── todo-api.md          # sample run-through
├── CLAUDE.md                # project guidelines (loaded into context)
├── LICENSE
└── README.md
```

## Agents

| Agent  | Role                                              | Model  |
|--------|---------------------------------------------------|--------|
| elira  | Plans goals → floors. Approves or rejects builds. | opus   |
| steven | Diagnoses failures. Writes patches. Runs setup.   | opus   |
| alba   | Researches floor requirements + library APIs.     | sonnet |
| david  | Writes real, complete, runnable code files.       | sonnet |
| vex    | Validates research (Gate 1) and builds (Gate 2).  | sonnet |
| rescue | Rebuilds from scratch after 5 failed iterations.  | opus   |

You can also call any agent directly with the `Task` tool:

```
Use the alba sub-agent to research GraphQL subscriptions in Apollo Server v4.
```

## How it differs from the original AskElira3

| AskElira3 (Node app)                  | Claude Forge (Claude plugin)             |
|---------------------------------------|------------------------------------------|
| Hermes is a custom LLM orchestrator   | Claude Code IS the orchestrator          |
| SQLite stores goals/floors/logs       | Workspace + JSON files store state       |
| Express dashboard at localhost:3000   | Use Claude Code's built-in UI / chat     |
| Custom LLM client with retries        | Claude Code handles model calls          |
| Circuit breakers, watchdogs           | Claude Code's existing timeouts          |
| Agents are JS modules                 | Agents are Markdown sub-agent files      |
| `npm start && askelira3 "<goal>"`     | `/claude-forge:build <goal>`             |

The **mechanism** is identical. The infrastructure is gone — Claude Code already provides everything Hermes had to build from scratch.

## Hard rules

These are enforced by every agent's system prompt. They are not suggestions.

1. No stubs. No TODO, FIXME, placeholder. Every file ships complete and runnable.
2. JSON-only outputs from sub-agents. One document per response.
3. Workspace boundary. No agent writes outside its goal's workspace.
4. Approval is final. Elira's verdict ends the iteration loop.
5. Bias toward passing. Vex blocks only on real blocking issues.
6. 5-iteration cap per floor, then Rescue, then BLOCKED.

## License

MIT. See [LICENSE](LICENSE).

## Credits

Reimplemented from [AskElira/AskElira3](https://github.com/AskElira/AskElira3). Inspired by [forrestchang/andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills).
