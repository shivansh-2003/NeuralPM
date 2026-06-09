# NeuralPM Stack Validation Report
## mem0 + Qdrant + FalkorDB + LangChain + LangGraph vs. All Required Functionality

> **⚠️ Revision note:** This report was originally written against a Neo4j graph backend. The final stack uses **FalkorDB** via the `mem0-falkordb` plugin — all Neo4j references below reflect the original validation context. FalkorDB uses identical mem0 config (same `graph_store` block, `provider: "falkordb"` instead of `provider: "neo4j"`), and all findings remain valid.

> **Validation scope:** Every capability described in `NeuralPM_Documentation.md` and `memory_agent_implementation_strategy.md`, checked against official mem0 docs (docs.mem0.ai), Qdrant docs, mem0 GitHub issues, and the developer stack reference.
>
> **Verdict key:** ✅ Works as-designed | ⚠️ Works with caveat / partial | ❌ Broken / not supported — needs workaround

---

## Executive Summary

| Area | Verdict | Severity |
|---|---|---|
| Semantic vector storage (Qdrant via mem0) | ✅ | — |
| Cross-project isolation via `project_id` | ✅ | — |
| Multi-agent shared memory | ✅ | — |
| Cross-session persistence | ✅ | — |
| LangGraph ingestion + chat graphs | ✅ | — |
| FalkorDB graph memory (via mem0-falkordb plugin) | ✅ `register()` + `provider:"falkordb"` | Low |
| Advanced metadata filter operators (`in`, range, `AND`) | ⚠️ **Wrong syntax in code** — works but uses `$in` instead of `in` | **High** |
| mem0 `search()` entity scoping API (v2.x) | ❌ wrong in strategy code | **Critical** |
| Adaptive forgetting (decay + tiers) | ❌ not in mem0 | High |
| Qwen3 thinking mode / JSON reliability | ⚠️ needs fix | High |
| User preference memory + confidence scoring | ⚠️ custom-only | Medium |
| Hybrid retrieval (semantic + recency + relevance_score) | ⚠️ partial | Medium |
| Context budget allocation | ✅ (custom code only) | — |
| Memory Autopsy panel | ✅ (custom code only) | — |

**Bottom line:** The core add → embed → search loop works. Three issues will break the implementation before it runs: the metadata filter operator syntax (wrong prefix), the search() API change in mem0 v2, and Qwen3 thinking mode. The forgetting mechanism needs custom code. All are fixable — none require replacing a component.

---

## 1. Semantic Vector Memory — ✅ Works

**What NeuralPM needs:** Embed project events (requirement updates, assignments, risk flags, timeline shifts) and retrieve by semantic similarity.

**What the stack delivers:**
- Qdrant stores dense vectors + arbitrary JSON payload per point.
- mem0 wraps Qdrant: `m.add(text, user_id=..., metadata={...})` calls your embedder, upserts into Qdrant, and returns the memory ID.
- `m.search(query, filters={...}, limit=8)` runs cosine similarity search against the collection and returns ranked hits with metadata.
- Qwen3-Embedding (0.6B/4B/8B via Ollama) supported natively as the mem0 `embedder.provider = "ollama"`. Set `embedding_model_dims` to match the model's actual output (up to 4096 for 8B; confirm with `ollama embed`).

**No gaps here.**

---

## 2. Project Isolation via `project_id` — ✅ Works (scalar equality only)

**What NeuralPM needs:** Every memory scoped to a `project_id` so agents from project Alpha never retrieve project Beta's memories.

**What the stack delivers:**
- Pass `project_id` in `metadata={"project_id": "alpha"}` on `add()`.
- Filter on retrieval: `m.search(query, filters={"user_id": "alice", "project_id": "alpha"})`.
- Qdrant evaluates this as a `MatchValue` pre-filter — fast, accurate, uses a payload index.

