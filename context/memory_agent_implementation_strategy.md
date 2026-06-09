# NeuralPM Memory Agent — Technical Implementation Strategy

> ⚠️ **SUPERSEDED — DO NOT BUILD FROM THIS DOCUMENT**
>
> This is the original MVP strategy. The live implementation differs in the following ways:
>
> | Item | This doc (old) | Current implementation |
> |---|---|---|
> | Graph store | Neo4j | **FalkorDB** via `mem0-falkordb` plugin |
> | mem0 status | Active | **Active** — reinstated with `mem0ai[graph]` |
> | `m.search()` API | `user_id="test_user"` top-level | `filters={"user_id": "test_user"}` (mem0 v2.x) |
> | Filter operators | `{"$in": [...]}` | `{"in": [...]}` (no `$` prefix) |
> | Embedding model | `qwen3:embedding` | `qwen3-embedding:0.6b` (1024 dims) |
> | FalkorDB registration | Not present | `from mem0_falkordb import register; register()` before mem0 import |
> | LangGraph entry | `set_entry_point()` | `add_edge(START, ...)` |
> | Chat graph nodes | 2 (retrieve → synthesize) | 4 (retrieve → allocate_context → synthesize → autopsy) |
>
> **Current implementation:** [`memory_agent_technical.md`](./memory_agent_technical.md)

---

> Scope: Step 0 + Step 1 + Step 2 only.
> Goal: Close the ingest → retrieve → answer loop before touching decay, preferences, or autopsy.

---

## Tech Stack Decision

| Layer | Choice | Why |
|---|---|---|
| Vector store | **Qdrant** (local Docker or Qdrant Cloud) | Native payload filtering — the `project_id` scoping in Step 2 is a hard filter, not post-filter. Qdrant does this in the query itself. |
| Memory abstraction | **Mem0** | Wraps Qdrant with add/search/get. Handles embedding + upsert in one call. You don't manage the collection schema yourself. |
| Embedding model | **Qwen/Qwen3-Embedding** (via Ollama or API) | Consistent with the rest of the Qwen stack. Swap to OpenAI `text-embedding-3-small` if latency matters for the demo — the model is swappable in Mem0's config without touching any other code. |
| LLM for classify/extract/synthesize | **Qwen 3** (via Ollama locally, or the API) | Single model for all three nodes. 8B is enough for classify and extract; use 30B or 72B for synthesize if answer quality is thin. |
| Orchestration | **LangGraph** | Two graphs share one Qdrant + Mem0 instance. LangGraph's state dict passes cleanly between nodes — no globals. |
| Schema validation | **Pydantic v2** | Extract node outputs a Pydantic object. If the LLM produces malformed JSON, Pydantic catches it before it hits Qdrant. |
| Backend API | **FastAPI** | Two endpoints: `POST /ingest` and `POST /chat`. Thin wrapper around the two graphs. |
| Frontend | **React 18 + Vite** | One input for raw requirement text. One input for chat query. No state management library needed yet. |

---

## Repository Structure

```
neuralpm-memory/
├── backend/
│   ├── memory_agent/
│   │   ├── __init__.py
│   │   ├── config.py            # Qdrant URL, Mem0 config, model names
│   │   ├── graphs/
│   │   │   ├── ingestion.py     # LangGraph ingestion graph
│   │   │   └── chat.py          # LangGraph chat graph
│   │   ├── nodes/
│   │   │   ├── classify.py
│   │   │   ├── extract.py
│   │   │   ├── store.py
│   │   │   ├── retrieve.py
│   │   │   └── synthesize.py
│   │   └── schemas/
│   │       └── requirement.py   # Pydantic models
│   ├── api.py                   # FastAPI app
│   └── requirements.txt
└── frontend/
    └── src/
        ├── App.jsx
        ├── components/
        │   ├── IngestForm.jsx
        │   └── ChatPanel.jsx
        └── api.js
```

---

## Step 0 — Verify the Pipe

Before writing graph code, confirm Qdrant and Mem0 are connected and working.

```python
# test_pipe.py — run this first, stop until it passes
from mem0 import Memory

config = {
    "vector_store": {
        "provider": "qdrant",
        "config": {
            "host": "localhost",
            "port": 6333,
            "collection_name": "neuralpm_memories",
            "embedding_model_dims": 1024,  # adjust to your embedding model
        }
    },
    "embedder": {
        "provider": "ollama",
        "config": {"model": "qwen3:embedding"}  # or openai text-embedding-3-small
    }
}

m = Memory.from_config(config)

# Write
result = m.add(
    "Users can pay via Stripe using saved cards or new card entry",
    user_id="test_user",
    metadata={"project_id": "alpha", "sprint_id": "sprint_1", "event_type": "requirement_update"}
)
print("Added:", result)

# Read
hits = m.search(
    "payment methods",
    user_id="test_user",
    filters={"project_id": "alpha"}
)
print("Found:", hits)
# Expected: at least one hit containing the Stripe requirement
```

