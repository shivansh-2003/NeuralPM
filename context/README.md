# NeuralPM — Build Parallelism & Sequencing Overview

> **The core rule:** Two sequential gates control everything. Once both pass, the build fans out into wide parallel tracks. Understanding this prevents the most common mistake — starting agents before the memory loop is verified.

---

## 1. The Big Picture

```mermaid
flowchart TD
    P0["⛓️ PHASE 0\nInfrastructure\n9 sequential steps"]
    GATE0["🔴 GATE 0\nAll infra healthy"]
    P1["⛓️ PHASE 1\nMemory Layer\n3 sequential steps"]
    GATE1["🔴 GATE 1\nIngest → Store → Retrieve → Answer\nverified end-to-end"]

    P2A["Track A\nForgetting\nCelery decay"]
    P2B["Track B\nAssignment\nAgent"]
    P2C["Track C\nRisk\nAgent"]
    P2D["Track D\nCascade\nAgent"]
    P2E["Track E\nFrontend\nSkeleton"]

    P3["⛓️ PHASE 3\nPreference System\n4 sequential steps"]
    GATE3["🔴 GATE 3\nAt least one agent writing\npreference evidence"]

    P4A["Autopsy\nPanel"]
    P4B["What-If\nSimulator"]
    P4C["Qwen-VL\nFile Analysis"]
    P4D["Demo Clock\nAcceleration"]
    P4E["Suppressed\nRisk UI"]

    P0 --> GATE0 --> P1 --> GATE1

    GATE1 --> P2A
    GATE1 --> P2B
    GATE1 --> P2C
    GATE1 --> P2D
    GATE1 --> P2E

    P2A --> P3
    P2B --> P3
    P2C --> P3
    P2D --> P3
    P2E --> P3

    P3 --> GATE3

    GATE3 --> P4A
    GATE3 --> P4B
    GATE3 --> P4C
    GATE3 --> P4D
    GATE3 --> P4E

    style P0 fill:#ff6b6b,color:#fff,stroke:#c0392b
    style P1 fill:#ff6b6b,color:#fff,stroke:#c0392b
    style P3 fill:#ff6b6b,color:#fff,stroke:#c0392b
    style GATE0 fill:#2c3e50,color:#fff,stroke:#2c3e50
    style GATE1 fill:#2c3e50,color:#fff,stroke:#2c3e50
    style GATE3 fill:#2c3e50,color:#fff,stroke:#2c3e50
    style P2A fill:#27ae60,color:#fff,stroke:#1e8449
    style P2B fill:#27ae60,color:#fff,stroke:#1e8449
    style P2C fill:#27ae60,color:#fff,stroke:#1e8449
    style P2D fill:#27ae60,color:#fff,stroke:#1e8449
    style P2E fill:#27ae60,color:#fff,stroke:#1e8449
    style P4A fill:#2980b9,color:#fff,stroke:#1a5276
    style P4B fill:#2980b9,color:#fff,stroke:#1a5276
    style P4C fill:#2980b9,color:#fff,stroke:#1a5276
    style P4D fill:#2980b9,color:#fff,stroke:#1a5276
    style P4E fill:#2980b9,color:#fff,stroke:#1a5276
```

| Colour | Meaning |
|---|---|
| 🔴 Red | Sequential — must complete fully before anything downstream starts |
| 🟢 Green | Parallel — all 5 tracks run at the same time |
| 🔵 Blue | Parallel — all 5 polish features run at the same time |
| ⬛ Black | Gate — hard checkpoint, run tests before proceeding |

---

## 2. Phase 0 — Infrastructure (Fully Sequential)

Every step depends on the previous. No exceptions.

```mermaid
flowchart LR
    A["0.1\nQdrant\nDocker :6333"] -->
    B["0.2\nPostgres\nDocker :5432"] -->
    C["0.3\nQwen3:8b\nollama pull"] -->
    D["0.4\nQwen3-Embedding:4b\nollama pull"] -->
    E["0.5\nQwen2.5-VL:7b\nollama pull"] -->
    F["0.6\nPostgres\nSchemas"] -->
    G["0.7\nQdrant\nCollection + Indexes"] -->
    H["0.8\nFastAPI\nSkeleton"] -->
    I["0.9\nCelery\n+ Redis"]

    style A fill:#e74c3c,color:#fff
    style B fill:#e74c3c,color:#fff
    style C fill:#e74c3c,color:#fff
    style D fill:#e74c3c,color:#fff
    style E fill:#e74c3c,color:#fff
    style F fill:#e74c3c,color:#fff
    style G fill:#e74c3c,color:#fff
    style H fill:#e74c3c,color:#fff
    style I fill:#e74c3c,color:#fff
```