**Requirement:** Create a Qdrant payload index on `project_id` before loading data:
```python
from qdrant_client import QdrantClient, models
client = QdrantClient(host="localhost", port=6333)
client.create_payload_index(
    collection_name="neuralpm_memories",
    field_name="project_id",
    field_schema=models.PayloadSchemaType.KEYWORD,
)
```
Without the index, Qdrant scans all payloads — still correct but slower at scale.

---

## 3. Advanced Metadata Filter Operators — ⚠️ Supported, But Wrong Syntax in Strategy Code

**Official docs verdict (docs.mem0.ai/open-source/features/metadata-filtering):**

> **Qdrant:** Full comparison, list, and logical support. Handles deeply nested boolean logic efficiently.

The feature works. The strategy code uses the wrong operator prefix.

**What NeuralPM's `retrieve_node` currently writes:**
```python
"memory_tier": {"$in": ["active", "compressed"]}   # ← "$in" with dollar sign — WRONG
"relevance_score": {"$gte": 0.2}                    # ← "$gte" — WRONG
```

**What mem0's actual operator syntax is (no `$` prefix):**
```python
"memory_tier": {"in": ["active", "compressed"]}    # ✅ correct
"relevance_score": {"gte": 0.2}                     # ✅ correct
```

The dollar-sign prefix is MongoDB syntax. mem0 uses bare operator names: `in`, `nin`, `gte`, `gt`, `lte`, `lt`, `eq`, `ne`, `contains`, `icontains`.

**Fixed `retrieve_node`:**
```python
def retrieve_node(state: dict) -> dict:
    if not state.get("project_id"):
        raise ValueError("project_id required")

    results = mem0_client.search(
        state["query"],
        filters={
            "user_id": state["user_id"],
            "project_id": state["project_id"],
            "memory_tier": {"in": ["active", "compressed"]},   # no $ prefix
        },
        limit=8,
    )
    state["retrieved_memories"] = results
    return state
```

**Full example from official docs — AND + OR + range all work on Qdrant:**
```python
results = m.search(
    "What tasks need attention?",
    filters={
        "user_id": "project_manager",
        "AND": [
            {"project": {"in": ["alpha", "beta"]}},
            {"priority": {"gte": 8}},
            {"status": {"ne": "completed"}},
            {"OR": [{"assignee": "alice"}, {"assignee": "bob"}]}
        ]
    }
)
```

**Performance requirement — add `indexed_fields` to config:**
```python
"vector_store": {
    "provider": "qdrant",
    "config": {
        "host": "localhost",
        "port": 6333,
        "collection_name": "neuralpm_memories",
        "embedding_model_dims": 1024,
        "indexed_fields": ["project_id", "memory_tier", "event_type", "user_id"]
    }
}
```
Without `indexed_fields`, filtered queries still work but Qdrant scans all payloads first — noticeably slower once the collection grows past a few thousand points.

**Caveat:** The old GitHub Issue #3975 (filed against mem0 v1.0.3) reported this as broken. The current official docs (for v1.0.0+) explicitly document Qdrant as having "full" support. Either the issue was fixed in a later patch, or the original report mixed up the `$operator` vs. `operator` syntax. Either way, the official docs are the authoritative source — use bare operator names and it works.

---

## 4. mem0 `search()` API Changed in v2.x — ❌ Wrong in Strategy Code (Critical)

**What the strategy code does:**
```python
hits = m.search("payment methods", user_id="test_user", filters={"project_id": "alpha"})
```

**What mem0 v2.x actually requires:**
In mem0 2.x, `search()` rejects top-level `user_id`/`agent_id`/`run_id` kwargs and raises a `ValueError`:
> *"Use filters={'user_id': ...} instead of top-level keyword arguments."*

The internal guard is:
```python
ENTITY_PARAMS = frozenset({"user_id", "agent_id", "run_id"})
# raises ValueError if any appear as top-level kwargs to search()
```

**Fix — move all entity scoping into `filters`:**
```python
# Correct for mem0 v2.x
hits = m.search(
    "payment methods",
    filters={"user_id": "test_user", "project_id": "alpha"},
    limit=8,
)
```
This applies to `retrieve_node`, `test_pipe.py`, and every `m.search()` call in the codebase.