**Pass criteria:** The search returns the memory you just added. If it doesn't:
- Check Qdrant is running: `docker ps | grep qdrant`
- Check `embedding_model_dims` matches your model's output dimension
- Check `user_id` is the same in add and search — Mem0 scopes by user_id by default

Do not proceed to Step 1 until this passes.

---

## Step 1 — Ingestion Graph

### Pydantic Schema

```python
# memory_agent/schemas/requirement.py
from pydantic import BaseModel, Field
from typing import Literal, Optional
from uuid import UUID

class RequirementEvent(BaseModel):
    event_type: Literal["requirement_update"] = "requirement_update"
    description: str = Field(..., description="Clean one-sentence summary of the requirement")
    acceptance_criteria: list[str] = Field(default_factory=list, description="Testable conditions")
    priority: Literal["critical", "high", "medium", "low"] = "medium"
    affected_module: Optional[str] = None   # e.g. "payment", "auth", "dashboard"
    project_id: str
    sprint_id: Optional[str] = None
    parent_requirement_id: Optional[str] = None

class ClassifyResult(BaseModel):
    type: Literal["requirement_update", "casual_chat", "preference_signal"]
    confidence: float
```

### Node: classify.py

```python
# memory_agent/nodes/classify.py
import json
from langchain_ollama import ChatOllama

llm = ChatOllama(model="qwen3:8b", temperature=0)

CLASSIFY_PROMPT = """Classify this message from a Product Owner or team member.

Message: {text}

Return ONLY valid JSON matching this schema:
{{"type": "requirement_update" | "casual_chat" | "preference_signal", "confidence": 0.0-1.0}}

- requirement_update: describes a feature, user story, acceptance criterion, or change to scope
- casual_chat: greetings, status checks, general conversation
- preference_signal: expresses a personal preference about how the system should behave

Return only JSON. No explanation."""

def classify_node(state: dict) -> dict:
    prompt = CLASSIFY_PROMPT.format(text=state["raw_text"])
    response = llm.invoke(prompt)
    
    try:
        result = json.loads(response.content)
        state["classification"] = result
    except json.JSONDecodeError:
        # LLM produced invalid JSON — default to casual_chat so we don't store garbage
        state["classification"] = {"type": "casual_chat", "confidence": 0.0}
    
    return state
```

### Node: extract.py

```python
# memory_agent/nodes/extract.py
import json
from langchain_ollama import ChatOllama
from memory_agent.schemas.requirement import RequirementEvent

llm = ChatOllama(model="qwen3:8b", temperature=0)

EXTRACT_PROMPT = """Extract structured requirement details from this message.

Project ID: {project_id}
Sprint ID: {sprint_id}
Message: {text}

Return ONLY valid JSON matching this exact schema:
{{
  "event_type": "requirement_update",
  "description": "<one clear sentence describing the requirement>",
  "acceptance_criteria": ["<criterion 1>", "<criterion 2>"],
  "priority": "critical" | "high" | "medium" | "low",
  "affected_module": "<module name or null>",
  "project_id": "{project_id}",
  "sprint_id": "{sprint_id}",
  "parent_requirement_id": null
}}

Rules:
- description must be a single complete sentence
- acceptance_criteria should be testable, concrete conditions (2-4 items)
- If priority is not stated, infer from urgency language
- affected_module: extract the domain area (auth, payment, dashboard, etc.) or null

Return only JSON."""

def extract_node(state: dict) -> dict:
    # Only runs if classification was requirement_update
    if state["classification"]["type"] != "requirement_update":
        return state
    
    prompt = EXTRACT_PROMPT.format(
        text=state["raw_text"],
        project_id=state["project_id"],
        sprint_id=state.get("sprint_id", "unassigned")
    )
    response = llm.invoke(prompt)
    
    try:
        raw_json = json.loads(response.content)
        # Validate against Pydantic schema — raises ValidationError if malformed
        event = RequirementEvent(**raw_json)
        state["extracted_event"] = event
    except Exception as e:
        state["extraction_error"] = str(e)
    
    return state
```

### Node: store.py