**Why sequential?** Each step is a hard dependency. You cannot create a Qdrant collection (0.7) before Qdrant is running (0.1). You cannot test the ingest API (0.8) before schemas exist (0.6).

**Gate 0 test:** All five pass simultaneously before moving on.
```bash
curl localhost:6333/collections          # Qdrant ✓
psql $DATABASE_URL -c "\dt"             # Postgres schemas ✓
ollama list | grep qwen3                # Models ✓
curl localhost:8000/docs                # FastAPI ✓
celery -A app inspect ping              # Celery ✓
```

---

## 3. Phase 1 — Memory Layer (Fully Sequential)

The memory loop is the foundation of every agent. Agents are just wrappers around this loop. If the loop is broken, every agent breaks.

```mermaid
flowchart TD
    T["Raw text\n(requirement / event)"]

    subgraph IG["1.2 — Ingestion Graph"]
        direction LR
        C["classify_node\nQwen3:8b\nrequirement_update?\ncasual_chat?\npreference_signal?"]
        E["extract_node\nQwen3:8b\nRequirementEvent\nPydantic model"]
        S["store_node\nembed → Qdrant upsert\nINSERT memory_events\nPostgres"]
        C -->|"requirement_update"| E --> S
        C -->|"casual_chat"| SKIP["skip → END"]
    end

    subgraph CG["1.3 — Chat Graph"]
        direction LR
        R["retrieve_node\nQdrant query\nproject_id filter\nmemory_tier: in active,compressed\nblended ranking"]
        SY["synthesize_node\nQwen3:8b\ngrounded answer\ncites mem_id"]
        R --> SY
    end

    GATE1["🔴 GATE 1\nIngest a requirement\nAsk about it\nGet a grounded answer\nwith correct memory ID citation"]

    T --> IG --> CG --> GATE1

    style IG fill:#f39c12,color:#fff,stroke:#d68910
    style CG fill:#f39c12,color:#fff,stroke:#d68910
    style GATE1 fill:#2c3e50,color:#fff
    style SKIP fill:#95a5a6,color:#fff
```

**Why sequential within Phase 1?**
- 1.1 (embedding pipeline) must exist before 1.2 (store_node calls it)
- 1.2 (ingestion) must exist before 1.3 (retrieve has nothing to retrieve without stored memories)
- 1.3 must be verified before any agent — agents call retrieve and synthesize internally

---

## 4. Phase 2 — Five Parallel Tracks

Once Gate 1 passes, all five tracks start simultaneously. They share the same Qdrant collection and Postgres DB but have zero code dependencies on each other.

