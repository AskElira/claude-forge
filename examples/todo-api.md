# Example — Building a Todo REST API

A walk-through of what running `/claude-forge:build` looks like end to end.

## Invocation

```
/claude-forge:build a REST API for a todo app with Express, SQLite, JWT auth, and Jest tests
```

## What happens

### Step 0 — Plan

Orchestrator dispatches `elira` in PLAN mode. Elira returns:

```json
[
  {
    "name": "Project scaffold",
    "description": "package.json, .gitignore, project structure",
    "successCondition": "npm install runs cleanly, all dirs exist",
    "deliverable": "package.json with express, better-sqlite3, jsonwebtoken, jest pinned. Standard src/, tests/, README.md skeleton.",
    "dependsOn": []
  },
  {
    "name": "Database layer",
    "description": "SQLite schema and query helpers for users + todos",
    "successCondition": "src/db.js exports getUserByEmail, createUser, listTodos, createTodo, deleteTodo. Tables auto-create on first call.",
    "deliverable": "src/db.js with schema migration on import",
    "dependsOn": [1]
  },
  {
    "name": "JWT auth middleware",
    "description": "POST /auth/register, POST /auth/login, requireAuth middleware",
    "successCondition": "Passwords hashed via bcrypt. JWT signed/verified with HS256. requireAuth attaches req.user.",
    "deliverable": "src/auth.js + src/middleware/requireAuth.js",
    "dependsOn": [2]
  },
  {
    "name": "Todo routes",
    "description": "CRUD endpoints scoped to req.user",
    "successCondition": "GET/POST/DELETE /todos all require auth, all scope by user_id, all return JSON.",
    "deliverable": "src/routes/todos.js mounted at /todos",
    "dependsOn": [3]
  },
  {
    "name": "Server entry + Jest tests",
    "description": "Express app wiring + integration tests covering auth + todos round-trip",
    "successCondition": "npm test passes. npm start binds 3000 and serves health check.",
    "deliverable": "src/server.js + tests/auth.test.js + tests/todos.test.js",
    "dependsOn": [3, 4]
  }
]
```

### Step 1 — Build waves

Wave 1: floor 1 (no deps).
Wave 2: floor 2.
Wave 3: floor 3.
Wave 4: floor 4.
Wave 5: floor 5 (depends on 3 + 4).

Each wave runs its floors in parallel via `Task` tool calls.

### Step 2 — Per floor

Take floor 3 (JWT auth) as a worked example.

**Iteration 1:**
- `alba` returns research: bcrypt vs argon2, jsonwebtoken vs jose, where to store secret, refresh-token consideration. Recommends jsonwebtoken + bcryptjs for simplicity, single access token (no refresh) given scope.
- `vex` Gate 1 → score 78, valid. Notes "missing token expiry recommendation" → enriched.
- `david` writes `src/auth.js` (register, login, password hashing, JWT sign) and `src/middleware/requireAuth.js`. Returns build summary.
- Bash runs `node --check src/auth.js` → pass.
- `vex` Gate 2 → score 71, valid. One issue: "JWT secret falls back to a hardcoded string if env var missing." Captured in feedback for next iteration.
- `elira` APPROVE → `approved: false`, fixes: `["src/auth.js: throw at import if process.env.JWT_SECRET is unset, do not fall back to a hardcoded value"]`.

**Iteration 2:**
- `steven` reads src/auth.js, identifies the fallback, edits to throw on missing env var. Returns fix summary.
- Bash re-runs `node --check`.
- `vex` Gate 2 → score 84, valid.
- `elira` APPROVE → `approved: true`. Floor 3 → LIVE.

### Step 3 — Report

After all 5 floors land, orchestrator writes `./workspaces/rest-api-todo-app/.claude-forge/report.md`:

```
# Build Report — REST API for a todo app

Goal: a REST API for a todo app with Express, SQLite, JWT auth, and Jest tests
Status: COMPLETE — 5/5 floors LIVE

| Floor | Name                       | Status | Iterations |
|-------|----------------------------|--------|------------|
| 1     | Project scaffold           | LIVE   | 1          |
| 2     | Database layer             | LIVE   | 1          |
| 3     | JWT auth middleware        | LIVE   | 2          |
| 4     | Todo routes                | LIVE   | 1          |
| 5     | Server entry + Jest tests  | LIVE   | 2          |

## File tree
src/
  server.js
  db.js
  auth.js
  middleware/requireAuth.js
  routes/todos.js
tests/
  auth.test.js
  todos.test.js
package.json
.gitignore
README.md

## Next
cd workspaces/rest-api-todo-app
npm install
npm test
npm start
```

That's the full loop. Same mechanism as the original AskElira3 Hermes pipeline, but the runtime is Claude Code itself — now shipped as the Claude Forge plugin.
