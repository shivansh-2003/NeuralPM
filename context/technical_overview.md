# NeuralPM — Master Technical Documentation

> **This is the entry-point document.** Read this first, then navigate to the agent-specific docs for implementation detail.
>
> | Agent | Deep-dive document |
> |---|---|
> | Assignment Agent | [`assignment_agent_technical.md`](./assignment_agent_technical.md) |
> | Risk Agent | [`risk_agent_technical.md`](./risk_agent_technical.md) |
> | Cascade Agent | [`cascade_agent_technical.md`](./cascade_agent_technical.md) |
> | Memory Agent | [`memory_agent_technical.md`](./memory_agent_technical.md) |

---

## 1. What NeuralPM Is

NeuralPM is an intelligent Project Operating System built on a **four-agent architecture** coordinated by a shared memory layer. Unlike passive tools (Jira, Asana), NeuralPM continuously observes the project, surfaces risks, suggests assignments, propagates timeline changes, and improves its suggestions with every sprint.

Three operational agents do the work. One memory agent ties everything together.

---

## 2. Full System Architecture

```mermaid
flowchart TD
    subgraph UI["🖥️ Frontend — React 18 + Vite + Tailwind"]
        TCC["Task Command Center\n'Find Best Match' button"]
        MIH["Members Intelligence Hub\nSkill matrix · Velocity charts"]
        IWR["Insights War Room\nRisk Radar · Cascade Timeline\nLearning Panel"]
        REQ["Requirements Input\nIngest form"]
        CHAT["Memory Chatbot\nNatural language Q&A\nFile/doc analysis"]
    end

    subgraph API["⚙️ FastAPI + WebSockets"]
        EP1["POST /assignment/suggest\nPOST /assignment/feedback"]
        EP2["POST /risk/scan\nPOST /risk/feedback"]
        EP3["POST /cascade/trigger\nPOST /cascade/scenario-chosen"]
        EP4["POST /memory/ingest\nPOST /memory/chat"]
        WS["WebSocket /ws/{project_id}\nReal-time agent alerts"]
    end

    subgraph AGENTS["🤖 Agent Layer — LangGraph Graphs"]
        AA["Assignment Agent\n8 nodes · suggest + auto modes\nPreference re-ranking"]
        RA["Risk Agent\n5 nodes · Celery Beat triggered\n4 detection types\n+ write_evidence via feedback endpoint"]
        CA["Cascade Agent\n7 nodes · simulate mode\nRecursive CTE traversal"]
        MA["Memory Agent\nIngestion graph (3 nodes)\nChat graph (4 nodes)"]
    end

    subgraph MEMORY["🧠 Shared Memory Layer"]
        QDRANT[("Qdrant :6333\nneuralpm_memories\nvectors + payload")]
        FALKOR[("FalkorDB :6379\nmem0_{user_id} graphs\nentity relationships")]
        POSTGRES[("Postgres :5432\nmemory_events · tasks · members\nrisk_log · cascade_log\nuser_preference_memory\ntask_dependencies")]
    end

    subgraph ASYNC["⏱️ Async Layer — Celery + Redis"]
        BEAT["Celery Beat\nRisk scan every 5 min\nDecay cycle every 5 min\nCompression every 10 min"]
        WORKER["Celery Worker\nProcesses tasks async"]
    end

    subgraph MODELS["🤖 Ollama Models (Local)"]
        Q3["Qwen3:8b\nClassify · Extract · Score\nSynthesize · Compress"]
        QE["Qwen3-Embedding:0.6b\n1024 dims\nAll vector embeddings\n(or :4b → 2560 dims)"]
        QV["Qwen2.5-VL:7b\nChatbot file/image analysis"]
    end

    TCC --> EP1
    REQ --> EP4
    CHAT --> EP4
    IWR --> EP2
    IWR --> EP3

    EP1 --> AA
    EP2 --> RA
    EP3 --> CA
    EP4 --> MA

    AA <--> MEMORY
    RA <--> MEMORY
    CA <--> MEMORY
    MA <--> MEMORY

    BEAT --> RA
    BEAT --> MA

    AA --> WS
    RA --> WS
    CA --> WS

    AGENTS <--> MODELS

    style MEMORY fill:#1a5276,color:#fff
    style AGENTS fill:#6c3483,color:#fff
    style ASYNC  fill:#1e8449,color:#fff
    style MODELS fill:#784212,color:#fff
```