```mermaid
flowchart TD
    GATE1["🔴 GATE 1 — Memory Loop Verified"]

    GATE1 --> A & B & C & D & E

    subgraph A["Track A — Forgetting"]
        direction TB
        A1["Celery Beat\ndecay job\nnightly / 5-min demo"]
        A2["rescore_event\nage decay\ndisuse decay"]
        A3["set_payload\nQdrant + Postgres\nrelevance_score\nmemory_tier"]
        A4["LLM compress\nactive → compressed\nsummary replaces text"]
        A5["Supersession\ninstant on override\nrelevance → 0.05"]
        A1 --> A2 --> A3 --> A4
        A1 --> A5
    end

    subgraph B["Track B — Assignment Agent"]
        direction TB
        B1["POST /assignment/suggest"]
        B2["query_memory_node\nhistorical patterns"]
        B3["fetch_members_node\nskills, load, velocity"]
        B4["score_node\n0-100 per member\n4 factors"]
        B5["apply_preference_node\nassignment_override\nconf > 0.6 re-ranks"]
        B6["output top 3\nwith reasoning"]
        B7["log_node\nwrite to memory\n+ write evidence"]
        B1 --> B2 --> B3 --> B4 --> B5 --> B6 --> B7
    end

    subgraph C["Track C — Risk Agent"]
        direction TB
        C1["Celery Beat\nevery N minutes"]
        C2["fetch_state_node\nall tasks, loads\ndependency chains"]
        C3["detect_risks_node\nstale, overload\ndeadline, blocker"]
        C4["apply_risk_tolerance\nconf > 0.6\nsuppress / escalate\nby category"]
        C5["emit_node\nWebSocket push\nrisk cards to UI"]
        C6["log_node\nwrite risk_flag\n+ write evidence"]
        C1 --> C2 --> C3 --> C4 --> C5 --> C6
    end

    subgraph D["Track D — Cascade Agent"]
        direction TB
        D1["POST /cascade/trigger\nfrom frontend OR\nRisk Agent Critical"]
        D2["load_graph_node\nrecursive CTE\ntask_dependencies"]
        D3["propagate_node\nrecalculate dates\nall downstream tasks"]
        D4["conflict_node\ncheck milestones\nclient commitments"]
        D5["apply_philosophy\ntimeline_philosophy\nconf > 0.6 orders\nmitigation options"]
        D6["emit_node\nWebSocket push\nrevised dates + impact"]
        D7["log_node\nbefore/after\n+ write evidence"]
        D1 --> D2 --> D3 --> D4 --> D5 --> D6 --> D7
    end

    subgraph E["Track E — Frontend"]
        direction TB
        E1["Task Command\nCenter"]
        E2["Members\nHub"]
        E3["Requirements\nInput"]
        E4["Memory\nChatbot"]
        E5["Insights\nWar Room"]
        E6["WebSocket\nNotifications"]
        E1 --> E2 --> E3 --> E4 --> E5 --> E6
    end

    style GATE1 fill:#2c3e50,color:#fff
    style A fill:#1e8449,color:#fff,stroke:#196f3d
    style B fill:#1a5276,color:#fff,stroke:#154360
    style C fill:#7d6608,color:#fff,stroke:#6e5f07
    style D fill:#6c3483,color:#fff,stroke:#5b2c6f
    style E fill:#1a5276,color:#fff,stroke:#154360
```

**Why parallel?**
- Track A (Forgetting) only touches Celery + Qdrant payload updates — no agent code
- Track B, C, D each call the same `retrieve_node` + `synthesize_node` from Phase 1 but build different graph topologies on top — no shared code between them
- Track E (Frontend) only needs the FastAPI skeleton (Phase 0.8) to call endpoints — it doesn't need agents to be complete

---

## 5. Phase 3 — Preference System (Sequential Within Phase)

Preferences need agents writing evidence first. The four steps inside Phase 3 are sequential — each builds on the previous.

```mermaid
flowchart LR
    subgraph P3["Phase 3 — Preference System"]
        direction LR
        P31["3.1\nEvidence Writing\nAll agents log to\nuser_preference_memory\non every user action"]
        P32["3.2\nConfidence Scoring\nconfidence = consistency_rate\n× 1 − 1 ÷ 1 + evidence_count\nConflict arbitration\nhigher conf wins"]
        P33["3.3\nLearning Mode\nOpt-in toggle\none-step teaching\nseed conf at 0.7"]
        P34["3.4\nPreference Registry UI\nInspect, edit, delete\nOverride rate graph\nConfidence growth chart"]
        P31 --> P32 --> P33 --> P34
    end

    subgraph READS["Preferences read by agents"]
        direction TB
        AA["Assignment Agent\nreads assignment_override\nre-ranks candidates"]
        RA["Risk Agent\nreads risk_tolerance\nsuppresses or escalates\nbefore rendering"]
        CA["Cascade Agent\nreads timeline_philosophy\norders mitigation options"]
        CB["Chatbot\nreads communication_style\nadjusts format and depth"]
    end

    P32 --> AA & RA & CA & CB

    style P3 fill:#e74c3c,color:#fff,stroke:#c0392b
    style READS fill:#2980b9,color:#fff,stroke:#1a5276
    style AA fill:#2980b9,color:#fff
    style RA fill:#2980b9,color:#fff
    style CA fill:#2980b9,color:#fff
    style CB fill:#2980b9,color:#fff
```

**Why sequential?** You cannot compute confidence (3.2) without evidence (3.1). Learning Mode (3.3) is a shortcut into 3.2 — it needs the same scoring infrastructure. The UI (3.4) displays what 3.2 produces.

