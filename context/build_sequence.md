# NeuralPM — Build Sequence & Concurrency Map

> Cross-referenced against `NeuralPM_Documentation.md` and `master_feature_list.md`.
>
> **Status key:**
> - 🟢 **Works now** — tool supports it natively, zero custom code
> - 🔵 **Wire** — connect existing tools, < 1 day
> - 🟡 **Build** — custom logic required, 1–3 days
> - 🔴 **Gate** — everything downstream is blocked until this passes

---

## The Fundamental Rule

```
Infrastructure → Memory Layer → Agents → Preferences → UI
     ↑               ↑              ↑           ↑        ↑
  sequential      sequential    concurrent   sequential  concurrent
  (hard gates)    (hard gates)  after base   after agents after API
```

Nothing in the agent layer can run until the memory layer is verified.
Nothing in the preference layer can run until agents write evidence.
Frontend can be built concurrently with backend from Phase 2 onward.

---

## Phase 0 — Infrastructure (Sequential, All Gates)

These are hard sequential gates. Nothing else starts until all pass.

| Step | Task | Status | Blocks |
|---|---|---|---|
| 0.1 | `docker compose up -d` — starts Qdrant :6333 + FalkorDB :6379 | 🟢 | All vector + graph work |
| 0.2 | `docker run postgres` — verify connection at :5432 | 🟢 | All structured data |
| 0.3 | `ollama pull qwen3:8b` — verify `ollama run qwen3:8b` responds | 🟢 | All LLM nodes |
| 0.4 | `ollama pull qwen3-embedding:0.6b` — verify `/api/embed` returns **1024** dims | 🟢 | All embedding |
| 0.5 | `ollama pull qwen2.5vl:7b` — verify image+text input works (requires Ollama ≥ 0.7.0) | 🟢 | Chatbot file analysis |
| 0.6 | Create Postgres schemas: `tasks`, `members`, `sprints`, `memory_events`, `user_preference_memory`, `task_dependencies`, `milestones`, `risk_log`, `cascade_log`, `assignment_history` | 🔵 | All agents |
| 0.7 | Create Qdrant collection `neuralpm_memories` with payload indexes on `project_id`, `memory_tier`, `event_type`, `user_id`, `relevance_score` | 🔵 | All vector search |
| 0.8 | FastAPI skeleton — `POST /memory/ingest`, `POST /memory/chat`, `POST /cascade/trigger`, WebSocket `/ws/{project_id}` | 🔵 | Frontend integration |
| 0.9 | Celery + Redis — verify worker starts, beat scheduler fires | 🔵 | Forgetting, async jobs |

> **Embedding model note:** Use `qwen3-embedding:0.6b` (1024 dims) as the default. If you pull `:4b` instead, set `EMBED_DIMS=2560`. The number in the model name does NOT equal the output dimension — always verify with `ollama embed` before setting `EMBED_DIMS`.

**Test gate:** `curl localhost:6333/collections` returns 200. `psql` connects. `ollama list` shows all 3 models. `falkordb-cli PING` returns PONG. FastAPI `/docs` loads. Celery worker logs heartbeat. **Do not proceed until all 6 pass.**

---

## Phase 1 — Memory Layer Core (Sequential Within Phase)

Must be built in order — each step depends on the previous.

### 1.1 — mem0 + FalkorDB Pipe Verification 🔵
Wire mem0 (Qdrant vectors + FalkorDB graph) using `config.py`. `register()` must run before any mem0 import.

```python
# test_pipe.py — run this first, stop until it passes
# register() is called inside memory_agent/config.py at import time
from memory_agent.config import get_mem0_client

m = get_mem0_client()

# Write — goes to Qdrant (vector) AND FalkorDB (graph entities)
result = m.add(
    "Users can pay via Stripe using saved cards or new card entry",
    user_id="test_user",
    metadata={"project_id": "alpha", "event_type": "requirement_update",
              "memory_tier": "active", "relevance_score": 1.0},
    infer=False,
)
# result shape: {"results": [{"id": "..."}], "relations": [...]}

# Read — returns vector hits + graph relations
response = m.search(
    "payment methods",
    filters={"user_id": "test_user", "project_id": "alpha"},  # user_id MUST be in filters (mem0 v2.x)
    limit=5,
)
memories  = response.get("results",   [])
relations = response.get("relations", [])
assert len(memories) >= 1,  "PIPE BROKEN"
assert len(relations) >= 0, "Graph returned (may be empty on first add — verify with test_graph.py)"
```