---

## 3. Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Agent Orchestration** | LangGraph 0.2.60+ | StateGraph for each agent; conditional edges for routing (suggest/auto, simulate/real) |
| **LLM Calls** | LangChain + ChatOllama | classify, extract, score, synthesize, compress nodes |
| **LLM Model** | Qwen3:8b (Ollama) | All text reasoning; `reasoning=False` disables thinking mode |
| **Embedding** | Qwen3-Embedding:4b (Ollama) | 1024-dim vectors for all mem0 add/search calls |
| **Multimodal** | Qwen2.5-VL:7b (Ollama) | Chatbot file/image analysis via Ollama `/api/chat` |
| **Vector Store** | Qdrant v1.12.4 | Semantic search; payload-indexed for fast filtering |
| **Graph Store** | FalkorDB (mem0-falkordb plugin) | Entity/relationship graph; per-user isolation (mem0_{user_id}) |
| **Graph Memory Abstraction** | mem0ai[graph] + mem0-falkordb | Single `add()`/`search()` call writes to both Qdrant and FalkorDB |
| **Relational DB** | Postgres | All structured data: tasks, members, events, preferences, dependencies |
| **Task Queue** | Celery + Redis | Risk scans, decay cycles, compression jobs |
| **API** | FastAPI + Uvicorn | REST endpoints + WebSocket manager |
| **Schema Validation** | Pydantic v2 | All LLM output validation; request/response models |
| **Frontend** | React 18 + Vite + Tailwind | All UI panels |

---

## 4. Repository Structure

```
neuralpm/
├── backend/
│   ├── memory_agent/
│   │   ├── config.py              # Settings, mem0 client (with FalkorDB), LLM factory
│   │   ├── schemas/
│   │   │   ├── requirement.py     # ClassifyResult, RequirementEvent
│   │   │   └── assignment.py      # TaskContext, MemberContext, Candidate, AssignmentOutput
│   │   ├── nodes/
│   │   │   ├── memory/            # classify, extract, store, retrieve, allocate_context,
│   │   │   │                      # synthesize, autopsy
│   │   │   ├── assignment/        # fetch_task, fetch_members, query_memory, score,
│   │   │   │                      # apply_preference, output, auto_assign, log, write_evidence
│   │   │   ├── risk/              # fetch_state, detect_risks, apply_risk_tolerance,
│   │   │   │                      # emit, log, write_evidence
│   │   │   └── cascade/           # load_graph, propagate, conflict, apply_philosophy,
│   │   │                          # emit, log, write_evidence
│   │   └── graphs/
│   │       ├── ingestion.py       # Memory Agent ingestion graph
│   │       ├── chat.py            # Memory Agent chat graph
│   │       ├── assignment.py      # Assignment Agent graph
│   │       ├── risk.py            # Risk Agent graph
│   │       └── cascade.py         # Cascade Agent graph
│   ├── api/
│   │   ├── assignment.py          # /assignment/* endpoints
│   │   ├── risk.py                # /risk/* endpoints
│   │   ├── cascade.py             # /cascade/* endpoints
│   │   └── memory.py              # /memory/* endpoints
│   ├── celery_tasks/
│   │   └── decay.py               # run_decay_cycle, run_compression_job
│   ├── scoring/                   # skill_match, workload, velocity, context_affinity
│   ├── cascade_utils.py           # get_downstream_tasks (recursive CTE), add_working_days
│   ├── risk_detectors.py          # detect_stale, detect_overload, detect_deadline, detect_blocker_chains
│   ├── websocket_manager.py       # broadcast() to /ws/{project_id}
│   ├── db.py                      # get_pg_conn() singleton
│   ├── celery_app.py              # Celery + Beat schedule
│   ├── api.py                     # FastAPI app + router includes
│   ├── docker-compose.yml         # Qdrant + FalkorDB
│   ├── requirements.txt
│   ├── .env.example
│   ├── test_pipe.py               # Gate 0: basic add/search loop
│   └── test_graph.py              # Gate 1: FalkorDB graph validation
└── frontend/
    └── src/
        ├── components/
        │   ├── TaskCommandCenter/
        │   ├── MembersHub/
        │   ├── InsightsWarRoom/
        │   │   ├── RiskRadar.jsx
        │   │   ├── CascadeTimeline.jsx
        │   │   └── LearningPanel.jsx
        │   ├── RequirementsInput/
        │   └── MemoryChatbot/
        │       └── MemoryAutopsy.jsx
        └── api.js
```

