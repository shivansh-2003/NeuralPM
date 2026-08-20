# Memory Agent — Coherence Fixes

Findings from validating `memory_agent/` against the rest of `backend/` (domain-driven
Phase 0/0.5 app). Ordered by impact. Each item: what's wrong, why it matters, suggested fix.

---

## 1. Domain state changes never reach the memory layer

**Problem:** `domain/tasks/service.py::update_task` has a commented-out hook:

```python
# Future AI hook point: README's wiring says
# "if deadline changed or status -> blocked: POST /cascade/trigger".
# No-op today; the Cascade Agent plugs in here later with zero router/repo changes.
if due_date_changed or status_changed_to_blocked:
    pass  # TODO(agents/cascade): trigger_cascade(project_id, task_id)
```

This is a no-op, and even implemented it points at a future Cascade Agent trigger — not
memory ingestion. Creating a task, changing an assignee, a task going `blocked`, a
deadline shifting — none of it reaches `ingestion_graph`. The memory layer only knows
what's explicitly POSTed to `/memory/ingest`. A chat query like "why was the Payment
API deadline pushed?" only works if someone happened to type that sentence in manually.

**Fix:** After `repository.update()` in `domain/tasks/service.py::update_task`, build a
short natural-language description of what changed (title/status/due_date/assignee) and
call `ingestion_graph.invoke({...})` with `event_type` pre-set (skip `classify_node`,
go straight to `extract_node`/`store_node`, or just call `store_node` directly with a
constructed `RequirementEvent`/similar). Same pattern for `create_task`. Keep it
best-effort — a memory-write failure must never fail the task update (same posture
`store_node` already takes toward its own Postgres write).

**Effort:** small–medium. Touches `domain/tasks/service.py` only; no schema changes.

---

## 2. `project_id` / `user_id` aren't validated against real rows

**Problem:** Every other endpoint in the app types `project_id: UUID` and 404s via
`NotFoundError` if the project doesn't exist (`domain/tasks/router.py`,
`domain/projects/router.py`). `memory_agent`'s `IngestRequest`/`ChatRequest`
(`memory_agent/router.py`) type it as bare `str` with no existence check. You can
ingest memories for a project that was never created, or was deleted. (`test_pipe.py`/
`test_graph.py` use `"alpha"`/`"beta"` — not real UUIDs — which is fine for pipe
verification but means nothing in the codebase has ever exercised the real-UUID path.)

**Fix:**
- Change `project_id: str` → `project_id: UUID` in `memory_agent/router.py`'s
  `IngestRequest`/`ChatRequest`. `str(project_id)` when building mem0 metadata/filters
  (Qdrant payload is JSON, wants a string anyway).
- Optionally validate the project exists: `Depends(get_db)` + a cheap
  `domain.projects.repository` lookup, raising `NotFoundError` like every other router.
  Skip this if ingestion is meant to work for chat-only/no-project-yet flows — worth
  confirming intent before adding the check.

**Effort:** small.

---

## 3. `memory_events.task_id` / `member_id` are always NULL

**Problem:** `store_node`'s INSERT (`memory_agent/nodes/store.py`) only ever sets
`id, event_type, description, agent_source, metadata, timestamp, relevance_score,
memory_tier`. `task_id` and `member_id` — real columns on `memory_events` — are never
populated. Everything lives in the unstructured `metadata` JSONB blob instead
(`project_id`, `sprint_id` as loose strings, no `task_id`/`member_id` at all). You can't
SQL-join a memory back to the task/member it's actually about.

**Fix:** Extend `RequirementEvent` (`memory_agent/schemas/requirement.py`) with optional
`task_id: Optional[str]` / `member_id: Optional[str]`, thread them through
`extract_node`'s prompt/schema, and add them to the INSERT in `store_node`. Only worth
doing once fix #1 exists (task-change ingestion is the main source that would actually
know a real `task_id`/`member_id` — free-text chat ingestion mostly won't).

**Effort:** small, but sequence after #1.

---

## 4. Single shared `psycopg2` connection instead of a pool

**Problem:** `db.py` holds one process-wide `psycopg2` connection behind a
`threading.Lock`. Every `/memory/ingest` and `/memory/chat` call serializes on that lock.
Worse: if that connection ever lands in an aborted-transaction state (e.g. an
unhandled exception mid-transaction), every subsequent memory request fails until the
process restarts — there's no reconnect-on-error beyond checking `.closed`. The rest of
the app uses `core.db`'s pooled SQLAlchemy engine (`pool_pre_ping=True`, one session per
request via `Depends(get_db)`), which doesn't have this failure mode.