**Test:** `python test_pipe.py` passes. Then `python test_graph.py` to validate FalkorDB entity extraction.
`curl localhost:6333/collections/neuralpm_memories/points/scroll` shows 1 point.

---

### 1.2 — Ingestion Graph (LangGraph) 🟡
Sequential: classify → extract → store. Blocked by 1.1.

```
raw_text
  → classify_node  (Qwen3:8b → ClassifyResult: requirement_update | casual_chat | preference_signal)
  → [if requirement_update] extract_node (Qwen3:8b → RequirementEvent Pydantic model)
  → store_node     (embed description → Qdrant upsert + Postgres INSERT memory_events)
  → END
```

**Key fix from validation report:** Add `/no_think` prefix + `format="json"` on all LLM calls. Strip `<think>...</think>` block before `json.loads()`.

**Test:** POST `/memory/ingest` with a real requirement text → Qdrant has the point → Postgres has the row (same UUID). POST with "hey team" → classified as `casual_chat`, nothing stored.

---

### 1.3 — Chat Graph (LangGraph) 🟡
Sequential: retrieve → synthesize. Blocked by 1.2 (needs stored memories to retrieve).

```
query + project_id
  → retrieve_node  (Qdrant query_points with project_id filter + memory_tier: {in: ["active","compressed"]})
  → synthesize_node (Qwen3:8b → grounded answer with [mem_id] citations)
  → END
```

**Context budget allocator** runs inside retrieve_node — fetch up to 20, rank by blended score (0.5×cosine + 0.3×relevance_score + 0.2×recency), return top 8 within token ceiling.

**Test:** Ingest 5 requirements. Ask "what are the payment requirements?" → answer cites correct memory IDs → no memories from other projects appear.

---

### 1.4 — Verify the Full Loop 🔴 (Gate for all agents)

```
POST /memory/ingest → classify → extract → store (Qdrant + FalkorDB + Postgres)
POST /memory/chat  → retrieve → synthesize → autopsy → grounded answer
```

This gate must pass before any agent is built. The agents are wrappers around this loop — if the loop is broken, every agent breaks.

---

## Phase 2 — Agents + Forgetting (Concurrent After Phase 1 Gate)

Once Phase 1 gate passes, **all four tracks below run concurrently**.

---

### Track A — Adaptive Forgetting (Celery) 🟡

Blocked by: Phase 0.9 (Celery), Phase 1.1 (Qdrant upsert for payload updates)

```python
# celery_tasks/decay.py — runs nightly (5-min in demo)
@celery.task
def run_decay_cycle():
    events = pg.execute("SELECT * FROM memory_events WHERE memory_tier != 'archived'")
    for event in events:
        new_score, new_tier = rescore_event(event, now)
        pg.execute("UPDATE memory_events SET relevance_score=%s, memory_tier=%s WHERE id=%s", ...)
        qdrant.set_payload("neuralpm_memories",
                           payload={"relevance_score": new_score, "memory_tier": new_tier},
                           points=[str(event.id)])
        if new_tier == "compressed" and event.memory_tier == "active":
            summary = qwen3_compress(event.description)
            qdrant.set_payload(..., payload={"description": summary}, ...)
```

**Supersession** (synchronous — fires immediately on any override/requirement change):
```python
def supersede(old_event_id: str, new_event_id: str):
    pg.execute("UPDATE memory_events SET superseded_by=%s, relevance_score=0.05 WHERE id=%s",
               (new_event_id, old_event_id))
    qdrant.set_payload("neuralpm_memories",
                       payload={"relevance_score": 0.05, "superseded_by": str(new_event_id)},
                       points=[str(old_event_id)])
```

---

### Track B — Assignment Agent (LangGraph) 🟡

Blocked by: Phase 1 gate