Also: `m.add()` still accepts `user_id` as a direct kwarg in v2.x. Don't move it to `metadata` — keep as `m.add(text, user_id=..., metadata={...})`.

---

## 5. Adaptive Forgetting (Decay + Memory Tiers) — ❌ Not in mem0

**What NeuralPM needs:** Scheduled Celery Beat job that decays `relevance_score`, transitions `memory_tier` (active → compressed → archived), compresses old events with an LLM, and marks superseded memories instantly on override.

**What mem0 provides:** None. mem0 has no built-in TTL, decay, or tiering mechanism. It stores and retrieves; lifecycle management is the caller's responsibility.

**Fix — two-layer architecture:**

The `memory_events` PostgreSQL table in the documentation is the right home for decay state. Mem0/Qdrant holds the embeddings for semantic search. The Celery job updates both:

```python
# celery_tasks/decay.py
from memory_agent.config import mem0_client, pg_conn
from qdrant_client import QdrantClient
from qdrant_client.models import PayloadUpdateOperation, SetPayload

qdrant = QdrantClient(host="localhost", port=6333)

@celery.task
def run_decay_cycle():
    now = datetime.utcnow()
    events = pg_conn.execute("SELECT * FROM memory_events WHERE memory_tier != 'archived'")
    
    for event in events:
        new_score, new_tier = rescore_event(event, now)
        
        # 1. Update PostgreSQL (source of truth for decay fields)
        pg_conn.execute(
            "UPDATE memory_events SET relevance_score=%s, memory_tier=%s WHERE id=%s",
            (new_score, new_tier, event.id)
        )
        
        # 2. Update Qdrant payload so mem0 filters still work
        qdrant.set_payload(
            collection_name="neuralpm_memories",
            payload={"relevance_score": new_score, "memory_tier": new_tier},
            points=[str(event.id)],   # Qdrant point ID = memory_events UUID
        )
        
        # 3. If moving to 'compressed', replace description with LLM summary
        if new_tier == "compressed" and event.memory_tier == "active":
            summary = compress_with_llm(event.description)
            qdrant.set_payload(
                collection_name="neuralpm_memories",
                payload={"compressed_description": summary},
                points=[str(event.id)],
            )
```

Supersession (instant decay on override) must also call `qdrant.set_payload` immediately — not wait for the next Celery cycle.

---

## 6. FalkorDB Graph Memory (Causal Chains) — ✅ Implemented via mem0-falkordb Plugin

> **Updated:** Original validation used Neo4j. Final implementation uses FalkorDB — 496x faster p99 latency, built-in per-user graph isolation, Redis wire protocol (port 6379). Config below reflects the current live stack.

**What NeuralPM needs:** The Memory Agent builds causal chains: `requirement_update → assignment_decision → overload_risk → timeline_shift`. The Cascade Agent uses a Postgres `task_dependencies` table (not graph DB) for structural task traversal.

**What mem0 + FalkorDB delivers:**
Graph Memory via the `mem0-falkordb` plugin. `register()` patches mem0's internal Cypher calls at runtime — no mem0 fork needed.

```python
# MUST be first — before any mem0 import
from mem0_falkordb import register
register()

from mem0 import Memory

config = {
    "vector_store": {
        "provider": "qdrant",
        "config": {"host": "localhost", "port": 6333,
                   "collection_name": "neuralpm_memories", "embedding_model_dims": 1024}
    },
    "graph_store": {
        "provider": "falkordb",           # registered by register()
        "config": {
            "host": "localhost",
            "port": 6379,                 # Redis wire protocol
            "database": "mem0",
        },
        "custom_prompt": "Capture engineers, tasks, requirements, risks, sprints, modules. "
                         "Link causally: ASSIGNED_TO, BLOCKS, CAUSED_BY, DELAYED_BY, PART_OF."
    },
    "embedder": {
        "provider": "ollama",
        "config": {"model": "qwen3-embedding:0.6b",   # 1024 dims — match EMBED_DIMS
                   "ollama_base_url": "http://localhost:11434"}
    },
    "llm": {
        "provider": "ollama",
        "config": {"model": "qwen3:8b", "ollama_base_url": "http://localhost:11434"}
    }
}
m = Memory.from_config(config)
```