---

## 5. Shared Infrastructure

### 5.1 `memory_agent/config.py` — The Single Source of Truth

Every agent imports from `config.py`. It owns three things:

**`get_settings()`** — Pydantic BaseSettings that reads `.env`:
```python
# Qdrant, FalkorDB, Ollama URLs + model names
# All agents use the same settings object
```

**`get_mem0_client()`** — lazy singleton, built once:
```python
# register() patches mem0 for FalkorDB BEFORE Memory is imported
# Config: Qdrant (vector) + FalkorDB (graph) + Qwen3-Embedding + Qwen3:8b
# One call to m.add() writes to both Qdrant AND FalkorDB automatically
```

**`get_llm(json_mode, temperature)`** — ChatOllama factory:
```python
# reasoning=False disables Qwen3 thinking mode (prevents ~60% JSON miss)
# json_mode=True adds format="json" for structured extraction nodes
# json_mode=False for synthesize, compress, rationale nodes
```

> Full implementation: [`memory_agent_technical.md §5`](./memory_agent_technical.md)

---

### 5.2 Qdrant — Vector Store

- **Collection:** `neuralpm_memories` (single collection, all agents)
- **Payload indexes:** `project_id`, `memory_tier`, `event_type`, `user_id`
- **Scoping:** every point has `project_id` in payload; every search filters on it
- **Decay updates:** Celery job calls `qdrant.set_payload()` to keep `relevance_score` and `memory_tier` in sync with Postgres
- **Filter syntax:** bare operator names — `{"in": ["active","compressed"]}`, not `{"$in": ...}`

> Qdrant config + indexed_fields: [`memory_agent_technical.md §4.1`](./memory_agent_technical.md)

---

### 5.3 FalkorDB — Graph Store (via mem0-falkordb plugin)

- **One graph per user_id:** `mem0_{user_id}` — physical isolation, zero leakage
- **Auto-populated:** every `m.add()` call triggers entity + relationship extraction via the `GRAPH_EXTRACTION_PROMPT` in `config.py`
- **NeuralPM entities captured:** Engineer, Task, Requirement, Risk, Sprint, Module, Agent
- **NeuralPM relationships:** `ASSIGNED_TO`, `BLOCKS`, `CAUSED_BY`, `DELAYED_BY`, `PART_OF`, `FLAGGED`, `SUGGESTED`, `OVERLOADED_AT`
- **Search returns:** `{"results": [...], "relations": [...]}` — vector hits + graph triples
- **Direct inspection:** `docker exec -it neuralpm-falkordb falkordb-cli GRAPH.LIST`

> FalkorDB setup + plugin registration: [`memory_agent_technical.md §3.4`](./memory_agent_technical.md)

---

### 5.4 Postgres — Relational Source of Truth

```mermaid
erDiagram
    tasks ||--o{ task_dependencies : "depends_on"
    tasks ||--o{ assignment_history : "assigned via"
    tasks ||--o{ risk_log : "flagged in"
    tasks ||--o{ cascade_log : "affected by"
    members ||--o{ tasks : "assigned to"
    members ||--o{ assignment_history : "assigned in"
    members ||--o{ risk_log : "affects"
    memory_events {
        uuid id
        text description
        float relevance_score
        varchar memory_tier
        uuid superseded_by
        int access_count
    }
    user_preference_memory {
        uuid user_id
        varchar preference_type
        jsonb preference_value
        float confidence
        int evidence_count
    }
```