```
trigger: POST /assignment/suggest {task_id, project_id, manager_id}

  → query_memory_node   (retrieve historical patterns for this task type)
  → fetch_members_node  (Postgres: all members, skills, current load, velocity)
  → score_node          (Qwen3:8b scores each member 0-100 across 4 factors)
  → apply_preference_node  (read user_preference_memory for assignment_override,
                             conf > 0.6 → re-rank before output)
  → output_node         (top 3 candidates with per-factor breakdown)
  → log_node            (write assignment event to Postgres + Qdrant)
  → END
```

Auto-assign mode: same graph, skip output_node, execute assignment directly, fire WebSocket alert.

---

### Track C — Risk Agent (LangGraph + Celery Beat) 🟡

Blocked by: Phase 1 gate, Track A (needs tier filters to exclude archived)

```
trigger: Celery Beat every N minutes (configurable per workspace)

  → fetch_state_node    (all active tasks, member loads, dependency chains from Postgres)
  → detect_risks_node   (Qwen3:8b classifies: stale | overload | deadline | blocker_chain)
  → apply_risk_tolerance_node  (read risk_tolerance preference, conf > 0.6:
                                 suppress dismissed categories → severity="suppressed"
                                 escalate always-acted categories → severity="escalated")
  → emit_node           (push risk cards to frontend via WebSocket /ws/{project_id})
  → log_node            (write risk_flag event to Postgres + Qdrant)
  → END

on user action (resolve/acknowledge/dismiss):
  → write evidence to user_preference_memory (risk_tolerance type)
  → if dismissed: mark risk suppressed in session state
```

**Suppressed risks:** never deleted from DB. UI filter toggle reveals them. Each card shows: "Suppressed — Alice dismisses overload risks (conf 0.71)".

---

### Track D — Cascade Agent (LangGraph) 🟡

Blocked by: Phase 1 gate, Phase 0.6 (`task_dependencies` table)

```
trigger: POST /cascade/trigger {task_id, project_id, manager_id}
         (fired by: frontend deadline/status change OR Risk Agent at Critical blocker chain)

  → load_graph_node     (recursive CTE on task_dependencies → all downstream tasks)
  → propagate_node      (recalculate projected dates for every affected task)
  → conflict_node       (check against milestones/client commitments in Postgres)
  → apply_philosophy_node  (read timeline_philosophy preference, conf > 0.6:
                             order mitigation scenarios by manager preference;
                             neutral standard propagation always included)
  → emit_node           (push cascade summary + revised dates via WebSocket)
  → log_node            (write timeline_shift event with before/after to Postgres + Qdrant)
  → END

what-if mode: same graph with simulate=True flag, no DB writes, returns projection only
```

---

### Track E — Frontend Skeleton 🔵

Can start concurrently from Phase 2. Not blocked by any agent — just needs FastAPI `/docs` to be up.

Build order within frontend (sequential):
1. **Task Command Center** — table, CRUD, status drag-and-drop
2. **Members Intelligence Hub** — team table, member profile drawer
3. **Requirements Input** — form → `POST /ingest`
4. **Memory Chatbot** — textarea → `POST /chat` → render answer with citations
5. **Insights War Room** — Risk Radar, Cascade Timeline, Assignment Analytics, Learning Panel
6. **WebSocket integration** — connect `/ws/{project_id}` → push alerts to Notifications Center

---

## Phase 3 — Preference System (Sequential After Phase 2 Agents)

Preferences need agents writing evidence first. Build after at least one agent is end-to-end working.

### 3.1 — Evidence Writing 🟡
Each agent's `log_node` writes to `user_preference_memory` after every user action:

| Agent | Action | Preference type | Evidence written |
|---|---|---|---|
| Assignment | Manager overrides suggestion | `assignment_override` | `evidence_count++`, `consistency_rate` updated |
| Assignment | Manager approves suggestion | `assignment_override` | reinforcement |
| Risk | Manager dismisses risk category | `risk_tolerance` | dismissed category logged |
| Risk | Manager acts on risk category | `risk_tolerance` | escalated category logged |
| Cascade | Manager picks mitigation scenario | `timeline_philosophy` | chosen scenario logged |
| Chatbot | Thumbs up/down on answer | `communication_style` | format/verbosity preference |

