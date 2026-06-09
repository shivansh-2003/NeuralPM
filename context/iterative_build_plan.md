# NeuralPM — Iterative Build Plan

> **Rule:** Every iteration ends with a working, testable system. Never move to the next iteration until the current one passes its gate. Each gate is a demo you can actually run — not just "code compiles."

---

## The Build Spine

```
I-0  Infrastructure + Pipe
  ↓
I-1  Memory Agent: Ingest + Chat         ← first working demo
  ↓
I-2  Adaptive Forgetting                 ← memory becomes intelligent
  ↓
I-3  Assignment Agent: Score + Suggest   ← first operational agent
  ↓
I-4  Assignment Preference Learning      ← agent learns from manager
  ↓
I-5  Risk Agent: Detect + Emit           ← second operational agent
  ↓
I-6  Cascade Agent: Propagate + Simulate ← third operational agent
  ↓
I-7  Risk + Cascade Preference Learning  ← all agents learn
  ↓
I-8  Cross-Agent Intelligence            ← closed-loop system
  ↓
I-9  Polish + Demo Hardening             ← presentation-ready
```

---

## Iteration 0 — Infrastructure + Pipe

**What you're doing:** Stand up all services, verify the core memory pipe end-to-end. Nothing works without this. Do not write any graph or node code until this passes.

### Build checklist

**Step 1 — Docker Compose**
```yaml
# backend/docker-compose.yml
services:
  qdrant:   image: qdrant/qdrant:v1.12.4   ports: ["6333:6333"]
  falkordb: image: falkordb/falkordb:latest ports: ["6379:6379"]
```
```bash
docker compose up -d
curl localhost:6333/collections   # must return {"result":{"collections":[]}}
docker exec neuralpm-falkordb falkordb-cli PING  # must return PONG
```

**Step 2 — Postgres**
```bash
createdb neuralpm
psql neuralpm < schema.sql   # all tables: tasks, members, memory_events,
                              # user_preference_memory, task_dependencies,
                              # milestones, risk_log, cascade_log, assignment_history
```

**Step 3 — Ollama models**
```bash
ollama pull qwen3:8b
ollama pull qwen3-embedding:0.6b
ollama pull qwen2.5vl:7b

# Verify embedding dims — MUST match EMBED_DIMS in .env
curl http://localhost:11434/api/embed \
  -d '{"model":"qwen3-embedding:0.6b","input":"test"}' | \
  python3 -c "import json,sys; print(len(json.load(sys.stdin)['embeddings'][0]))"
# → 1024
```

**Step 4 — `config.py`**
```python
# register() FIRST — before any mem0 import
from mem0_falkordb import register
register()
# Then: Settings, get_mem0_client(), get_llm() as per memory_agent_technical.md §1
```

**Step 5 — Install dependencies**
```bash
pip install mem0ai[graph]>=1.0.0 mem0-falkordb>=0.1.0 falkordb>=1.0.0 \
            qdrant-client==1.12.1 langgraph==0.2.60 \
            langchain-ollama==0.2.2 langchain-core==0.3.40 \
            pydantic==2.10.4 pydantic-settings==2.7.1 \
            fastapi==0.115.6 uvicorn[standard]==0.34.0 \
            celery>=5.0 redis>=5.0 psycopg2-binary httpx
```

### Files to create
```
backend/
├── docker-compose.yml
├── schema.sql
├── .env  (copy from .env.example, fill in values)
├── requirements.txt
├── memory_agent/
│   ├── __init__.py
│   └── config.py
├── db.py              (get_pg_conn() singleton)
├── test_pipe.py
└── test_graph.py
```

### Gate — must pass before I-1

```bash
python test_pipe.py
# ✅ add → Qdrant stores vector
# ✅ search → returns the memory with correct project_id isolation
# ✅ project beta returns 0 memories

python test_graph.py
# ✅ add → FalkorDB creates entity graph
# ✅ search → returns relations[] alongside results[]
# ✅ direct FalkorDB query shows nodes
```

---

## Iteration 1 — Memory Agent: Ingest + Chat

**What you're building:** The full memory loop. A PM can type a requirement → it gets classified, extracted, embedded, and stored. Then ask a question → get a grounded answer with memory citations. This is the core that every other agent wraps.

### Build order (strict — each step blocked by previous)