**Key tables by agent:**

| Table | Owner | Used By |
|---|---|---|
| `tasks` | — | All agents |
| `members` | — | Assignment, Risk |
| `task_dependencies` | Cascade Agent | Cascade (recursive CTE traversal) |
| `milestones` | Cascade Agent | Cascade (conflict detection) |
| `memory_events` | Memory Agent | Decay job, Autopsy panel |
| `assignment_history` | Assignment Agent | Preference evidence, UI analytics |
| `risk_log` | Risk Agent | Feedback, preference evidence |
| `cascade_log` | Cascade Agent | Before/after comparisons, evidence |
| `user_preference_memory` | All agents (write + read) | Preference re-ranking for all 4 agents |

> Full schema per agent: see individual technical docs

---

### 5.5 `user_preference_memory` — The Shared Learning Table

All four agents read from and write to this single table. It is the mechanism by which NeuralPM becomes more accurate over time.

```sql
CREATE TABLE user_preference_memory (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL,
    preference_type  VARCHAR(50),
    preference_value JSONB,
    confidence       FLOAT DEFAULT 0.0,    -- 0.0 – 1.0
    evidence_count   INT   DEFAULT 0,
    last_observed    TIMESTAMP,
    created_at       TIMESTAMP DEFAULT NOW()
);
```

**Confidence formula (used by all agents):**
```
confidence = consistency_rate × (1 − 1 / (1 + evidence_count))
```

**Threshold:** `0.6` — below this, preference is a hint. Above it, it actively re-ranks output.

| `preference_type` | Written by | Read by | Effect |
|---|---|---|---|
| `assignment_override` | Assignment Agent (feedback) | Assignment Agent (apply_preference_node) | Re-ranks candidate shortlist |
| `risk_tolerance` | Risk Agent (feedback) | Risk Agent (apply_risk_tolerance_node) | Suppresses/escalates risk categories pre-render |
| `timeline_philosophy` | Cascade Agent (scenario-chosen) | Cascade Agent (apply_philosophy_node) | Orders mitigation scenarios |
| `communication_style` | Memory Agent (thumbs up/down) | Memory Agent (synthesize_node) | Adjusts answer format and depth |

> Preference learning per agent: [Assignment §5.5](./assignment_agent_technical.md) · [Risk §5.6](./risk_agent_technical.md) · [Cascade §5.7](./cascade_agent_technical.md) · [Memory §4.3](./memory_agent_technical.md)

---

### 5.6 Celery Beat — Async Jobs

```python
app.conf.beat_schedule = {
    # Risk Agent: continuous monitoring
    "risk-scan-all-projects": {
        "task":     "tasks.run_risk_scan",
        "schedule": 300,    # 5 min demo / 15 min production
    },
    # Memory Agent: forgetting
    "memory-decay-cycle": {
        "task":     "celery_tasks.decay.run_decay_cycle",
        "schedule": 300,    # 5 min demo / 86400 production
    },
    # Memory Agent: LLM compression
    "memory-compression-cycle": {
        "task":     "celery_tasks.decay.run_compression_job",
        "schedule": 600,    # 10 min demo
    },
}
```

> Decay algorithm: [`memory_agent_technical.md §5`](./memory_agent_technical.md)
> Risk scan task: [`risk_agent_technical.md §7`](./risk_agent_technical.md)

---

## 6. Agent Collaboration — How They Work Together