### 3.2 — Confidence Scoring 🟡
```python
def update_confidence(user_id: str, pref_type: str, new_evidence: dict):
    pref = pg.fetchone("SELECT * FROM user_preference_memory WHERE user_id=%s AND preference_type=%s",
                       (user_id, pref_type))
    evidence_count = (pref.evidence_count or 0) + 1
    consistency_rate = calculate_consistency(pref.preference_value, new_evidence)
    confidence = consistency_rate * (1 - 1 / (1 + evidence_count))
    pg.execute("UPDATE user_preference_memory SET confidence=%s, evidence_count=%s, last_observed=NOW() ...",
               (confidence, evidence_count, ...))
```

### 3.3 — Learning Mode Toggle 🟡
Opt-in per manager. When on, every override prompts:
- "One-time exception" → normal evidence, no confidence boost
- "New pattern" → seed confidence at 0.7, evidence_count = 1 → clears threshold immediately → next matching task already re-ranked

### 3.4 — Preference Registry UI 🔵
System Learning Panel in Insights War Room:
- Table of every learned preference (type, value, confidence, evidence_count, last_observed)
- Edit or delete in one click → DELETE from `user_preference_memory`
- Override rate trend graph (overrides / total suggestions per week)
- Confidence growth chart per preference type

---

## Phase 4 — Polish Features (Concurrent, After Phase 3)

All of Phase 4 runs concurrently — no dependencies between them.

| Feature | Status | Notes |
|---|---|---|
| Memory Autopsy panel | 🟡 | Log loaded/filtered memories in synthesize_node; return alongside answer |
| What-If Simulator | 🟡 | Cascade graph with `simulate=True`, no DB writes |
| Qwen2.5-VL file analysis | 🟡 | Chatbot accepts image/PDF → pass to `qwen2.5vl:7b` → embed result → store |
| Demo clock acceleration | 🟡 | Celery Beat 5-min cycle + "advance sprint" control that fast-forwards age field |
| Memory Autopsy "filtered out" block | 🟡 | Track what was excluded from context budget and why |
| Suppressed risk hover tooltip | 🔵 | Frontend only — confidence + reason already in DB |

---

## Concurrency Map (Visual)

```
Phase 0: [0.1]→[0.2]→[0.3]→[0.4]→[0.5]→[0.6]→[0.7]→[0.8]→[0.9]   ← all sequential
                                                                          ↓
Phase 1: [1.1 Embed]→[1.2 Ingest Graph]→[1.3 Chat Graph]→[1.4 GATE]  ← all sequential
                                                                          ↓
Phase 2: ┌─────────────────────────────────────────────────────────┐
         │ Track A: Forgetting (Celery decay + supersession)        │
         │ Track B: Assignment Agent                                │  ← all concurrent
         │ Track C: Risk Agent                                      │
         │ Track D: Cascade Agent                                   │
         │ Track E: Frontend skeleton                               │
         └─────────────────────────────────────────────────────────┘
                                                                          ↓
Phase 3: [3.1 Evidence writing]→[3.2 Confidence scoring]→[3.3 Learning Mode]→[3.4 Registry UI]
                                                                          ↓
Phase 4: ┌──────────────────────────────────────────────────────────┐
         │ Autopsy | What-If | Qwen-VL | Demo clock | Suppressed UI │  ← all concurrent
         └──────────────────────────────────────────────────────────┘
```

---

## Feature Status Table (Complete)

### Infrastructure
| Feature | Status | Phase |
|---|---|---|
| Qdrant running | 🟢 Works now | 0.1 |
| Postgres running | 🟢 Works now | 0.2 |
| Qwen3:8b on Ollama | 🟢 Works now | 0.3 |
| Qwen3-Embedding:4b on Ollama | 🟢 Works now | 0.4 |
| Qwen2.5-VL:7b on Ollama | 🟢 Works now | 0.5 |
| Postgres schemas | 🔵 Wire | 0.6 |
| Qdrant collection + indexes | 🔵 Wire | 0.7 |
| FastAPI skeleton | 🔵 Wire | 0.8 |
| Celery + Redis | 🔵 Wire | 0.9 |