**Step 1 — Pydantic schemas**
```
memory_agent/schemas/requirement.py
  ClassifyResult, RequirementEvent
```

**Step 2 — Ingestion nodes** (build + test each in isolation before wiring)
```
memory_agent/nodes/memory/classify.py    → test: classify("Users can pay via Stripe")
                                            → {"type": "requirement_update", "confidence": 0.9}
memory_agent/nodes/memory/extract.py     → test: extract the classify output
                                            → RequirementEvent(description=..., criteria=[...])
memory_agent/nodes/memory/store.py       → test: store a RequirementEvent
                                            → {"store_result": {"status": "stored", "graph_relations": N}}
```
> Test each node by calling it directly with a mock state dict before wiring the graph.

**Step 3 — Ingestion graph**
```
memory_agent/graphs/ingestion.py
  classify → [if requirement_update] extract → store → END
           → [casual_chat] END

POST /memory/ingest {"raw_text": "...", "project_id": "alpha", "user_id": "alice"}
```
Test with 3 inputs:
- A real requirement → stored
- "hey team, standup at 10" → classified as casual_chat, NOT stored
- Ambiguous text → check classification confidence

**Step 4 — Chat nodes**
```
memory_agent/nodes/memory/retrieve.py
  → m.search(query, filters={"user_id":..., "project_id":..., "memory_tier": {"in": ["active","compressed"]}})
  → blended ranking: 0.5×cosine + 0.3×relevance_score + 0.2×recency

memory_agent/nodes/memory/allocate_context.py
  → token budget allocator (8192 ceiling, 5 slices)

memory_agent/nodes/memory/synthesize.py
  → Qwen3:8b, reasoning=False, cites [mem_id] and [graph] tags

memory_agent/nodes/memory/autopsy.py
  → LOADED / FILTERED_OUT / BUDGET / GRAPH sections
```

**Step 5 — Chat graph**
```
memory_agent/graphs/chat.py
  retrieve → allocate_context → synthesize → autopsy → END

POST /memory/chat {"query": "...", "project_id": "alpha", "user_id": "alice"}
```

**Step 6 — FastAPI + minimal frontend**
```
api/memory.py     → POST /memory/ingest, POST /memory/chat
api.py            → app + CORS + router
frontend/
  IngestForm.jsx  → textarea + project_id + "Ingest" button
  ChatPanel.jsx   → textarea + "Ask" button + answer display
  MemoryAutopsy.jsx → expandable panel below answer
```

### Gate — must pass before I-2

```
Demo flow:
  1. Ingest 5 requirements about different modules
  2. Ask "what are the payment requirements?"
     → Answer cites correct [mem_id] values
     → answer does NOT mention auth requirements (project-scoped)
  3. Expand Autopsy panel
     → Shows LOADED memories with scores
     → Shows FILTERED_OUT if any
     → Shows token budget breakdown
  4. Ingest same requirement twice (supersession test — manual for now)
     → Both appear in Qdrant (supersession comes in I-2)
  5. FalkorDB graph check:
     docker exec neuralpm-falkordb falkordb-cli GRAPH.QUERY mem0_alice \
       "MATCH (a)-[r]->(b) RETURN a.name, type(r), b.name LIMIT 10"
     → Shows entities extracted from your requirements
```

---

## Iteration 2 — Adaptive Forgetting

**What you're building:** The memory gets smarter over time — old events decay, overridden ones collapse immediately, compressed summaries replace full text. The Autopsy panel's "FILTERED OUT" section becomes meaningful.

### Build order

**Step 1 — Celery + Redis setup**
```
celery_app.py     → Celery(broker="redis://localhost:6379/1")
                     beat_schedule with 3 jobs

# Start workers (two terminals)
celery -A celery_app worker --loglevel=info
celery -A celery_app beat   --loglevel=info
```

**Step 2 — Decay algorithm**
```
celery_tasks/decay.py
  rescore_event(event, now)  → (new_score, new_tier)
    - superseded → 0.05 immediately
    - age > 365d → archived, score × 0.5
    - age > 90d  → compressed
    - else       → disuse decay 1–10%

  run_decay_cycle()
    - SELECT all non-archived from memory_events
    - rescore each
    - UPDATE Postgres
    - qdrant.set_payload() on each (direct qdrant_client, NOT via mem0)
```