```mermaid
sequenceDiagram
    participant PM as 👤 Project Manager
    participant AA as 🎯 Assignment Agent
    participant RA as 🚨 Risk Agent
    participant CA as 🔗 Cascade Agent
    participant MA as 🧠 Memory Agent
    participant WS as 📡 WebSocket

    PM->>AA: "Find Best Match" (Payment API)
    AA->>MA: query_memory_node — retrieve assignment patterns
    MA-->>AA: vector hits + FalkorDB ASSIGNED_TO relations
    AA->>MA: score_node + apply_preference_node
    AA-->>PM: Top 3 candidates (Sarah #1, pref applied 74%)

    PM->>AA: Approve Sarah
    AA->>MA: log_node — store assignment event (Qdrant + FalkorDB + Postgres)
    AA->>MA: write_evidence_node — confidence 0.74 → 0.754

    Note over RA: Celery Beat fires (5 min)
    RA->>MA: fetch_state_node — all tasks, loads
    RA->>MA: detect_risks_node → Sarah 92% overload
    RA->>MA: apply_risk_tolerance_node — suppressed (Alice dismisses overload)
    RA->>MA: log_node — store risk_flag event

    PM->>CA: Edit deadline: Payment API +3 days
    CA->>MA: load_graph_node — recursive CTE downstream tasks
    CA->>MA: propagate_node → Checkout July 27, E2E July 29
    CA->>MA: conflict_node → July 25 client demo at risk
    CA->>MA: apply_philosophy_node — scope_cut preferred (Alice conf 0.81)
    CA->>WS: emit_node — cascade summary + 4 scenarios
    CA->>MA: log_node — timeline_shift event
    WS-->>PM: "Payment API +3d. 3 tasks affected. Client demo at risk."

    PM->>CHAT: "Why did the API deadline push?"
    CHAT->>MA: retrieve_node — Qdrant search + FalkorDB traversal
    MA->>MA: allocate_context_node — 3,247/8,192 tokens
    MA->>MA: synthesize_node — grounded answer with citations
    MA-->>PM: Answer + Memory Autopsy
```

**The key loop:** Every agent decision is logged to the memory layer. The memory layer improves every agent's next decision. This is the closed-loop architecture.

---

## 7. Complete API Surface

### Memory Agent
| Method | Endpoint | Trigger | Returns |
|---|---|---|---|
| POST | `/memory/ingest` | Requirements Input form | `{classification, stored, extraction_error}` |
| POST | `/memory/chat` | Memory Chatbot | `{answer, memories_used, relations_used, autopsy}` |

> Full schemas: [`memory_agent_technical.md §6`](./memory_agent_technical.md)

### Assignment Agent
| Method | Endpoint | Trigger | Returns |
|---|---|---|---|
| POST | `/assignment/suggest` | "Find Best Match" button | `{shortlist[3], preference_disclosure, event_id}` |
| POST | `/assignment/feedback` | Manager approve/override | `{evidence_written, new_confidence, crossed_threshold}` |

> Full schemas: [`assignment_agent_technical.md §7`](./assignment_agent_technical.md)

### Risk Agent
| Method | Endpoint | Trigger | Returns |
|---|---|---|---|
| POST | `/risk/scan` | Manual trigger or Celery | `{risks[], suppressed_risks[], preference_applied}` |
| POST | `/risk/feedback` | Resolve/Acknowledge/Dismiss | `{evidence_written, action, new_confidence}` |

> Full schemas: [`risk_agent_technical.md §8`](./risk_agent_technical.md)

### Cascade Agent
| Method | Endpoint | Trigger | Returns |
|---|---|---|---|
| POST | `/cascade/trigger` | Deadline edit, status change, Risk Agent | `{affected_count, revised_dates, scenarios[], conflicts[]}` |
| POST | `/cascade/scenario-chosen` | Manager picks mitigation | `{evidence_written, chosen_scenario, new_confidence}` |

> Full schemas: [`cascade_agent_technical.md §7`](./cascade_agent_technical.md)

### WebSocket
| Endpoint | Message types |
|---|---|
| `WS /ws/{project_id}` | `risk_radar_update`, `cascade_impact`, `auto_assignment` |

---

## 8. Data Flow — What Each Agent Writes to Memory

