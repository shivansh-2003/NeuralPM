# NeuralPM Memory Agent — Backend

Phase 1: the ingest → retrieve → answer loop. Decay/compression (Phase 1.5)
and the Assignment/Risk/Cascade agents (Phase 2+) build on top of this
without touching what's here.

```
backend/
├── main.py                     FastAPI app — mounts domain/ routers + memory_agent's
├── db.py                       Postgres connection singleton for memory_events (raw SQL)
├── core/                       settings, SQLAlchemy engine, shared config (Phase 0)
├── domain/                     projects / members / tasks / milestones (Phase 0)
├── migrations/                 Alembic — all schema, including memory_events
├── test_pipe.py                Step 0 verification — run this first
├── test_graph.py               FalkorDB graph extraction verification — run second
├── docker-compose.yml          local Qdrant + FalkorDB
├── .env.example                copy to .env
└── memory_agent/
    ├── config.py                settings, Mem0 client, LLM factory
    ├── router.py                /memory/ingest, /memory/chat — mounted in main.py
    ├── schemas/requirement.py   Pydantic v2 models
    ├── nodes/                   classify, extract, store, retrieve, allocate_context, synthesize, autopsy
    └── graphs/                  ingestion graph + chat graph
```

## Prerequisites

- Python 3.10+
- Docker (for Qdrant + FalkorDB)
- [Ollama](https://ollama.com) running locally

## Setup

```bash
# 1. Start Qdrant + FalkorDB
docker compose up -d
#    Qdrant UI at http://localhost:6333/dashboard

# 2. Pull models
ollama pull qwen3:8b
ollama pull qwen3-embedding:0.6b

# 3. Python env
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# 4. Config
cp .env.example .env

# 5. Schema (Alembic-managed — includes memory_events)
alembic upgrade head
```

### Confirm the embedding dimension

`EMBED_DIMS` in `.env` **must** match what your embedding model actually
outputs, or Qdrant will reject writes. Check it:

```bash
python -c "import ollama; print(len(ollama.embed(model='qwen3-embedding:0.6b', input='test')['embeddings'][0]))"
```

Set `EMBED_DIMS` to whatever number that prints (1024 for `:0.6b`).

## Run

```bash
# Step 0 — verify the pipe. Do not proceed until this passes.
python test_pipe.py
python test_graph.py

# Then start the full API (domain routers + memory agent)
uvicorn main:app --reload --port 8000
# docs at http://localhost:8000/docs
```

## Try it

```bash
# Ingest a requirement
curl -X POST http://localhost:8000/memory/ingest \
  -H "Content-Type: application/json" \
  -d '{"raw_text":"We need users to reset their password via an email link that expires after 1 hour","project_id":"alpha","sprint_id":"sprint_1"}'

# Ingest a non-requirement (should classify as casual_chat, store nothing)
curl -X POST http://localhost:8000/memory/ingest \
  -H "Content-Type: application/json" \
  -d '{"raw_text":"hey team, good standup today","project_id":"alpha"}'

# Ask a question (scoped to project alpha)
curl -X POST http://localhost:8000/memory/chat \
  -H "Content-Type: application/json" \
  -d '{"query":"What are our authentication requirements?","project_id":"alpha"}'
```

## How it works

**Ingestion graph** (`memory_agent/graphs/ingestion.py`)
`START → classify → [requirement_update?] → extract → store → END`.
Non-requirements skip straight to `END`. Each node returns a partial dict that
LangGraph merges into shared state.

**Chat graph** (`memory_agent/graphs/chat.py`)
`START → retrieve → allocate_context → synthesize → autopsy → END`. `retrieve`
hard-enforces `project_id` and raises if it's missing — no cross-project
leakage. `allocate_context` splits retrieved memories across a fixed token
budget so the prompt never blows up. `synthesize` answers using only the
budgeted memories, graph relations, and recent conversation, citing sources.
`autopsy` returns the full transparency payload — what was loaded, what was
filtered and why, and the token budget breakdown.

## Decisions baked in (and why)

- **Mem0 filters use scalar equality only.** Mem0's advanced filter operators
  (`AND`/`OR`/`gte`/`in`) are reported broken against the Qdrant backend
  (mem0 issue #3975). We keep metadata flat and filter by exact match — e.g.
  `retrieve_node` excludes archived-tier memories by post-filtering the
  results in code, not with a query-side `{"in": [...]}` filter.
- **Entity + project scope both go inside `filters`.** Current Mem0 `search()`
  rejects top-level `user_id`; scopes belong in `filters={...}`.
- **Qwen3 thinking is disabled** (`reasoning=False`) for the classify/extract
  nodes. Thinking mode makes structured JSON output flaky — the model plans the
  JSON in a reasoning block and sometimes never emits it.
- **LLM JSON is defended twice:** `format="json"` on the model, plus
  `parse_llm_json()` which strips stray `<think>` blocks and ``` fences and
  recovers the first `{...}` block.
- **memory_events is Alembic-managed, not raw SQL.** It's written to via
  plain `psycopg2` (see `db.py`) rather than the SQLAlchemy ORM, since nothing
  in `domain/` CRUDs it — but its table definition lives in `migrations/`
  like everything else, so there's one schema authority.
- **Pinned versions everywhere.** qdrant client/server skew and
  langgraph/langgraph-prebuilt drift both fail silently; `requirements.txt` and
  `docker-compose.yml` pin matching versions.

## Out of scope (Phase 1.5+)

Decay / relevance-tier compression · Celery Beat · the `user_preferences`
budget slice (reserved, always 0 today) · Assignment/Risk/Cascade agents ·
auth on the memory endpoints.