**Step 3 — Instant supersession**
```
celery_tasks/decay.py
  supersede(old_event_id, new_event_id)
    - Postgres: SET superseded_by=new, relevance_score=0.05
    - Qdrant:   set_payload({relevance_score: 0.05, superseded_by: new})
    - Called synchronously from store_node when parent_requirement_id is set
```

**Step 4 — LLM compression job**
```
celery_tasks/decay.py
  run_compression_job()
    - SELECT memory_events WHERE tier='compressed' AND description NOT LIKE '[compressed]%'
    - Qwen3:8b one-sentence summary
    - UPDATE description + qdrant.set_payload(compressed_description)
```

**Step 5 — Demo acceleration controls**
```
# In .env: DECAY_CYCLE_SECONDS=300  (5-min in demo)
# In API: POST /demo/advance-age {"days": 95, "project_id": "alpha"}
#   → UPDATE memory_events SET timestamp = timestamp - interval '95 days'
#   → run_decay_cycle() immediately
#   → Makes forgetting visible without waiting real time
```

### Gate — must pass before I-3

```
Demo flow:
  1. Ingest 3 requirements. Confirm relevance_score=1.0 in Postgres.
  2. POST /demo/advance-age {"days": 95}
     → Run decay cycle
     → Check: tier changed to 'compressed' for events > 90 days
     → Check: Qdrant payload updated
  3. POST /demo/advance-age {"days": 370}
     → Check: tier = 'archived', relevance_score ≈ 0.5
  4. Ingest "Stripe payment updated to use saved cards" (same module as old req)
     → Mark old as superseded: supersede(old_id, new_id)
     → Check: old relevance_score = 0.05 in both Postgres and Qdrant
  5. Ask chatbot "what are the payment requirements?"
     → Autopsy shows old superseded memory in FILTERED_OUT with reason "superseded"
     → Answer reflects only the new requirement
```

---

## Iteration 3 — Assignment Agent: Score + Suggest

**What you're building:** The first operational agent. A manager clicks "Find Best Match" on any task and gets a ranked shortlist of 3 engineers with per-factor scores.

### Build order

**Step 1 — Postgres seed data**
```sql
-- Seed tasks table with 5-10 tasks
-- Seed members table with 4-5 members with different skills, loads, velocities
INSERT INTO tasks ...
INSERT INTO members ...
```

**Step 2 — Pydantic schemas**
```
memory_agent/schemas/assignment.py
  RequiredSkill, MemberSkill, TaskContext, MemberContext,
  FactorScores, Candidate, AssignmentOutput, AssignmentState
```

**Step 3 — Scoring functions** (test each in isolation)
```
scoring/skill_match.py    → test: Python dev + Python task = high score
scoring/workload.py       → test: 95% load = ~5 pts, 0% load = 100 pts
scoring/velocity.py       → test: 2× team avg = 100 pts
scoring/context_affinity.py → test: FalkorDB shows ASSIGNED_TO payment = high affinity
```

**Step 4 — Assignment nodes**
```
nodes/assignment/fetch_task.py
nodes/assignment/fetch_members.py
nodes/assignment/query_memory.py   → mem0 search for assignment history + FalkorDB ASSIGNED_TO
nodes/assignment/score.py          → 4 factors → blended score → Qwen3 rationale
nodes/assignment/output.py         → top 3 candidates
```
Test each node with mock state before wiring.

**Step 5 — Assignment graph (suggest mode only)**
```
graphs/assignment.py
  START → fetch_task → fetch_members → query_memory → score → apply_preference → output → log → END

# apply_preference just returns state unchanged in I-3 (preference learning in I-4)
```

**Step 6 — Log node** (writes to memory layer)
```
nodes/assignment/log_node.py
  → embed_text: "Assigned {task} to {member}. Score: {blended}/100. ..."
  → mem0.add(embed_text, user_id=manager_id, metadata={...})
  → Postgres INSERT assignment_history
```

**Step 7 — FastAPI + UI**
```
api/assignment.py     → POST /assignment/suggest
frontend/
  TaskTable.jsx        → task list with "Find Best Match" button
  AssignmentPanel.jsx  → side panel: 3 cards, per-factor bars, rationale, "Assign" button
```

### Gate — must pass before I-4