```mermaid
flowchart LR
    subgraph WRITES["What each agent writes to mem0 (Qdrant + FalkorDB)"]
        AA_W["Assignment Agent\nevent_type: assignment\n'Assigned Payment API to Sarah. Score: 90'\nFalkorDB: Sarah -ASSIGNED_TO-> Payment API"]
        RA_W["Risk Agent\nevent_type: risk_flag\n'Sarah at 92% — overload flagged'\nFalkorDB: RiskAgent -FLAGGED-> Sarah"]
        CA_W["Cascade Agent\nevent_type: timeline_shift\n'Payment API +3d. 3 tasks affected'\nFalkorDB: PaymentAPI -BLOCKS-> CheckoutFlow"]
        MA_W["Memory Agent (ingest)\nevent_type: requirement_update\n'[Module: payment] Stripe checkout required'\nFalkorDB: Requirement -PART_OF-> PaymentModule"]
    end

    subgraph READS["What each agent reads from mem0"]
        AA_R["Assignment Agent\nquery_memory_node\n'assignment history for backend/payment'\n→ who has been assigned to this module?"]
        RA_R["Risk Agent\nlog_node references\n'historical risk patterns for this project'"]
        CA_R["Cascade Agent\nlog_node after propagation\n'past timeline shifts and their outcomes'"]
        MA_R["Memory Agent (chat)\nretrieve_node\nAll event types combined\nvector + graph relations"]
    end

    AA_W --> MA_R
    RA_W --> MA_R
    CA_W --> MA_R
    MA_W --> MA_R

    MA_R --> AA_R
    MA_R --> CA_R
```

---

## 9. LangGraph State Flow — All Graphs

```mermaid
flowchart TD
    subgraph IG["Ingestion Graph (Memory Agent)"]
        IG1[classify] --> IG2[extract] --> IG3[store]
    end

    subgraph CG["Chat Graph (Memory Agent)"]
        CG1[retrieve] --> CG2[allocate_context] --> CG3[synthesize] --> CG4[autopsy]
    end

    subgraph AG["Assignment Graph"]
        AG1[fetch_task] --> AG2[fetch_members] --> AG3[query_memory]
        AG3 --> AG4[score] --> AG5[apply_preference]
        AG5 -->|suggest| AG6[output]
        AG5 -->|auto| AG7[auto_assign]
        AG6 --> AG8[log]
        AG7 --> AG8
    end

    subgraph RG["Risk Graph"]
        RG1[fetch_state] --> RG2[detect_risks]
        RG2 --> RG3[apply_risk_tolerance] --> RG4[emit] --> RG5[log]
    end

    subgraph CaG["Cascade Graph"]
        CaG1[load_graph] --> CaG2[propagate] --> CaG3[conflict]
        CaG3 --> CaG4[apply_philosophy]
        CaG4 -->|simulate=false| CaG5[emit] --> CaG6[log]
        CaG4 -->|simulate=true| CaG7[simulate_end]
    end
```

---

## 10. Adaptive Forgetting — Lifecycle of a Memory

```mermaid
timeline
    title Memory Lifecycle (production timeline, demo runs compressed)
    Day 0   : Event ingested — relevance_score=1.0, tier=active
            : Vector in Qdrant · entities in FalkorDB · row in Postgres
    Day 1-89 : Celery decay cycle runs nightly
             : score decays 1-10% per cycle (less if accessed frequently)
             : access_count tracked — popular memories decay slower
    Day 90  : tier transitions active → compressed
            : Qwen3:8b generates one-sentence summary
            : compressed_description written to Qdrant payload
    Day 366  : tier transitions compressed → archived
             : score *= 0.5, excluded from default retrieval
             : still queryable for audit (Autopsy 'filtered out' block shows it)
    Anytime  : Override or requirement change → supersede() called synchronously
             : superseded_by set, score collapses to 0.05 immediately
             : Does NOT wait for next Celery cycle
```

> Decay algorithm + Celery jobs: [`memory_agent_technical.md §5`](./memory_agent_technical.md)

---

## 11. Preference Learning — Lifecycle of a Preference

