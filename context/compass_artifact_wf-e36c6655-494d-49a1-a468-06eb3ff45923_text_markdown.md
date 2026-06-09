# Developer Stack Documentation Reference: Qdrant + Mem0 + LangGraph + Qwen3/Ollama + Pydantic v2 + FastAPI + React/Vite

> ⚠️ **SUPERSEDED** — This is an early research reference. Key findings that have since been resolved or changed:
> - **Advanced filter operators** (`in`, `gte`, `AND`): documented as broken (Issue #3975) — official mem0 docs now confirm full Qdrant support. Use bare names (`{"in": [...]}` not `{"$in": [...]}`).
> - **Neo4j** has been replaced by **FalkorDB** via `mem0-falkordb` plugin.
> - **mem0** is actively used (not dropped) — `mem0ai[graph]` with FalkorDB as `graph_store`.
>
> **Current reference documents:** `tech_stack.md`, `technical_overview.md`, `stack_validation_report.md`

## TL;DR
- Every tool in this stack has authoritative first-party docs: Qdrant (qdrant.tech), Mem0 (docs.mem0.ai), LangGraph (docs.langchain.com + reference.langchain.com), Ollama/Qwen3 (ollama.com/library), Pydantic v2 (docs.pydantic.dev), FastAPI (fastapi.tiangolo.com), and React/Vite (react.dev + vite.dev). Use these over blog posts.
- The two highest-risk integration points are (1) **Mem0 OSS advanced metadata filtering against Qdrant is documented but reported broken** — per mem0 GitHub Issue #3975, "All operators except simple scalar equality matching fail with ValidationError," so filter `project_id`/`memory_tier` by exact match or post-filter in code; and (2) **qdrant-client/server version skew** triggers a loud incompatibility warning (major must match, minor diff ≤1).
- Use modern API surfaces throughout: LangGraph 1.0 (`add_edge(START, ...)` not `set_entry_point`), Pydantic v2 (`.model_dump()` not `.dict()`), Qdrant `query_points` (not deprecated `search`), and `ChatOllama` from `langchain-ollama` (not `langchain_community`).

## Key Findings

### 1. Qdrant
- **Primary docs:** https://qdrant.tech/documentation/ — **GitHub:** https://github.com/qdrant/qdrant (server) and https://github.com/qdrant/qdrant-client (Python).
- **Local Docker:** `docker run -p 6333:6333 -p 6334:6334 -v "$(pwd)/qdrant_storage:/qdrant/storage:z" qdrant/qdrant`. REST on 6333, gRPC on 6334, Web UI at localhost:6333/dashboard.
- **Collections/named vectors:** create with `models.VectorParams(size=..., distance=models.Distance.COSINE)`; named vectors pass a dict to `vectors_config`.
- **Payload filters at query time:** use `query_points(..., query_filter=Filter(must=[FieldCondition(...)]))` — pre-filtering, not post-filtering.
- **Client version compatibility:** loud warning when client/server major mismatch or minor diff >1.

### 2. Mem0
- **Primary docs:** https://docs.mem0.ai/ — **GitHub:** https://github.com/mem0ai/mem0.
- **Qdrant backend config + `Memory.from_config()`** documented at https://docs.mem0.ai/components/vectordbs/dbs/qdrant.
- **Known issue:** advanced metadata filtering against Qdrant reported broken; simple scalar equality works.

### 3. LangGraph
- **Primary docs:** https://docs.langchain.com/oss/python/langgraph/ — **API reference:** https://reference.langchain.com/python/langgraph/ — **GitHub:** https://github.com/langchain-ai/langgraph.
- StateGraph with plain dict/TypedDict; nodes return partial dict updates.
- LangGraph 1.0 (shipped October 22, 2025): no breaking changes from late 0.x; `set_entry_point` deprecated in favor of `add_edge(START, ...)`.

### 4. Qwen3 via Ollama
- **Model page:** https://ollama.com/library/qwen3 — embeddings: https://ollama.com/library/qwen3-embedding.
- Tags include qwen3:0.6b, 1.7b, 4b, 8b, 14b, 30b, 32b, 235b.
- Use via `ChatOllama` from `langchain-ollama`; JSON via `format="json"` or `format=schema`.

### 5. Pydantic v2
- **Primary docs:** https://docs.pydantic.dev/latest/ — **migration:** https://docs.pydantic.dev/latest/migration/ — **GitHub:** https://github.com/pydantic/pydantic.

### 6. FastAPI
- **Primary docs:** https://fastapi.tiangolo.com/ — **GitHub:** https://github.com/fastapi/fastapi.

### 7. React 18 + Vite
- **React docs:** https://react.dev/ — **Vite docs:** https://vite.dev/.

## Details

### 1. Qdrant (vector database)

**Primary documentation:** https://qdrant.tech/documentation/
**GitHub:** https://github.com/qdrant/qdrant (engine, Rust) · https://github.com/qdrant/qdrant-client (Python client) · API reference: https://api.qdrant.tech/

**Most relevant sections:**
- **Local Quickstart** (https://qdrant.tech/documentation/quickstart/) and **Installation** (https://qdrant.tech/documentation/guides/installation/): run locally via Docker. Canonical command:
  ```
  docker pull qdrant/qdrant
  docker run -p 6333:6333 -p 6334:6334 \
    -v "$(pwd)/qdrant_storage:/qdrant/storage:z" \
    qdrant/qdrant
  ```
  REST API at `localhost:6333`, gRPC at `localhost:6334`, Web UI at `localhost:6333/dashboard`. Data persists in `./qdrant_storage`. **Gotcha:** Docker/WSL on Windows with bind mounts is known to have filesystem problems that can cause data loss — use a named Docker volume on Windows.
- **Collections** (https://qdrant.tech/documentation/concepts/collections/): Single (unnamed) vector:
  ```python
  from qdrant_client import QdrantClient, models
  client = QdrantClient(url="http://localhost:6333")
  client.create_collection(
      collection_name="my_collection",
      vectors_config=models.VectorParams(size=1024, distance=models.Distance.COSINE),
  )
  ```
  **Named vectors** (multiple vectors per point, each with its own size/metric) — pass a dict to `vectors_config`:
  ```python
  client.create_collection(
      collection_name="my_collection",
      vectors_config={
          "text": models.VectorParams(size=1024, distance=models.Distance.COSINE),
          "image": models.VectorParams(size=512, distance=models.Distance.DOT),
      },
  )
  ```
  Distance options: `Distance.COSINE`, `Distance.DOT`, `Distance.EUCLID`, `Distance.MANHATTAN`. Cosine vectors are auto-normalized on upload. **Gotcha:** recreating an existing collection name errors — check `client.collection_exists(name)` first. `recreate_collection` is deprecated.
- **Points/upsert with payload** (https://qdrant.tech/documentation/concepts/points/):
  ```python
  client.upsert(
      collection_name="my_collection",
      points=[models.PointStruct(id=1, vector=[...], payload={"project_id": "p1", "memory_tier": "hot"})],
  )
  ```
  For named vectors, `vector` is a dict keyed by vector name. IDs must be unsigned ints or UUIDs. Uploading points one-by-one is discouraged (request overhead) — use `upsert` with batches, or the `upload_collection`/`upload_points` helpers.
- **Filtering** (https://qdrant.tech/documentation/concepts/filtering/) and **query/search** (https://qdrant.tech/documentation/concepts/search/): payload filters are applied as **pre-filters at query time** via `query_filter`, NOT post-filter. Clauses: `must` (AND), `should` (OR), `must_not` (NOT). Conditions: `MatchValue`, `MatchAny`, `Range`, etc.
  ```python
  from qdrant_client.models import Filter, FieldCondition, MatchValue, Range
  client.query_points(
      collection_name="my_collection",
      query=[0.2, 0.1, 0.9, 0.7],
      query_filter=Filter(must=[
          FieldCondition(key="project_id", match=MatchValue(value="p1")),
          FieldCondition(key="score", range=Range(gte=0.5, lte=1.0)),
      ]),
      limit=3, with_payload=True,
  )
  ```
  Qdrant's "filterable HNSW" maintains accuracy under filtering by adding extra graph links; the query planner switches between HNSW traversal and payload-index scan based on filter cardinality. **Best-practice gotcha:** create payload indexes (`create_payload_index`) on fields you filter on, ideally before uploading data; otherwise filtered search is slower. For multi-tenant fields mark them `is_tenant=True`. For floats, prefer `Range` over exact matches (rounding). No regex filtering support (GitHub issue #6315).

**Python client version notes:**
- Latest `qdrant-client` is 1.18.x (PyPI). Local mode: `QdrantClient(":memory:")` or `QdrantClient(path="...")` runs without a server — useful for tests, no extra deps.
- **Version compatibility gotcha (important for this stack):** The client checks server version and emits a `UserWarning`. The verbatim message (qdrant_client source, python-client.qdrant.tech) is: *"Client version {X} is incompatible with server version {Y}. Major versions should match and minor version difference must not exceed 1. Set check_compatibility=False to skip version check."* A skewed pair can also raise errors at request time. Real-world example documented in RooCodeInc/Roo-Code GitHub Issue #11885: *"Client version 1.14.0 is incompatible with server version 1.16.3... Downgrading to qdrant/qdrant:v1.13.6 resolves the issue."* Fix by pinning the Docker image or upgrading the client, or pass `check_compatibility=False` to skip the check.
- Async API available since 1.6.1. The deprecated `search`, `recommend`, `search_batch`, etc. methods were removed in a recent release — use `query_points`. Calling `.search()` on a mismatched/newer client surfaces an error; e.g. databio/geniml GitHub Issue #18 documents: *"search_results = self.qd_client.search(...) AttributeError: 'QdrantClient' object has no attribute 'search'"* (with client 1.16.1 / server 1.14.1).

### 2. Mem0 (memory abstraction over Qdrant)

**Primary documentation:** https://docs.mem0.ai/
**GitHub:** https://github.com/mem0ai/mem0 · Qdrant component page: https://docs.mem0.ai/components/vectordbs/dbs/qdrant · OSS metadata filtering: https://docs.mem0.ai/open-source/features/metadata-filtering · search concept: https://docs.mem0.ai/core-concepts/memory-operations/search

**Configuration with Qdrant + `Memory.from_config()`:**
```python
from mem0 import Memory
config = {
    "vector_store": {
        "provider": "qdrant",
        "config": {
            "collection_name": "test",
            "host": "localhost",
            "port": 6333,
            "embedding_model_dims": 768,  # MUST match your embedder's output dims
        },
    },
    "llm": {"provider": "ollama", "config": {"model": "...", "ollama_base_url": "http://localhost:11434"}},
    "embedder": {"provider": "ollama", "config": {"model": "...", "ollama_base_url": "http://localhost:11434"}},
}
m = Memory.from_config(config)
```
**Default behavior gotcha:** If no `vector_store` config is given, Mem0 defaults to Qdrant stored locally at `/tmp/qdrant` (or in-memory in some embeddings of the SDK, losing data on restart). Always set `embedding_model_dims` to match your embedder (e.g. 768 for nomic-embed-text/mxbai variants, 1536 for OpenAI text-embedding-3-small) or you'll get dimension-mismatch errors (GitHub issue #4056 documents an "expected dim: 768, got 1" telemetry mismatch).

**`add()` method** (current main signature — keyword-only after `messages`):
```python
m.add(messages, *, user_id=None, agent_id=None, run_id=None,
      metadata=None, infer=True, memory_type=None, prompt=None)
```
- `messages`: str, dict, or list of `{"role","content"}` dicts.
- At least one of `user_id`/`agent_id`/`run_id` required (these are first-class entity scopes). `add()` still accepts these as direct keyword args (unlike `search()` in current main).
- `metadata`: arbitrary dict (e.g. `{"project_id": "p1", "memory_tier": "hot"}`) deep-copied into the Qdrant payload alongside entity IDs.
- `infer=True` (default) uses the LLM to extract facts; `infer=False` stores raw text directly.

**`search()` method:**
```python
m.search(query, *, filters={...}, limit=..., threshold=...)
```
- **Pass entity scopes AND custom metadata inside `filters`** for forward compatibility: `m.search("...", filters={"user_id": "alice", "project_id": "p1"})`. In current/2.x OSS, top-level `user_id`/`agent_id`/`run_id` kwargs to `search()` are rejected with a `ValueError` directing you to use `filters={...}` (the code defines `ENTITY_PARAMS = frozenset({"user_id","agent_id","run_id"})` and a `_reject_top_level_entity_params` guard). Legacy 0.1.x accepted them directly as `search(query, user_id, agent_id, run_id, limit, filters)`.
- `limit`/`top_k`: max results. `threshold`: minimum similarity score (current main docstring default ~0.1). Note: the `rerank` default differs across sources (1.0 migration docs show `True`; current main docstring says `False`) — treat as version-dependent.

**Filter syntax for `project_id` / `memory_tier`:**
- **Simple scalar equality works reliably against Qdrant:** `filters={"user_id": "alice", "project_id": "p1", "memory_tier": "hot"}`.
- The docs advertise advanced operators (`eq, ne, gt, gte, lt, lte, in, nin, contains, icontains`, wildcard `*`) and logical composition (`AND`/`OR`/`NOT`, nestable), introduced in mem0 **1.0.0** for the OSS `Memory` class. Example from docs:
  ```python
  m.search("complex query", filters={
      "user_id": "alice",
      "AND": [{"category": "work"}, {"priority": {"gte": 7}}],
  })
  ```

**Known issues with metadata filtering (CRITICAL for this stack):**
- **Advanced operators against the Qdrant backend are reported broken.** Per mem0 GitHub Issue #3975 ("Enhanced Metadata Filtering Not Working with Qdrant Backend," mem0 1.0.3 + qdrant-client 1.16.2): *"The enhanced metadata filtering operators... do not work with the Qdrant vector store backend. All operators except simple scalar equality matching fail with ValidationError."* The documented root cause is that `mem0/vector_stores/qdrant.py` *"constructs filters using MatchValue which only accepts scalar values (bool, int, str), not dict or list structures"* — so it never translates enhanced operators into Qdrant's native `FieldCondition`/`Range`/`MatchAny`. Operator dicts (`{"eq":...}`, `{"gte":...}`, `{"in":[...]}`) and `{"AND":[...]}` raise a Pydantic `ValidationError`.
- GitHub issue #3284 ("metadata filtering in Python is not working," CLOSED without confirmed fix): `filters={"OR":[{"food":"..."}]}` returned `{"results": []}`; a maintainer-adjacent comment advised filtering by entity IDs then **post-filtering metadata in application code**.
- **Recommendation:** For `project_id`/`memory_tier`, use exact scalar matches in `filters`. If you need ranges/`in`/`OR` on metadata, either run multiple queries and merge, or post-filter the returned results in your own code.

**Version compatibility:**
- mem0ai pins `qdrant-client>=1.9.1` (and `pydantic>=2.7.3`, `protobuf>=5.29.0,<6.0.0`) in pyproject.toml. Latest mem0ai on PyPI is 2.0.4 (the main-branch metadata lags at 1.0.2).
- Because `qdrant-client>=1.9.1` resolves to a much newer client (1.18.x) while your Docker server may be older, you may hit the client/server version warning described in §1. Pin both deliberately.

### 3. LangGraph (agent orchestration)

**Primary documentation:** https://docs.langchain.com/oss/python/langgraph/
**API reference:** https://reference.langchain.com/python/langgraph/graph/state/StateGraph · **GitHub:** https://github.com/langchain-ai/langgraph

**Most relevant sections:**
- **StateGraph with a plain dict/TypedDict state:** State is typically a `TypedDict` (or `dict`); each state key may have a reducer via `Annotated`. Node signature is `State -> Partial<State>`:
  ```python
  from typing import TypedDict
  from langgraph.graph import StateGraph, START, END

  class State(TypedDict):
      input: str
      result: str

  def node_a(state: State) -> dict:
      return {"result": state["input"] + "!"}  # return a partial dict of updates

  builder = StateGraph(State)
  builder.add_node("a", node_a)
  builder.add_edge(START, "a")
  builder.add_edge("a", END)
  graph = builder.compile()
  graph.invoke({"input": "hi"})
  ```
- **How state is passed between nodes:** nodes **return a (partial) dict of updates**; LangGraph merges it into shared state. By default a key is overwritten; if annotated with a reducer (e.g. `add_messages`), values are aggregated. Do **not** rely on mutating the dict in place — return the updates.
- **`add_node` / `add_edge` / `add_conditional_edges` / `set_entry_point` / `compile` / `invoke`:** all documented on the StateGraph reference page. `add_conditional_edges(source, router_fn, path_map)` routes based on a function's return value:
  ```python
  builder.add_conditional_edges("a", route_fn, {"even": "b", "odd": "c"})
  ```
- **`set_entry_point`:** equivalent to `add_edge(START, key)`; `set_finish_point` equals `add_edge(key, END)`.
- **`compile()`:** returns a `CompiledStateGraph` implementing the Runnable interface (supports `invoke`, `stream`, `batch`, async). StateGraph itself is just a builder and cannot execute until compiled.

**Version (0.x vs 1.x) API differences:**
- LangGraph 1.0 shipped **October 22, 2025**, per the official LangChain Changelog (described as "the first stable major release in the durable agent framework space"), with **no breaking changes to core graph primitives** (state, nodes, edges); pre-release the team stated "LangGraph is largely the same as before, no breaking changes." It's a stability/LTS release. LangGraph 0.x is in maintenance until December 2026.
- The core deprecation to know: **`set_entry_point()` / `set_finish_point()` are the old v0.1 patterns** — current idiomatic code uses explicit `add_edge(START, ...)` / `add_edge(..., END)`. Both still work, but most outdated tutorials use the deprecated forms.
- `add_conditional_edges()` is **unchanged** v0.1 → v1.0.
- LangGraph 1.0 requires Python ≥3.10 (dropped 3.8/3.9).
- **Dependency gotcha:** `langgraph` and `langgraph-prebuilt` versions can drift and break (e.g. a `langgraph-prebuilt==1.0.2` runtime-parameter change broke `ToolNode` overrides). Pin `langgraph==X` and `langgraph-prebuilt==X` to the same version in requirements.txt.
- `create_react_agent` (LangGraph prebuilt) is now superseded by `create_agent` in LangChain 1.0.

### 4. Qwen 3 via Ollama

**Model pages:** https://ollama.com/library/qwen3 · tags: https://ollama.com/library/qwen3/tags · embeddings: https://ollama.com/library/qwen3-embedding
**LangChain integration reference:** https://reference.langchain.com/python/langchain-ollama/chat_models/ChatOllama · Ollama structured outputs: https://docs.ollama.com/capabilities/structured-outputs

**Available Qwen3 chat tags:** `qwen3:0.6b`, `qwen3:1.7b`, `qwen3:4b`, `qwen3:8b` (≈5.2GB, Q4_K_M, Apache-2.0), `qwen3:14b`, `qwen3:30b` (≈19GB, MoE A3B), `qwen3:32b`, `qwen3:235b`. `qwen3:latest` maps to 8b. Context windows vary by tag (8b is 40K; 4b/30b/235b list 256K). Pull with `ollama pull qwen3:8b`, run with `ollama run qwen3:8b`.

**Embedding model:** `qwen3-embedding` in sizes `0.6b`, `4b`, `8b`. Per the official Qwen3 Embedding model card (huggingface.co/Qwen/Qwen3-Embedding-8B and ollama.com/library/qwen3-embedding): *"The 8B size embedding model ranks No.1 in the MTEB multilingual leaderboard (as of June 5, 2025, score 70.58)."* **Embedding dimension:** up to 4096 (the 8B HF model; supports user-defined/MRL output dims), 100+ languages, ~32K context. Use via `ollama.embed(model='qwen3-embedding:8b', input=...)` or the `/api/embed` endpoint. **Set Mem0/Qdrant `embedding_model_dims` to match whatever dimension you actually configure.**

**Use with `langchain-ollama` (`ChatOllama`):**
```python
from langchain_ollama import ChatOllama
llm = ChatOllama(model="qwen3:8b", temperature=0)
```
Install `langchain-ollama` (not `langchain_community` — the old import breaks `with_structured_output`).

**Getting JSON-only output:**
- **`format="json"` (JSON mode):** `ChatOllama(model="qwen3:8b", format="json")` forces syntactically valid JSON. You still must instruct the model what shape to produce — Ollama's own docs say to "add 'return as JSON' to the prompt" and ideally pass the JSON schema as a string in the prompt to ground it.
- **Structured outputs (schema-constrained):** pass a JSON schema (or `PydanticModel.model_json_schema()`) to `format=`. Or use `.with_structured_output(MyModel)` on `ChatOllama`, which requires a tool-calling-capable model.
- **Pure prompting** is the least reliable; prefer `format=` / structured outputs.

**Known issues (instruction-following / JSON reliability):**
- **Thinking mode trade-off:** Qwen3 thinks by default. In agent/tool loops, thinking mode can "plan" a tool call or JSON output in its reasoning block and then fail to emit it (reported ~60% miss rate in one vLLM test, GitHub QwenLM/Qwen3 #1817), sometimes fabricating that it acted. Disabling thinking via `/no_think` in the prompt (or `enable_thinking: false` chat-template kwarg) gives more deterministic execution but the model over-triggers tools. For reliable JSON, disable thinking and use `format=`/schema.
- Thinking also burns large numbers of tokens and slows throughput; for extraction/structured tasks disable it.
- For tool calling on local servers, ensure a Qwen-aware tool-call parser (e.g. vLLM `--tool-call-parser hermes`); generic parsers miss calls.

### 5. Pydantic v2

**Primary documentation:** https://docs.pydantic.dev/latest/
**Migration guide:** https://docs.pydantic.dev/latest/migration/ · models concept: https://docs.pydantic.dev/latest/concepts/models/ · **GitHub:** https://github.com/pydantic/pydantic

**Most relevant sections:**
- **`BaseModel` + `Literal` + `Field`:**
  ```python
  from typing import Literal
  from pydantic import BaseModel, Field

  class Item(BaseModel):
      name: str = Field(..., description="Display name")
      tier: Literal["hot", "warm", "cold"] = "hot"
      score: float = Field(default=0.0, ge=0.0, le=1.0, description="0–1 confidence")
  ```
  `...` (Ellipsis) marks a required field. `Literal` constrains to a fixed value set.
- **`.model_dump()`:** replaces v1 `.dict()`. Supports `mode="json"`, `exclude_none`, `by_alias`, `exclude_unset`, etc. `.model_dump_json()` replaces `.json()`. `.model_validate()` / `.model_validate_json()` replace `parse_obj`/`parse_raw`.
- **Validation errors:** `from pydantic import ValidationError`; catch around model construction; `err.errors()` returns structured error dicts with `loc`/`type`/`msg`.

**Differences from v1 that catch people out:**
- **Methods renamed:** `.dict()`→`.model_dump()`, `.json()`→`.model_dump_json()`, `.parse_obj()`→`.model_validate()`, `update_forward_refs()`→`model_rebuild()`. Old methods are deprecated.
- **Config:** inner `class Config` → `model_config = ConfigDict(...)`.
- **Validators:** `@validator`/`@root_validator` → `@field_validator`/`@model_validator`. Importing `from pydantic.v1 import validator` is the v1 compat shim.
- **Stricter coercion:** some implicit coercions that v1 silently allowed now raise `ValidationError` (e.g. in strict mode a string where an int is expected); `Optional`/`Any` no longer get an implicit `None` default.
- **Subclass serialization:** nested fields serialize only the fields of the annotated type, not extra subclass fields (security-motivated).
- **Performance:** v2 core is Rust (pydantic-core), ~5–50× faster. **Mixing v1 and v2 models** (e.g. a v2 model as a field of a v1 model) causes import-time errors or subtle `.dict()`/`.json()` misbehavior; migrate whole dependency trees together. Current stable is v2.x (no v3 with a large rewrite is released; v3 is planned to fix edge cases without changing the public API).

### 6. FastAPI

**Primary documentation:** https://fastapi.tiangolo.com/
**GitHub:** https://github.com/fastapi/fastapi · CORS: https://fastapi.tiangolo.com/tutorial/cors/ · request body: https://fastapi.tiangolo.com/tutorial/body/

**Most relevant sections:**
- **Request body with Pydantic model:** declare a `BaseModel` param; FastAPI parses/validates JSON and returns 422 automatically on validation failure.
  ```python
  from fastapi import FastAPI, HTTPException
  from pydantic import BaseModel

  class Query(BaseModel):
      text: str
      project_id: str

  app = FastAPI()

  @app.post("/search")
  async def search(q: Query):
      if not q.text:
          raise HTTPException(status_code=400, detail="text required")
      return {"ok": True}
  ```
- **`HTTPException`:** raise with `status_code` + `detail` for explicit error responses. FastAPI has built-in handlers for `HTTPException` and request `ValidationError` (the latter auto-returns 422 for bad client input).
- **CORS middleware (needed for the React dev server):**
  ```python
  from fastapi.middleware.cors import CORSMiddleware
  app.add_middleware(
      CORSMiddleware,
      allow_origins=["http://localhost:5173"],  # Vite dev origin
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
  )
  ```
  Import from `fastapi.middleware.cors` (re-exports Starlette's). **Gotcha:** `allow_origins=["*"]` together with `allow_credentials=True` is rejected by browsers — list explicit origins when using credentials. Vite default dev port is **5173** (some templates use 3000) — match it exactly.
- **Running with uvicorn:** `uvicorn main:app --reload --port 8000`, or programmatically `uvicorn.run(app, host="127.0.0.1", port=8000)`. Interactive docs at `/docs`.

### 7. React 18 + Vite

**React docs:** https://react.dev/ (useState: https://react.dev/reference/react/useState)
**Vite docs:** https://vite.dev/guide/ · server/proxy options: https://vite.dev/config/server-options · React GitHub: https://github.com/facebook/react · Vite GitHub: https://github.com/vitejs/vite

**Most relevant sections:**
- **New Vite + React project:** `npm create vite@latest my-app -- --template react` (or `react-ts`), then `cd my-app && npm install && npm run dev`. Dev server runs at **http://localhost:5173**. `index.html` lives at project root and is the entry point. Default scripts: `dev`, `build`, `preview`. **Node requirement:** Vite 7 needs Node 20.19+ / 22.12+ (older Vite lines allowed Node 18+).
- **`fetch` calling FastAPI:**
  ```jsx
  const res = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, project_id }),
  });
  const data = await res.json();
  ```
- **Vite proxy (avoids CORS in dev):** in `vite.config.js`:
  ```js
  import { defineConfig } from "vite";
  import react from "@vitejs/plugin-react";
  export default defineConfig({
    plugins: [react()],
    server: {
      proxy: {
        "/api": { target: "http://localhost:8000", changeOrigin: true,
                  rewrite: (p) => p.replace(/^\/api/, "") },
      },
    },
  });
  ```
  With this, the frontend calls `/api/...` and Vite forwards to FastAPI on 8000 — no CORS needed in dev. **Gotcha:** if your fetch path doesn't exactly match the proxy key, the request bypasses the proxy and hits CORS; and omitting `changeOrigin: true` causes Host-header origin mismatches. The proxy is a dev-only convenience — configure FastAPI CORS for production.
- **Two-panel form with `useState`:** `const [text, setText] = useState("")`. `useState` returns `[value, setter]`; call hooks only at the top level (not in conditionals/loops); state updates are asynchronous and trigger re-render; for updates based on previous state pass a function `setX(prev => ...)`.

## Recommendations

**Stage 1 — Stand up infrastructure with pinned versions.**
1. Run Qdrant locally via the Docker command above. **Pin the server image tag** (e.g. `qdrant/qdrant:v1.15.x`) rather than `latest`.
2. Install `qdrant-client` whose minor version is within 1 of the server, or set `check_compatibility=False` knowingly. Verify with `client.get_collections()` and watch for the UserWarning quoted in §1.
3. Pull `qwen3:8b` and a `qwen3-embedding` model in Ollama; confirm the embedding dimension and record it.

**Stage 2 — Wire Mem0 to Qdrant.**
4. Use `Memory.from_config()` with explicit `embedding_model_dims` matching your embedder. Always pass an explicit `vector_store` config (don't rely on the `/tmp/qdrant` default).
5. **Design metadata filtering around the known Qdrant limitation:** store `project_id`/`memory_tier` as metadata, and filter with **simple scalar equality** (`filters={"user_id": ..., "project_id": ..., "memory_tier": ...}`). Do NOT depend on `AND`/`OR`/range operators against Qdrant until you've verified them on your exact mem0/qdrant-client versions — assume you must post-filter in code. **Benchmark/threshold to change approach:** if a test of `filters={"AND":[...]}` returns results matching a manual Qdrant `query_points` filter, you can adopt advanced operators; if it raises `ValidationError` (the `MatchValue` error from Issue #3975) or returns `[]`, stick with scalar + post-filter.

**Stage 3 — Build the agent and API.**
6. Author the LangGraph graph with TypedDict state, `add_edge(START, ...)`/`add_edge(..., END)`, and nodes returning partial dicts. Pin `langgraph` and `langgraph-prebuilt` to identical versions.
7. For any node that must emit JSON, call Qwen3 through `ChatOllama(..., format=schema)` (or `format="json"` + schema in the prompt) and **disable thinking** (`/no_think`) for determinism. Validate the result with a Pydantic v2 model and catch `ValidationError`.
8. Expose the graph via FastAPI with Pydantic request models, `HTTPException` for errors, and `CORSMiddleware` allowing `http://localhost:5173`.

**Stage 4 — Frontend.**
9. Scaffold with `npm create vite@latest -- --template react`; use the Vite proxy for `/api` so you can skip CORS in dev; manage the two-panel form with `useState`.

## Caveats
- **Mem0 advanced metadata filtering on Qdrant is the single biggest risk** in this stack — it is documented as supported but reported broken (GitHub Issue #3975: "All operators except simple scalar equality matching fail with ValidationError"; Issue #3284 returned empty results). Treat advanced operators as unverified and validate on your exact versions before depending on them.
- **Version drift is a recurring theme:** qdrant client/server, langgraph/langgraph-prebuilt, and mem0's transitively-resolved qdrant-client can all break silently. Pin everything in this stack.
- Mem0's API surface changed across 0.1.x → 1.0 → 2.x (entity IDs moved into `filters`, `search()`/`add()` became keyword-only, `rerank` default disputed). Confirm signatures against the version you actually install; the main-branch metadata (1.0.2) lags the PyPI release (2.0.4).
- Qwen3 behavior (context length, thinking) varies by tag and Ollama version; the figures here reflect the current Ollama library listings and may shift with new Qwen releases.
- Several supporting code snippets above are illustrative composites assembled from official docs; always cross-check exact parameter names against the linked reference pages for your installed versions.