```
Demo flow:
  1. Open Task Command Center → see task list
  2. Click "Find Best Match" on "Payment API" task
     → Panel opens with 3 candidates
     → Sarah shown with skill_match=98 (has Stripe:5), scores all visible
     → Bob shown with lower skill score, higher workload
  3. Click "Assign" on Sarah
     → Task table updates assignee
     → POST /assignment/feedback fires with was_override=false
  4. In FalkorDB:
     GRAPH.QUERY mem0_alice "MATCH (s {name:'Sarah'})-[:SUGGESTED]->(t) RETURN t.name"
     → Shows the assignment event was captured
  5. Ingest a new requirement for payment module
  6. Click "Find Best Match" on another payment task
     → Sarah scores higher on context_affinity (FalkorDB shows recent ASSIGNED_TO)
```

---

## Iteration 4 — Assignment Preference Learning

**What you're building:** The agent learns from the manager's override pattern. After 3-5 consistent overrides, the preferred engineer gets re-ranked to #1 automatically.

### Build order

**Step 1 — `user_preference_memory` table** (already in schema from I-0)
Verify it exists. No new schema needed.

**Step 2 — `write_evidence_node`**
```
nodes/assignment/write_evidence.py
  → Called by POST /assignment/feedback (not in the graph)
  → Upsert user_preference_memory
  → confidence = consistency_rate × (1 − 1/(1 + evidence_count))
  → Learning Mode shortcut: seed confidence=0.7 on "new pattern"
```

**Step 3 — `apply_preference_node`** (replace the stub from I-3)
```
nodes/assignment/apply_preference.py
  → Fetch preferences with confidence > 0.6
  → Arbitrate if multiple apply (higher confidence wins, ties by last_observed)
  → Apply boost: 1.0 + (conf - 0.6) × 0.625  (1.0–1.25 range)
  → Re-sort candidates
  → Set preference_disclosure string
```

**Step 4 — Feedback endpoint**
```
api/assignment.py
  POST /assignment/feedback
  → Calls write_evidence_node
  → Returns {evidence_written, new_confidence, crossed_threshold}
```

**Step 5 — Learning Mode toggle**
```
# .env: LEARNING_MODE_ENABLED=false (opt-in per manager)
# POST /assignment/feedback with learning_mode=true, new_pattern_confirmed=true
#   → seeds confidence=0.7 immediately
```

**Step 6 — System Learning Panel (partial)**
```
frontend/InsightsWarRoom/LearningPanel.jsx
  → Preference Registry: table of all preferences with confidence, evidence_count
  → Override Rate graph (simple line chart — overrides / total per week)
```

### Gate — must pass before I-5

```
Demo flow (the cross-session learning sequence):
  Session A:
    1. "Find Best Match" for Payment API → Bob ranked #1 (raw skill)
    2. Override to Sarah → POST /assignment/feedback {was_override: true}
    3. Check user_preference_memory: evidence_count=1, confidence≈0.50

  Session B (or immediately after 3-4 more overrides):
    4. "Find Best Match" for Refunds API (also backend/payment)
    5. Sarah now ranked #1 with preference_applied=true
    6. Disclosure shown: "You usually assign backend/payment tasks to Sarah (74%)"
    7. Manager approves → confidence increases further

  Learning Mode test:
    8. Enable Learning Mode toggle
    9. Override once for a new task type
    10. Prompt: "One-time exception or new pattern?"
    11. Click "New pattern"
    12. Next suggestion for same type already re-ranked
```

---

## Iteration 5 — Risk Agent: Detect + Emit

**What you're building:** The risk radar. Celery Beat continuously scans for stale tasks, overloaded members, deadline risks, and blocker chains. Results appear in the Risk Radar panel via WebSocket. Manager can suppress/escalate by category.

### Build order

**Step 1 — Postgres: `risk_log` table** (already in schema)
Add some test tasks with varied states (stale, approaching deadline, overloaded member).

**Step 2 — Detection algorithms** (build + test each in isolation)
```
risk_detectors.py
  detect_stale(tasks)       → test: task with last_updated 5 days ago → high severity
  detect_overload(members)  → test: member at 92% → critical
  detect_deadline_risks(tasks) → test: due tomorrow with blockers → critical
  detect_blocker_chains(tasks) → test: task A blocks B + C → high severity
```