**Fix (pick one):**
- **Minimal:** wrap `get_pg_conn()`'s usage sites in a try/except that rolls back and
  reconnects on `psycopg2.errors.InFailedSqlTransaction` / `OperationalError`.
- **Better, more consistent:** drop `db.py` entirely and have `store_node`/`retrieve_node`
  take a short-lived connection from `core.db.engine.raw_connection()` per call (or a
  tiny connection-pool via `psycopg2.pool.ThreadedConnectionPool`), matching the
  per-request lifecycle the rest of the app already uses.

**Effort:** small (try/except) to medium (pool swap). Only matters under real concurrent
load — fine to defer if this stays single-user/local for now.

---

## 5. No realtime broadcast on ingest

**Problem:** `domain/tasks/service.py` calls `realtime.websocket_manager.broadcast(
project_id, {...})` on every task update, and `/ws/{project_id}` already exists
(`realtime/router.py`). Ingesting a memory or running a chat query broadcasts nothing —
a dashboard listening on that socket has no way to know new memory landed or that an
answer was produced.

**Fix:** In `memory_agent/router.py`'s `ingest()`, after a successful store, call
`realtime.websocket_manager.broadcast(req.project_id, {"type": "memory_stored", ...})`
— same one-line pattern already used in `domain/tasks/service.py::update_task`.

**Effort:** trivial.

---

## 6. `/search` doesn't see memory content

**Problem:** `search/router.py` only queries `domain.tasks.models.Task`. Memory content
(Qdrant vectors + FalkorDB graph) is a second, disconnected knowledge surface the
existing search endpoint never touches.

**Fix:** Either extend `search/router.py` to also hit `mem0_client.search(...)` scoped to
the request's project, or leave search and chat as intentionally separate surfaces (fast
literal search vs. semantic chat) — worth a product decision, not just a code fix.

**Effort:** small if you just want it merged in; this one's a judgment call first.

---

## 7. `preferences/` already built the table Phase 3 needs

**Not a bug — a head start.** `preferences/models.py` / `preferences/router.py`
(Phase 0.5) already has full storage + CRUD for `user_preference_memory`: exactly the
table the guide's "Phase 3 preferences agent" is meant to eventually populate for the
`allocate_context_node` `user_preferences` budget slice (currently hard-zeroed in
`memory_agent/nodes/allocate_context.py`). When Phase 3 gets built, wiring
`allocate_context_node` to read from `preferences.models.UserPreference` is smaller
than the guide implies — the schema and endpoints already exist.

**No action needed now** — just don't duplicate this table when Phase 3 starts.

---

## 8. Minor inconsistencies

- **Exception style:** `memory_agent/router.py` raises bare `HTTPException`. The rest of
  the app raises `NotFoundError`/`ConflictError` (`core/exceptions.py`) with handlers
  registered in `main.py`. Cosmetic, but worth matching if #2's existence-check gets added.
- **Auth:** `/memory/*` has none, but this isn't memory-specific — `get_current_user`
  (`core/auth.py`) is currently only wired into `domain/notifications/router.py` in the
  whole app. Fix as part of an app-wide auth pass, not a memory_agent-specific patch.

---

## Correctly out of scope right now

Per the Phase 1 guide's own roadmap — not gaps, just not built yet:
- Agents (Assignment/Risk/Cascade) writing into `memory_events` — Phase 2.
- Decay consuming `access_count`/`last_accessed`/`relevance_score` — Phase 1.5
  (bookkeeping already writes these; nothing reads them yet).
- Frontend chat UI calling `/memory/*` — confirmed zero references in `frontend/`.

---

## Suggested order

1. **#1** (task changes → memory) — the one that actually makes this feel like "the
   system's memory" instead of a chatbox nobody's connected to anything.
2. **#2** (`project_id` typing) — five-minute fix, closes the one type-safety hole in
   the app.
3. **#5** (realtime broadcast) — trivial, pairs naturally with #1.
4. **#3** (`task_id`/`member_id` columns) — do right after #1, since #1 is what would
   actually produce real IDs to put in them.
5. **#4** (connection pooling) — defer until concurrent load is a real concern.
6. **#6** (unified search) — product decision first, then small.