### Memory Layer
| Feature | Status | Phase |
|---|---|---|
| Embedding pipeline (Qwen → Qdrant) | 🔵 Wire | 1.1 |
| Ingestion LangGraph (classify→extract→store) | 🟡 Build | 1.2 |
| Chat LangGraph (retrieve→synthesize) | 🟡 Build | 1.3 |
| Context budget allocator | 🟡 Build | 1.3 |
| Project_id isolation | 🔵 Wire | 1.3 |
| Advanced filter operators (`in`, `gte`, `AND`) | 🔵 Wire | 1.3 |
| Cross-session persistence | 🟢 Works now | 1.1 |

### Agents
| Feature | Status | Phase |
|---|---|---|
| Assignment Agent (score + suggest) | 🟡 Build | 2B |
| Assignment Agent auto-assign mode | 🟡 Build | 2B |
| Risk Agent (detect 4 risk types) | 🟡 Build | 2C |
| Risk Agent continuous monitoring (Celery) | 🔵 Wire | 2C |
| Cascade Agent (dependency propagation) | 🟡 Build | 2D |
| Cascade Agent trigger wiring | 🔵 Wire | 2D |
| Cascade Agent What-If mode | 🟡 Build | 4 |
| Multi-agent shared memory (shared Qdrant) | 🟢 Works now | 2 |
| WebSocket alerts | 🔵 Wire | 2 |

### Forgetting
| Feature | Status | Phase |
|---|---|---|
| Relevance score decay (Celery Beat) | 🟡 Build | 2A |
| Tier transitions (active→compressed→archived) | 🟡 Build | 2A |
| LLM compression of compressed-tier events | 🟡 Build | 2A |
| Instant supersession on override | 🟡 Build | 2A |
| Qdrant payload update on decay | 🔵 Wire | 2A |

### Preference System
| Feature | Status | Phase |
|---|---|---|
| Evidence writing (all agents) | 🟡 Build | 3.1 |
| Confidence scoring formula | 🟡 Build | 3.2 |
| assignment_override preference re-ranking | 🟡 Build | 3.2 |
| risk_tolerance pre-render suppression/escalation | 🟡 Build | 3.2 |
| timeline_philosophy mitigation ordering | 🟡 Build | 3.2 |
| communication_style response shaping | 🟡 Build | 3.2 |
| Conflicting preference arbitration | 🟡 Build | 3.2 |
| Learning Mode toggle | 🟡 Build | 3.3 |
| Preference Registry UI | 🔵 Wire | 3.4 |

### UI
| Feature | Status | Phase |
|---|---|---|
| Task Command Center | 🟡 Build | 2E |
| Members Intelligence Hub | 🟡 Build | 2E |
| Insights War Room — Risk Radar | 🟡 Build | 2E |
| Insights War Room — Cascade Timeline | 🟡 Build | 2E |
| Insights War Room — Learning Panel | 🔵 Wire | 3.4 |
| Requirements Input | 🔵 Wire | 2E |
| Memory Chatbot | 🟡 Build | 2E |
| Suppressed risk filter + hover tooltip | 🔵 Wire | 2E |
| Memory Autopsy panel | 🟡 Build | 4 |
| Notifications Center (WebSocket) | 🔵 Wire | 2E |
| Governance Toggle | 🔵 Wire | 2E |

### Advanced / Polish
| Feature | Status | Phase |
|---|---|---|
| Qwen2.5-VL file/doc analysis in chatbot | 🟡 Build | 4 |
| Demo clock acceleration (5-min Celery cycle) | 🔵 Wire | 4 |
| Override rate trend graph | 🟡 Build | 4 |
| Memory Autopsy filtered-out block | 🟡 Build | 4 |

---

## Count Summary

| Status | Count | What it means |
|---|---|---|
| 🟢 Works now (zero code) | 6 | Tool handles it natively |
| 🔵 Wire (< 1 day each) | 18 | Connect existing pieces |
| 🟡 Build (1–3 days each) | 27 | Custom logic required |
| 🔴 Hard gates | 2 | Phase 0 all-pass + Phase 1.4 loop gate |

**Total features: 51**
**Sequential gates: 2** (Phase 0 infra all-pass, Phase 1 memory loop)
**Concurrent windows: 2** (Phase 2 four tracks, Phase 4 polish)