**Step 3 — Risk nodes**
```
nodes/risk/fetch_state.py          → Postgres: active tasks + member loads + dependency chains
nodes/risk/detect_risks.py         → calls all 4 detectors, sorts by type+severity
nodes/risk/apply_risk_tolerance.py → stub (pass-through for now, preference in I-7)
nodes/risk/emit.py                 → WebSocket broadcast to /ws/{project_id}
nodes/risk/log_node.py             → mem0.add() + Postgres risk_log INSERT
```

**Step 4 — WebSocket manager**
```
websocket_manager.py
  ConnectionManager: connect, disconnect, broadcast
  /ws/{project_id} endpoint in FastAPI
```

**Step 5 — Risk graph + Celery Beat trigger**
```
graphs/risk.py
  START → fetch_state → detect_risks → apply_risk_tolerance → emit → log → END

celery_app.py
  beat_schedule["risk-scan"] = {"task": "run_risk_scan", "schedule": 300}

tasks.py
  @celery.task run_risk_scan()
    → for each active project: risk_graph.invoke({project_id, manager_id})
```

**Step 6 — Feedback endpoint**
```
api/risk.py
  POST /risk/scan      → manual trigger
  POST /risk/feedback  → resolve | acknowledge | dismiss
                       → calls write_evidence_node (stub in I-5, live in I-7)
```

**Step 7 — Risk Radar UI**
```
frontend/InsightsWarRoom/RiskRadar.jsx
  → Live risk cards (severity colour coding)
  → Each card: description, suggested_action, affected task/member
  → Action buttons: Resolve ✅  Acknowledge 👁️  Dismiss ❌
  → WebSocket connection to /ws/{project_id}
  → "Show suppressed" filter toggle (shows empty list in I-5, populated in I-7)
```

### Gate — must pass before I-6

```
Demo flow:
  1. Set member Sarah's active_points > 85% capacity in Postgres
  2. Set a task's last_updated to 5 days ago
  3. Set a task's due_date to tomorrow with a blocker
  4. Trigger: POST /risk/scan
     → Risk Radar panel shows 3 risk cards
     → Overload: Sarah at 92% (critical)
     → Stale: AuthLogin task (high)
     → Deadline: PaymentAPI (critical)
  5. WebSocket: change Sarah's load in DB → Celery Beat fires → new card appears live
  6. Click "Dismiss" on overload card
     → Card disappears from radar
     → POST /risk/feedback fires
     → risk_log updated with status='dismissed'
  7. Chatbot: "What risks have been flagged this week?"
     → Answer cites risk_flag memories from mem0
     → FalkorDB shows RiskAgent-[:FLAGGED]->Sarah
```

---

## Iteration 6 — Cascade Agent: Propagate + Simulate

**What you're building:** The timeline engine. When any deadline shifts or the Risk Agent detects a critical blocker, Cascade propagates the impact across all dependent tasks, detects milestone conflicts, and offers mitigation scenarios. What-If mode lets managers explore without committing.

### Build order

**Step 1 — Postgres: `task_dependencies` + `milestones` tables** (already in schema)
Seed task dependencies and at least one external milestone.

**Step 2 — Recursive CTE utility**
```
cascade_utils.py
  get_downstream_tasks(trigger_task_id, project_id)
    → WITH RECURSIVE downstream AS (...)
    → returns tasks ordered by depth
    → test: task A → B → C chain, trigger A, verify B and C returned
  add_working_days(start, days)
    → skips weekends
    → test: Friday + 3 days = next Wednesday
```

**Step 3 — Cascade nodes**
```
nodes/cascade/load_graph.py        → trigger task + downstream via CTE
nodes/cascade/propagate.py         → recalculate dates layer by layer
nodes/cascade/conflict.py          → compare revised dates vs milestones
nodes/cascade/apply_philosophy.py  → stub: returns all 4 scenarios in default order
nodes/cascade/emit.py              → WebSocket push: summary + scenarios
nodes/cascade/log_node.py          → mem0.add() timeline_shift + Postgres cascade_log
```

**Step 4 — Cascade graph**
```
graphs/cascade.py
  START → load_graph → propagate → conflict → apply_philosophy
          → [simulate=false] emit → log → END
          → [simulate=true]  simulate_end → END
```