FalkorDB auto-creates one graph per `user_id`: `mem0_{user_id}`. Per-user isolation is physical — a query for user A cannot touch user B's graph.


On `m.search()`, results include a `relations` array with graph-connected entities alongside vector hits.

**Caveat:** Mem0's graph extraction LLM infers entities from natural language text. For causal chains to form correctly, the text passed to `m.add()` must be rich and explicit:
```python
# Good — extraction LLM can form "CAUSED" edge
m.add(
    "The payment API deadline was extended by 3 days because Sarah's overload risk "
    "was flagged by the Risk Agent after the Stripe requirement update increased scope.",
    user_id="project_alpha",
    metadata={"project_id": "alpha", "event_type": "timeline_shift"}
)

# Bad — sparse, no causal language
m.add("Payment API: +3d", user_id="project_alpha", ...)
```

**Task dependency graph for the Cascade Agent** uses a Postgres `task_dependencies` table with a recursive CTE — NOT the graph DB. This is structured relational data (Task A `BLOCKS` Task B), handled more efficiently in Postgres for Phase 1. FalkorDB handles unstructured entity/relationship extraction from natural language events only.

```sql
-- task_dependencies table (Postgres — used by Cascade Agent)
CREATE TABLE task_dependencies (
    task_id       UUID REFERENCES tasks(id),
    depends_on_id UUID REFERENCES tasks(id),
    PRIMARY KEY (task_id, depends_on_id)
);
-- Cascade Agent traversal uses recursive CTE on this table
```

---

## 7. Qwen3 Thinking Mode + JSON Reliability — ⚠️ Needs Fix

**What NeuralPM needs:** `classify_node` and `extract_node` must return valid JSON deterministically.