---

## 6. Phase 4 — Polish (Fully Parallel)

No dependencies between any of these. All start the moment Gate 3 passes.

```mermaid
flowchart TD
    GATE3["🔴 GATE 3\nAt least one agent writing\npreference evidence correctly"]

    GATE3 --> F1 & F2 & F3 & F4 & F5

    F1["Memory Autopsy Panel\nShow loaded memories\nfiltered-out memories\ntoken budget used\npreferences applied"]
    F2["What-If Simulator\nCascade graph\nsimulate=True flag\nno DB writes\nreturn projection only"]
    F3["Qwen2.5-VL:7b\nFile and doc analysis\nin Memory Chatbot\nimage + PDF support"]
    F4["Demo Clock\nCelery 5-min cycle\nadvance sprint control\nfast-forward age field"]
    F5["Suppressed Risk UI\nFilter toggle in Risk Radar\nhover shows reason\nconfidence shown"]

    style GATE3 fill:#2c3e50,color:#fff
    style F1 fill:#2980b9,color:#fff,stroke:#1a5276
    style F2 fill:#2980b9,color:#fff,stroke:#1a5276
    style F3 fill:#2980b9,color:#fff,stroke:#1a5276
    style F4 fill:#2980b9,color:#fff,stroke:#1a5276
    style F5 fill:#2980b9,color:#fff,stroke:#1a5276
```

---

## 7. Data Flow — Why the Sequence Is What It Is

This diagram shows what data each component produces and consumes. Sequential dependencies come from data, not arbitrary ordering.

```mermaid
flowchart LR
    QDRANT[("Qdrant\nvectors + payload")]
    POSTGRES[("Postgres\nevents + preferences\n+ task graph")]
    OLLAMA["Ollama\nQwen3:8b\nQwen3-Embedding\nQwen2.5-VL"]

    INGEST["Ingestion Graph\nPhase 1.2"]
    CHAT["Chat Graph\nPhase 1.3"]
    DECAY["Forgetting\nPhase 2A"]

    AA["Assignment Agent\nPhase 2B"]
    RA["Risk Agent\nPhase 2C"]
    CA["Cascade Agent\nPhase 2D"]

    PREFS["Preference System\nPhase 3"]

    OLLAMA -->|embed + classify + extract| INGEST
    INGEST -->|vectors| QDRANT
    INGEST -->|events| POSTGRES

    QDRANT -->|semantic search| CHAT
    POSTGRES -->|tier + relevance filters| CHAT
    OLLAMA -->|synthesize| CHAT

    POSTGRES -->|read relevance_score| DECAY
    DECAY -->|update payload| QDRANT
    DECAY -->|update tier + score| POSTGRES

    QDRANT -->|retrieve context| AA & RA & CA
    POSTGRES -->|members, tasks, dependencies| AA & RA & CA
    OLLAMA -->|score, detect, propagate| AA & RA & CA

    AA -->|override evidence| PREFS
    RA -->|dismiss evidence| PREFS
    CA -->|scenario choice evidence| PREFS
    CHAT -->|thumbs up/down evidence| PREFS

    PREFS -->|re-rank before output| AA
    PREFS -->|suppress before render| RA
    PREFS -->|order before output| CA
    PREFS -->|format before answer| CHAT

    style QDRANT fill:#27ae60,color:#fff
    style POSTGRES fill:#2980b9,color:#fff
    style OLLAMA fill:#8e44ad,color:#fff
```

---

## 8. Summary Table

| Phase | Sequential or Parallel | Why | Steps |
|---|---|---|---|
| 0 — Infrastructure | 🔴 Sequential | Hard deps: can't query what doesn't exist | 9 steps |
| 1 — Memory Layer | 🔴 Sequential | Embed before store, store before retrieve | 3 steps + gate |
| 2 — Agents + Frontend | 🟢 Parallel (5 tracks) | No code deps between tracks, shared data layer | 5 concurrent tracks |
| 3 — Preferences | 🔴 Sequential | Evidence → scoring → learning mode → UI | 4 steps |
| 4 — Polish | 🟢 Parallel (5 features) | No deps between polish features | 5 concurrent |

**Two sequential chains. Two parallel windows. That's the whole build.**