**Step 5 — FastAPI trigger endpoint + auto-fire from task update**
```
api/cascade.py
  POST /cascade/trigger {task_id, project_id, manager_id, delay_days, simulate}
  POST /cascade/scenario-chosen {cascade_log_id, chosen_scenario, manager_id}

api/tasks.py
  POST /tasks/{id}  → if due_date changed → call cascade/trigger automatically
```

**Step 6 — Cascade Timeline UI**
```
frontend/InsightsWarRoom/CascadeTimeline.jsx
  → Notification toast: "Payment API +3d. 3 tasks affected."
  → Cascade View: before/after date table for each affected task
  → Conflict badges on affected tasks (⚠️ client demo at risk)
  → 4 scenario cards: Accept delay · Cut scope · Compress buffer · Add engineer
  → What-If controls: +1d / +3d / +5d buttons → instant preview, no commit
  → "Apply this scenario" button → commits to DB
```

### Gate — must pass before I-7

```
Demo flow:
  1. Edit PaymentAPI due_date + 3 days
     → POST /cascade/trigger fires automatically
     → WebSocket notification: "Payment API +3d. CheckoutFlow, Refunds, E2E affected."
     → Cascade Timeline panel opens
  2. View before/after: CheckoutFlow was July 20 → now July 27
  3. External milestone "Client Demo July 25" appears in conflict section
  4. What-If: click "+5d" button
     → New projection: E2E now July 31 (simulate=true, no DB write)
     → Click "+3d" → back to original projection
  5. Click "Accept delay" scenario → POST /cascade/scenario-chosen
     → DB updated with new dates
     → cascade_log shows before/after comparison
  6. Chatbot: "What changed in the payment timeline this week?"
     → Answer cites timeline_shift memory with before/after
     → FalkorDB: PaymentAPI-[:BLOCKS]->CheckoutFlow visible in graph
```

---

## Iteration 7 — Risk + Cascade Preference Learning

**What you're building:** The Risk Agent learns which categories to suppress before rendering (not after dismissal). The Cascade Agent learns the manager's preferred mitigation path. Both become more personalised with each decision.

### Build order

**Step 1 — Risk tolerance evidence writing** (replace stub from I-5)
```
nodes/risk/write_evidence.py (live version)
  → Track dismiss_counts / escalate_counts per risk_type
  → Auto-add to dismisses[] when dismiss_rate > 70%
  → Auto-add to escalates[] when escalate_rate > 70%
  → confidence = avg consistency across all seen risk types
```

**Step 2 — `apply_risk_tolerance_node`** (replace stub from I-5)
```
nodes/risk/apply_risk_tolerance.py (live version)
  → Fetch risk_tolerance preference (confidence > 0.6)
  → dismissed categories → severity="suppressed", move to suppressed_risks[]
  → escalated categories → severity="escalated"
  → suppressed risks NEVER deleted — always in suppressed_risks[] with reason
```

**Step 3 — Suppressed risk UI**
```
frontend/InsightsWarRoom/RiskRadar.jsx
  → "Show suppressed (N)" toggle button
  → Each suppressed card shows: reason + confidence + how many times dismissed
  → Suppression reason shown on hover in default view
```

**Step 4 — Timeline philosophy evidence writing** (replace stub from I-6)
```
nodes/cascade/write_evidence.py (live version)
  → Track chosen_scenario counts
  → Derive protects: "release_date" if scope_cut dominant
  → Derive buffers: "testing" if buffer scenario dominant
  → confidence = dominant choice rate × (1 − 1/(1 + evidence_count))
```

**Step 5 — `apply_philosophy_node`** (replace stub from I-6)
```
nodes/cascade/apply_philosophy.py (live version)
  → Fetch timeline_philosophy preference (confidence > 0.6)
  → Mark preferred scenario is_preferred=True
  → Sort preferred to top
  → Standard scenario always present regardless
```

**Step 6 — Learning Panel completion**
```
frontend/InsightsWarRoom/LearningPanel.jsx
  → Override Rate graph (all 3 agents: assignment + risk + cascade)
  → Confidence Growth chart per preference type
  → Preference Registry: all preferences editable/deletable
  → "Learning Mode" toggle per manager
```

### Gate — must pass before I-8