**The problem:** Qwen3 thinks by default. In one benchmark (GitHub QwenLM/Qwen3 #1817), thinking mode caused ~60% JSON output failure in agentic loops — the model "plans" the JSON output in its reasoning block and then fails to emit it.

**Fix — disable thinking + use schema-constrained format:**
```python
from langchain_ollama import ChatOllama
from memory_agent.schemas.requirement import ClassifyResult

# Option A: format=schema (Ollama structured outputs — most reliable)
llm = ChatOllama(model="qwen3:8b", temperature=0)
structured_llm = llm.with_structured_output(ClassifyResult)
result = structured_llm.invoke(f"/no_think\n{CLASSIFY_PROMPT.format(text=state['raw_text'])}")

# Option B: format="json" + /no_think in prompt
llm = ChatOllama(model="qwen3:8b", temperature=0, format="json")
response = llm.invoke(f"/no_think\n{CLASSIFY_PROMPT.format(text=state['raw_text'])}")
```

Also: strip thinking fences before `json.loads()`:
```python
content = response.content
# Strip <think>...</think> block if present
import re
content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
# Strip markdown fences
content = content.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
result = json.loads(content)
```

---

## 8. User Preference Memory + Confidence Scoring — ⚠️ Custom Only

**What NeuralPM needs:** The `user_preference_memory` table with `confidence`, `evidence_count`, `consistency_rate`, and the confidence-weighted arbitration logic.

**What mem0 provides:** Nothing specific to this. You could store preferences as mem0 memories (`m.add("Alice prefers Sarah for backend tasks", user_id="alice")`), but the confidence scoring, evidence accumulation, and arbitration between conflicting preferences is entirely application-level logic.

**Verdict:** This is correctly implemented as a separate PostgreSQL table. mem0/Qdrant/Neo4j are not the right tool here — don't try to force preferences into the memory layer. The design in the documentation is correct. No stack change needed; just implement the `user_preference_memory` table and `get_preferences()` function outside mem0.

---

## 9. Hybrid Retrieval (Semantic + Recency + Relevance Score Ranking) — ⚠️ Partial

**What NeuralPM needs:**
```python
ranked = rank_by(candidates, query=query, user_id=user_id)  # semantic + recency + relevance
```

**What mem0 delivers:** mem0 returns results ranked by vector cosine similarity only. It does not blend recency or `relevance_score` into ranking.

**Fix — custom re-ranking after retrieval:**
```python
def rank_by(memories: list, query_time=None) -> list:
    """Blend cosine similarity, recency, and relevance_score."""
    for m in memories:
        cosine = m.get("score", 0.0)          # from Qdrant via mem0
        relevance = m["metadata"].get("relevance_score", 1.0)
        age_days = (datetime.utcnow() - m["metadata"]["timestamp"]).days
        recency = max(0.0, 1.0 - age_days / 365)   # linear decay over 1 year
        m["_blended_score"] = (0.5 * cosine) + (0.3 * relevance) + (0.2 * recency)
    return sorted(memories, key=lambda m: m["_blended_score"], reverse=True)
```

Weights (0.5 / 0.3 / 0.2) are tunable. This runs in Python after `m.search()` returns, no Qdrant changes needed.

---

## 10. Multi-Agent Memory Sharing — ✅ Works

All four agents (Assignment, Risk, Cascade, Memory/chatbot) share one `mem0_client` instance pointed at one Qdrant collection. Scoping is by `project_id` in metadata and `user_id` in filters. No concurrency issues — Qdrant handles concurrent reads/writes natively.

**Pattern:**
```python
# In each agent's config.py — same client, same collection
mem0_client = Memory.from_config(shared_config)

# Assignment Agent writes
mem0_client.add("Assigned Payment API to Sarah. Score: 92.", user_id=project_id,
                metadata={"project_id": project_id, "event_type": "assignment", "agent_source": "assignment_agent"})

# Risk Agent reads
results = mem0_client.search("Sarah workload", filters={"user_id": project_id, "project_id": project_id})
```

---

## 11. Cross-Session Persistence — ✅ Works

Qdrant configured with a server (Docker or Qdrant Cloud) persists all vectors to disk. mem0 re-connects on startup — no state is lost between sessions.

**Required config:** `on_disk: True` in the Qdrant collection params (or use a Docker volume mount):
```bash
docker run -p 6333:6333 -v "$(pwd)/qdrant_storage:/qdrant/storage:z" qdrant/qdrant
```
Do NOT use `path="/tmp/qdrant"` (the mem0 default) in production — `/tmp` is cleared on restart.

---

## 12. LangGraph Ingestion + Chat Graphs — ✅ Works (1 deprecation fix)

**One API change needed:** The strategy code uses the deprecated `set_entry_point`:
```python
# Strategy code (deprecated)
graph.set_entry_point("classify")

# LangGraph 1.0 idiom (use this)
from langgraph.graph import START, END
graph.add_edge(START, "classify")
graph.add_edge("store", END)
```

Both work in LangGraph 0.x and 1.0, but `add_edge(START, ...)` is the stable form going forward.

**Dependency pinning:** pin `langgraph` and `langgraph-prebuilt` to identical versions. A minor version drift between them breaks `ToolNode` at import time.

---

## 13. Context Budget Allocation — ✅ Works (custom code only)

The `allocate_context()` function in the documentation is pure Python and runs on top of mem0's returned results. No framework support needed — implement as written.

---

## 14. Memory Autopsy Panel — ✅ Works (custom code only)

The Autopsy is a logging + display layer. Capture what mem0's `search()` returns, what you filtered out in post-processing, and what preferences were applied. Return this alongside the chatbot answer in the API response. No mem0/Qdrant changes needed.

---

## Complete Fixed Configuration

```python
# memory_agent/config.py — current production-ready config (FalkorDB, not Neo4j)

# ⚠️ register() MUST be FIRST — before any mem0 import
from mem0_falkordb import register
register()

from mem0 import Memory

mem0_client = Memory.from_config({
    "vector_store": {
        "provider": "qdrant",
        "config": {
            "host": "localhost",
            "port": 6333,
            "collection_name": "neuralpm_memories",
            "embedding_model_dims": 1024,   # qwen3-embedding:0.6b = 1024 dims
            "on_disk": True,
        }
    },
    "graph_store": {                         # FalkorDB — replaces Neo4j
        "provider": "falkordb",              # registered by register() above
        "config": {
            "host": "localhost",
            "port": 6379,                   # Redis wire protocol
            "database": "mem0",
        },
        "custom_prompt": (
            "Extract: task names, engineer names, requirement descriptions, risk types, "
            "sprint names. Link events causally: ASSIGNED_TO, BLOCKS, CAUSED_BY, "
            "DELAYED_BY, FLAGGED, PART_OF."
        ),
    },
    "llm": {
        "provider": "ollama",
        "config": {
            "model": "qwen3:8b",
            "ollama_base_url": "http://localhost:11434",
        }
    },
    "embedder": {
        "provider": "ollama",
        "config": {
            "model": "qwen3-embedding:0.6b",  # NOT :4b — 0.6b = 1024 dims
            "ollama_base_url": "http://localhost:11434",
        }
    }
})
```

---

## Priority Fix List

| # | Fix | File | Effort |
|---|---|---|---|
| 1 | Move `user_id` into `filters` on all `m.search()` calls | retrieve.py, test_pipe.py | 15 min |
| 2 | Remove `$` prefix from all filter operators: `$in` → `in`, `$gte` → `gte` | retrieve.py | 10 min |
| 3 | Add `indexed_fields` to Qdrant config for filter performance | config.py | 5 min |
| 4 | Add `/no_think` + `format="json"` / strip thinking block on LLM calls | classify.py, extract.py | 30 min |
| 5 | Add `graph_store` block to config + `pip install "mem0ai[graph]"` | config.py | 10 min |
| 6 | Build Celery decay job that updates both Postgres and Qdrant payload | celery_tasks/decay.py | 2-3 hrs |
| 7 | Replace `graph.set_entry_point()` with `graph.add_edge(START, ...)` | ingestion.py, chat.py | 5 min |
| 8 | Pin `qdrant/qdrant` Docker image to a specific version tag | docker-compose.yml | 5 min |

Fixes 1–5 and 7–8 are required before the first `test_pipe.py` run succeeds. Fix 6 is required before any forgetting/tiering feature works.

---

## What FalkorDB Specifically Covers That Qdrant Cannot

| Capability | Qdrant | FalkorDB (via mem0-falkordb) |
|---|---|---|
| "Find all tasks Sarah was assigned to" | Semantic similarity search | `MATCH (s {name:'Sarah'})-[:ASSIGNED_TO]->(t) RETURN t.name` |
| "What caused the API delay?" | Returns semantically similar events | Traverses CAUSED_BY edges: `MATCH p=()-[:CAUSED_BY*1..3]->(delay)` |
| Multi-hop reasoning | Not possible | Full Cypher graph traversal |
| Structured relationship queries | Not possible | `MATCH (r:Risk)-[:AFFECTS]->(t:Task) RETURN r, t` |
| GDPR deletion | Complex payload filter + delete | `DELETE GRAPH mem0_{user_id}` — one command |
| Per-user isolation | Metadata filter on shared collection | Physical separate graph per user_id |

The Cascade Agent's **task dependency graph** uses Postgres `task_dependencies` + recursive CTE — not FalkorDB. FalkorDB handles entity/relationship extraction from natural language events only.

---

*Validated against: mem0 docs (docs.mem0.ai), FalkorDB blog + GitHub (mem0-falkordb), qdrant-client 1.12.x docs, LangGraph 0.2.60 changelog, Qwen3 GitHub Issue #1817, and the NeuralPM implementation strategy.*