```python
# memory_agent/nodes/store.py
from memory_agent.config import mem0_client

def store_node(state: dict) -> dict:
    event = state.get("extracted_event")
    if not event:
        state["store_result"] = {"status": "skipped", "reason": "not a requirement_update"}
        return state
    
    # The text that gets embedded — rich enough for semantic search
    embed_text = f"{event.description}. Acceptance criteria: {'. '.join(event.acceptance_criteria)}"
    
    metadata = {
        "event_type": event.event_type,
        "priority": event.priority,
        "affected_module": event.affected_module,
        "project_id": event.project_id,
        "sprint_id": event.sprint_id,
        "parent_requirement_id": event.parent_requirement_id,
        "memory_tier": "active",
        "relevance_score": 1.0,
    }
    
    result = mem0_client.add(
        embed_text,
        user_id=state["user_id"],
        metadata=metadata
    )
    
    state["store_result"] = result
    return state
```

### Graph: ingestion.py

```python
# memory_agent/graphs/ingestion.py
from langgraph.graph import StateGraph, END
from memory_agent.nodes.classify import classify_node
from memory_agent.nodes.extract import extract_node
from memory_agent.nodes.store import store_node

def should_extract(state: dict) -> str:
    if state["classification"]["type"] == "requirement_update":
        return "extract"
    return END  # casual_chat or preference_signal — skip to end

def build_ingestion_graph():
    graph = StateGraph(dict)
    
    graph.add_node("classify", classify_node)
    graph.add_node("extract", extract_node)
    graph.add_node("store", store_node)
    
    graph.set_entry_point("classify")
    graph.add_conditional_edges("classify", should_extract, {"extract": "extract", END: END})
    graph.add_edge("extract", "store")
    graph.add_edge("store", END)
    
    return graph.compile()

ingestion_graph = build_ingestion_graph()
```

---

## Step 2 — Chat Graph

### Node: retrieve.py

```python
# memory_agent/nodes/retrieve.py
from memory_agent.config import mem0_client

MAX_RESULTS = 8

def retrieve_node(state: dict) -> dict:
    if not state.get("project_id"):
        raise ValueError("project_id is required — no cross-project leakage allowed")
    
    results = mem0_client.search(
        state["query"],
        user_id=state["user_id"],
        filters={
            "project_id": state["project_id"],
            "memory_tier": {"$in": ["active", "compressed"]}  # never return archived
        },
        limit=MAX_RESULTS
    )
    
    state["retrieved_memories"] = results
    return state
```

**Important:** The `project_id` hard filter is not optional — it's the scoping guarantee. If `project_id` is missing from state, the function raises immediately. No soft fallback to returning all memories.

### Node: synthesize.py

```python
# memory_agent/nodes/synthesize.py
import json
from langchain_ollama import ChatOllama

llm = ChatOllama(model="qwen3:8b", temperature=0.2)

SYNTHESIZE_PROMPT = """You are a project intelligence assistant. Answer the user's question 
using ONLY the project memories provided below. Do not use outside knowledge.

Project memories:
{memories}

User question: {query}

Rules:
- Answer directly and concisely
- Cite the memory ID(s) that support each claim, e.g. [mem_abc123]
- If the memories do not contain enough information, say so clearly
- Do not invent facts not present in the memories"""

def format_memories(memories: list) -> str:
    lines = []
    for m in memories:
        mem_id = m.get("id", "unknown")
        text = m.get("memory", "")
        meta = m.get("metadata", {})
        module = meta.get("affected_module", "")
        priority = meta.get("priority", "")
        lines.append(f"[{mem_id}] ({module}, {priority}): {text}")
    return "\n".join(lines)

def synthesize_node(state: dict) -> dict:
    memories = state.get("retrieved_memories", [])
    
    if not memories:
        state["answer"] = "No relevant memories found for this project."
        return state
    
    prompt = SYNTHESIZE_PROMPT.format(
        memories=format_memories(memories),
        query=state["query"]
    )
    
    response = llm.invoke(prompt)
    state["answer"] = response.content
    return state
```

### Graph: chat.py

```python
# memory_agent/graphs/chat.py
from langgraph.graph import StateGraph, END
from memory_agent.nodes.retrieve import retrieve_node
from memory_agent.nodes.synthesize import synthesize_node

def build_chat_graph():
    graph = StateGraph(dict)
    
    graph.add_node("retrieve", retrieve_node)
    graph.add_node("synthesize", synthesize_node)
    
    graph.set_entry_point("retrieve")
    graph.add_edge("retrieve", "synthesize")
    graph.add_edge("synthesize", END)
    
    return graph.compile()

chat_graph = build_chat_graph()
```