```mermaid
timeline
    title Preference Confidence Growth (assignment_override example)
    Session 1  : Alice overrides Bob → Sarah for backend/payment task
               : evidence_count=1, consistency_rate=1.0, confidence=0.50
               : Below 0.6 threshold — preference is a hint only
    Session 2-3 : 3 more overrides to Sarah for same category
               : evidence_count=4, consistency_rate=0.80, confidence=0.64
               : THRESHOLD CROSSED — preference now actively re-ranks
    Session 4+  : Agent suggests Sarah first for backend/payment
               : Alice approves → confidence += evidence
               : evidence_count=12, confidence=0.74
    Learning Mode : Alice overrides once, confirms "New Pattern"
                  : confidence seeded to 0.70 immediately
                  : Next suggestion already re-ranked without waiting
```

> Per-agent preference logic: [Assignment §5.5](./assignment_agent_technical.md) · [Risk §5.6](./risk_agent_technical.md) · [Cascade §5.7](./cascade_agent_technical.md)

---

## 12. Environment Variables (Complete)

```bash
# ── Qdrant ───────────────────────────────────────────────────────────────────
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_COLLECTION=neuralpm_memories

# ── FalkorDB ─────────────────────────────────────────────────────────────────
FALKORDB_HOST=localhost
FALKORDB_PORT=6379
FALKORDB_DATABASE=mem0

# ── Postgres ─────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:pass@localhost:5432/neuralpm

# ── Ollama ───────────────────────────────────────────────────────────────────
OLLAMA_BASE_URL=http://localhost:11434
LLM_MODEL=qwen3:8b
EMBED_MODEL=qwen3-embedding:0.6b
EMBED_DIMS=1024        # must match model: 0.6b→1024, 4b→2560, 8b→4096

# ── Celery ───────────────────────────────────────────────────────────────────
CELERY_BROKER_URL=redis://localhost:6379/1

# ── API ──────────────────────────────────────────────────────────────────────
FRONTEND_ORIGIN=http://localhost:5173

# ── Agent Behaviour ──────────────────────────────────────────────────────────
ASSIGNMENT_MODE=suggest                  # suggest | auto
PREFERENCE_CONFIDENCE_THRESHOLD=0.6
RISK_SCAN_INTERVAL_SECONDS=300           # 5 min demo / 900 production
STALE_TASK_DAYS=3
OVERLOAD_PCT=85
DECAY_CYCLE_SECONDS=300
```

---

## 13. Startup Sequence

```mermaid
flowchart LR
    S1["docker compose up -d\nQdrant :6333\nFalkorDB :6379"]
    S2["Start Postgres\nRun migrations\nCreate all tables"]
    S3["ollama pull qwen3:8b\nollama pull qwen3-embedding:0.6b\nollama pull qwen2.5vl:7b"]
    S4["python test_pipe.py\nGate 0: add → search loop\nMust pass before agents"]
    S5["python test_graph.py\nGate 1: FalkorDB entity\nextraction validated"]
    S6["celery -A celery_app worker\n--loglevel=info"]
    S7["celery -A celery_app beat\n--loglevel=info"]
    S8["uvicorn api:app\n--reload --port 8000"]
    S9["cd frontend && npm run dev\nVite :5173"]

    S1 --> S2 --> S3 --> S4 --> S5 --> S6 --> S7 --> S8 --> S9
```

**Gate 0 (`test_pipe.py`):** Confirms mem0 can add to Qdrant and retrieve with `project_id` filter. Do not build agents until this passes.

**Gate 1 (`test_graph.py`):** Confirms FalkorDB receives entity/relationship extraction from `m.add()`. Confirms `m.search()` returns `relations` list. Confirms per-user isolation.

> Test scripts: [`memory_agent_technical.md §8`](./memory_agent_technical.md)

---

## 14. Docker Compose

```yaml
services:
  qdrant:
    image: qdrant/qdrant:v1.12.4
    container_name: neuralpm-qdrant
    ports: ["6333:6333", "6334:6334"]
    volumes: [qdrant_storage:/qdrant/storage]

  falkordb:
    image: falkordb/falkordb:latest
    container_name: neuralpm-falkordb
    ports: ["6379:6379"]
    volumes: [falkordb_storage:/data]

volumes:
  qdrant_storage:
  falkordb_storage:
```