```
Demo flow — Risk tolerance learning:
  1. Dismiss "overload" risk cards 3 times across different scans
  2. Check user_preference_memory: dismiss_rate for overload > 70%
  3. Next risk scan → overload risks auto-suppressed before rendering
  4. Risk Radar shows "Show suppressed (1)" toggle
  5. Hover suppressed card → "Suppressed: Alice dismisses overload risks (conf 67%)"

Demo flow — Timeline philosophy learning:
  1. Choose "Cut scope" for 3 cascade events
  2. Check user_preference_memory: protects="release_date", confidence≈0.65
  3. Next cascade → "Cut scope" scenario card marked ★ and sorted first
  4. Disclosure: "Shown first because you typically protect the release date"
```

---

## Iteration 8 — Cross-Agent Intelligence

**What you're building:** The agents stop working in silos. Risk Agent fires Cascade Agent. Assignment Agent uses Memory Agent's FalkorDB graph for context affinity. All agents contribute to shared causal chains in FalkorDB. The closed-loop system is complete.

### Build order

**Step 1 — Risk → Cascade trigger**
```
nodes/risk/log_node.py  (add after logging)
  → if any detected risk has type="blocker_chain" and severity="critical":
      POST /cascade/trigger {
        task_id: risk.affected_task.id,
        project_id: state["project_id"],
        manager_id: state["manager_id"],
        delay_days: estimate_delay(risk),
      }
```

**Step 2 — Assignment → Memory context**
```
nodes/assignment/query_memory.py  (enrich)
  → Already queries mem0 for assignment history ✓
  → Also query FalkorDB directly for module affinity:
      MATCH ({name: $member_name})-[:ASSIGNED_TO]->(t {module: $module})
      RETURN count(t) as recent_count
  → Feed recent_count into context_affinity scoring
```

**Step 3 — Causal chain formation**
```
# Each agent's embed_text should explicitly state causal links:

# Assignment Agent log_node:
embed_text = f"'{task.title}' assigned to {member.name}. This followed the "
             f"{task.affected_module} requirement update in sprint {task.sprint_id}."

# Risk Agent log_node:
embed_text = f"Overload risk for {member.name} detected after assignment of "
             f"'{task.title}'. Current load: {load}%."

# Cascade Agent log_node:
embed_text = f"'{trigger.title}' delayed {delay}d causing {len(downstream)} downstream "
             f"tasks to shift. Root cause: {risk_context_if_available}."
```
> Rich causal text → FalkorDB extraction LLM builds CAUSED_BY / DELAYED_BY edges automatically.

**Step 4 — Memory chatbot multi-turn**
```
memory_agent/graphs/chat.py
  → Add conversation_history to state (last 6 turns)
  → Pass recent_conversation budget slice
  → Store chat_turn events in memory_events for cross-session continuity
```

**Step 5 — Qwen2.5-VL file/image analysis**
```
memory_agent/nodes/memory/synthesize.py
  → If attachment in state: call qwen2.5vl:7b via Ollama /api/chat
  → Supports: PDF requirements, screenshot, whiteboard photo
frontend/MemoryChatbot/FileUpload.jsx
  → Drag-and-drop → base64 → POST /memory/chat {attachment: "..."}
```

### Gate — must pass before I-9

```
Demo flow — closed-loop:
  1. Ingest: "Stripe requirement updated to add 3DS authentication"
     → FalkorDB: Requirement-[:PART_OF]->PaymentModule
  2. Find Best Match for "Payment 3DS task"
     → Sarah ranked #1 (FalkorDB shows recent payment module context)
  3. Assign Sarah (she's now at 87% load)
  4. Celery Risk scan fires
     → Overload risk detected (Sarah 87%)
     → NOT suppressed (first time, no preference yet)
     → Blocker chain detected: 3DS blocks Checkout + Refunds
     → Risk Agent fires Cascade Agent (blocker chain = Critical)
  5. Cascade Agent auto-runs
     → WebSocket: "3DS task is blocking 2 downstream tasks..."
  6. Chatbot: "Why is there a cascade risk on the payment module?"
     → Answer weaves all 4 events: requirement → assignment → overload → cascade
     → FalkorDB relations: Requirement-[:CAUSED]->OverloadRisk + PaymentTask-[:BLOCKS]->Checkout
     → Multi-turn: "What should we do?" → answer considers context from previous turn
  7. Upload PDF of sprint planning doc → chatbot extracts tasks from it
```