---

## FastAPI Endpoints

```python
# api.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from memory_agent.graphs.ingestion import ingestion_graph
from memory_agent.graphs.chat import chat_graph

app = FastAPI()

class IngestRequest(BaseModel):
    raw_text: str
    project_id: str
    sprint_id: str | None = None
    user_id: str = "default_user"

class ChatRequest(BaseModel):
    query: str
    project_id: str
    user_id: str = "default_user"

@app.post("/ingest")
def ingest(req: IngestRequest):
    state = req.model_dump()
    result = ingestion_graph.invoke(state)
    return {
        "classification": result.get("classification"),
        "stored": result.get("store_result"),
        "error": result.get("extraction_error")
    }

@app.post("/chat")
def chat(req: ChatRequest):
    if not req.project_id:
        raise HTTPException(status_code=400, detail="project_id is required")
    
    state = req.model_dump()
    result = chat_graph.invoke(state)
    return {
        "answer": result.get("answer"),
        "memories_used": len(result.get("retrieved_memories", []))
    }
```

---

## Shared Config

```python
# memory_agent/config.py
from mem0 import Memory

QDRANT_HOST = "localhost"
QDRANT_PORT = 6333
COLLECTION_NAME = "neuralpm_memories"
EMBEDDING_DIMS = 1024  # match your model

mem0_client = Memory.from_config({
    "vector_store": {
        "provider": "qdrant",
        "config": {
            "host": QDRANT_HOST,
            "port": QDRANT_PORT,
            "collection_name": COLLECTION_NAME,
            "embedding_model_dims": EMBEDDING_DIMS,
        }
    },
    "embedder": {
        "provider": "ollama",
        "config": {"model": "qwen3:embedding"}
    }
})
```

---

## Day-by-Day Build Plan

### Day 1 — Pipe verification
- `docker run -p 6333:6333 qdrant/qdrant`
- `ollama pull qwen3:8b && ollama pull qwen3:embedding`
- Run `test_pipe.py`. Do not move on until add/search works.

### Day 2 — Ingestion graph
- Build schemas → classify node → extract node → store node in that order
- Test each node in isolation with `node({raw_text: "...", project_id: "alpha"})` before wiring the graph
- Wire `ingestion.py` and test with three message types: a real requirement, a "hey team" greeting, and an ambiguous one
- Verify Qdrant has the entry: `curl localhost:6333/collections/neuralpm_memories/points/scroll`

### Day 3 — Chat graph
- Build retrieve node — test the `project_id` filter isolation first: add a memory under project "beta", confirm a search against project "alpha" doesn't return it
- Build synthesize node — test with hardcoded memory strings before hooking up real retrieval
- Wire `chat.py` end-to-end
- Wrap both graphs in FastAPI

### Day 4 — React frontend
- Vite React project, two panels side by side
- Left panel: textarea + project_id field + "Ingest" button → calls `POST /ingest` → shows classification result
- Right panel: textarea + same project_id field + "Ask" button → calls `POST /chat` → shows answer with memory count
- No styling needed yet — this is just proof of the loop

---

## Common Failure Modes to Watch For

| Failure | Symptom | Fix |
|---|---|---|
| Wrong embedding dims | Qdrant rejects the add call | Match `embedding_model_dims` in config to your model's actual output size |
| user_id mismatch | Search returns nothing | Mem0 scopes by user_id — use the same string in add and search |
| LLM returns fenced JSON | `json.loads` fails with `JSONDecodeError` | Strip ```json fences before parsing: `text.strip().removeprefix("```json").removesuffix("```")` |
| project_id filter too strict | Qdrant filter syntax differs by version | Check Mem0's filter syntax for your version — some versions use `{"must": [{"key": "project_id", "match": {"value": "alpha"}}]}` |
| Classify always returns casual_chat | Model doesn't follow JSON-only instruction | Add `format="json"` to the ChatOllama call, or switch to a model with stronger instruction-following |

---

## What Is Explicitly Out of Scope

These are confirmed post-MVP — do not build them now:

- Decay / relevance scoring / memory tiers  
- User preference memory  
- Memory Autopsy panel  
- Multi-turn conversation history in the chat graph  
- Cascade, Risk, or Assignment agents  
- Any authentication  
- Sprint management UI  

The only milestone that matters right now: **paste a messy requirement → see a clean, retrievable memory → ask a question → get a grounded answer.**