> Note: Redis for Celery can share the FalkorDB port (6379) by using a different DB number (`/1`), or run a separate Redis container on a different port.

---

## 15. Build Phases Cross-Reference

| Phase | What gets built | Key docs |
|---|---|---|
| **Phase 0** — Infrastructure | Docker, Postgres schemas, Ollama models, FastAPI skeleton, Celery | This doc §12, §13 |
| **Phase 1** — Memory loop | Ingestion graph, Chat graph, context budget, Gate tests | [`memory_agent_technical.md`](./memory_agent_technical.md) |
| **Phase 2A** — Forgetting | Celery decay + compression + supersession | [`memory_agent_technical.md §5`](./memory_agent_technical.md) |
| **Phase 2B** — Assignment | All 8 nodes, scoring, preference re-ranking | [`assignment_agent_technical.md`](./assignment_agent_technical.md) |
| **Phase 2C** — Risk | 4 detectors, tolerance suppression, Celery trigger | [`risk_agent_technical.md`](./risk_agent_technical.md) |
| **Phase 2D** — Cascade | Recursive CTE, propagation, philosophy ordering, What-If | [`cascade_agent_technical.md`](./cascade_agent_technical.md) |
| **Phase 2E** — Frontend | All UI panels, WebSocket integration | `README.md` |
| **Phase 3** — Preferences | Evidence writing, confidence scoring, Learning Mode, Registry UI | All 4 agent docs §evidence nodes |
| **Phase 4** — Polish | Autopsy, What-If, Qwen-VL, demo clock | [`memory_agent_technical.md §4.4`](./memory_agent_technical.md) |

> Full parallelism map with Mermaid diagrams: [`README.md`](../README.md)

---

## 16. Key Architectural Decisions and Rationale

| Decision | Rationale |
|---|---|
| **FalkorDB over Neo4j** | 496x faster p99 latency, per-user graph isolation built-in, Redis wire protocol (same port as existing Redis), runtime plugin (no mem0 fork) |
| **Qdrant over pgvector** | Native payload pre-filtering (not post-filter), filterable HNSW maintains accuracy under heavy filtering, payload indexes on `project_id` + `memory_tier` |
| **Mem0 dropped for raw Qdrant** | mem0's `$in`/range filter operators mapped to wrong syntax on Qdrant; direct `qdrant_client` gives full control over `query_points` filter API |
| **infer=False on all add() calls** | We do our own LLM extraction (classify + extract nodes). infer=False stores our clean text verbatim. Graph extraction still runs regardless of infer flag. |
| **Postgres task_dependencies over Neo4j** | Recursive CTE handles cascade traversal for Phase 1. Neo4j upgrade path documented for Phase 2 if graph exceeds relational adjacency table performance. |
| **Qwen3 reasoning=False** | Thinking mode causes ~60% JSON miss rate in extraction loops. Disabled for all structured output nodes. |
| **Single Qdrant collection, multi-tenant** | All agents share `neuralpm_memories`. Project isolation enforced by `project_id` payload filter on every query. FalkorDB provides graph-level isolation per user. |
| **Celery + Redis for async** | Risk scans and decay jobs must not block API responses. Celery Beat gives configurable schedules with demo-mode acceleration (5-min cycles). |

---

## 17. Track 1 Rubric Coverage

| Requirement | Implementation | Confidence |
|---|---|---|
| Efficient memory storage & retrieval | Qdrant with payload indexes + blended ranking (cosine + relevance + recency) | ✅ |
| Timely forgetting of outdated information | Celery Beat decay (age + disuse) + synchronous supersession on override | ✅ |
| Recalling critical memories within limited context windows | Token budget allocator (8,192 ceiling, 5 slices, archived excluded before ranking) | ✅ |
| Cross-session improvement | Override rate graph + confidence growth + Learning Mode 1-step teaching | ✅ |
| Multi-turn conversation | `conversation_history` in chat state + recent_conversation budget slice | ✅ |