---

## Iteration 9 — Polish + Demo Hardening

**What you're building:** Everything that makes the demo compelling and robust. No new features — just making what exists presentation-quality.

### Build checklist

**Demo clock acceleration**
```
api/demo.py
  POST /demo/advance-age {"days": 95, "project_id": "..."}
  POST /demo/reset-project {"project_id": "..."}
  → Celery Beat cycle: 300s (5 min) — already set
```

**Memory Autopsy completeness**
- Every chatbot answer shows Autopsy by default (collapsible)
- FILTERED OUT block shows superseded memories with their superseded_by chain
- PREFERENCES APPLIED block shows which preferences shaped the answer
- Token budget visualisation (5-slice pie or bar chart)

**Risk Radar polish**
- Severity colour coding consistent (Critical=red, High=orange, Medium=yellow, Low=green, Escalated=purple)
- Suppressed risk hover tooltip with full suppression reason
- Risk card "Why flagged?" expandable reasoning panel

**Cascade Timeline polish**
- Visual dependency graph (not just table): task nodes with arrows
- Highlighted impact path (red nodes = affected by this cascade)
- What-If: animated date change when dragging

**Members Hub**
- Velocity trend chart (sparkline per member)
- Skill matrix visual (grid with proficiency colour coding)
- Current load bar with 85% overload threshold line

**Override rate graph**
- Line chart per agent (assignment / risk / cascade)
- Show downward trend as preferences mature
- Confidence growth bar chart per preference type

**Governance toggle**
```
# Settings page: Suggest Mode (default) vs Auto Mode
# Auto Mode: Assignment Agent executes assignment without approval
# All agents respect this toggle
```

### Final Gate — demo-ready system

```
End-to-end demo (10 minutes):

Minute 1-2: Memory loop
  → Ingest 3 requirements → chat "what's in payment scope?" → Autopsy shows 3 memories

Minute 3-4: Assignment
  → Find Best Match → Sarah ranked (preference applied) → Assign → evidence written

Minute 5-6: Risk + suppression
  → Advance age 4 days → Risk scan fires → 3 risk cards → dismiss overload → suppressed

Minute 7-8: Cascade + philosophy
  → Edit deadline → cascade fires → 3 scenarios → scope cut ★ (preference) → choose it

Minute 9-10: Learning visible
  → Learning Panel: override rate dropped → confidence growth → preference registry
  → Chatbot: "Summarise what happened this sprint" → full causal chain answer
```

---

## Cross-Iteration Dependency Map

```
I-0 (Infra)
  └─ I-1 (Memory Agent)
       └─ I-2 (Forgetting)
            └─ I-3 (Assignment: Score)
                 └─ I-4 (Assignment: Preferences)
                      └─ I-5 (Risk Agent)
                           └─ I-6 (Cascade Agent)
                                └─ I-7 (Risk+Cascade Preferences)
                                     └─ I-8 (Cross-Agent Intelligence)
                                          └─ I-9 (Polish)
```

**The golden rule:** Never skip an iteration. I-3 without I-2 means agents can't retrieve relevant historical context because decay isn't running. I-5 without I-4 means the risk radar can't be suppressed by learned preferences, which is a key differentiator.

---

## What You Can Show At Each Iteration Gate

| Iteration | Showable Demo |
|---|---|
| I-0 | "The pipe works" — add a memory, retrieve it, see it in FalkorDB |
| I-1 | "Type a requirement, ask about it" — full ingest → chat → autopsy loop |
| I-2 | "Memories forget intelligently" — advance age, watch tiers + scores change |
| I-3 | "Find Best Match works" — click button, see ranked shortlist with factor scores |
| I-4 | "It learned my preference" — override 3×, see re-ranking happen automatically |
| I-5 | "Risk radar is live" — stale task + overloaded member appear as cards in real time |
| I-6 | "Timeline cascade with What-If" — edit deadline, see all downstream dates shift |
| I-7 | "Suppression + scenario ordering" — overload cards auto-suppressed, preferred scenario ★ |
| I-8 | "Full closed loop" — requirement → assignment → overload → cascade → chatbot explains why |
| I-9 | "Polished product demo" — full 10-minute end-to-end |
