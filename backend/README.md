# NeuralPM Memory Agent — Backend (MVP)

The ingest → retrieve → answer loop, and nothing else. Decay, preferences, and
the autopsy panel are deliberately out of scope until this loop is solid.

```
backend/
├── api.py                      FastAPI app: /ingest, /chat, /health
├── test_pipe.py                Step 0 verification — run this first
├── requirements.txt            pinned versions
├── docker-compose.yml          local Qdrant
├── .env.example                copy to .env
└── memory_agent/
    ├── config.py               settings, Mem0 client, LLM factory
    ├── schemas/requirement.py  Pydantic v2 models
    ├── nodes/                  classify, extract, store, retrieve, synthesize
    └── graphs/                 ingestion graph + chat graph
```

## Prerequisites

- Python 3.10+
- Docker (for Qdrant)
- [Ollama](https://ollama.com) running locally

## Setup

```bash
# 1. Start Qdrant
docker compose up -d
#    UI at http://localhost:6333/dashboard

# 2. Pull models
ollama pull qwen3:8b
ollama pull qwen3-embedding:0.6b

# 3. Python env
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 4. Config
cp .env.example .env
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

# Then start the API
uvicorn api:app --reload --port 8000
# docs at http://localhost:8000/docs
```

## Try it

```bash
# Ingest a requirement
curl -X POST http://localhost:8000/ingest \
  -H "Content-Type: application/json" \
  -d '{"raw_text":"We need users to reset their password via an email link that expires after 1 hour","project_id":"alpha","sprint_id":"sprint_1"}'

# Ingest a non-requirement (should classify as casual_chat, store nothing)
curl -X POST http://localhost:8000/ingest \
  -H "Content-Type: application/json" \
  -d '{"raw_text":"hey team, good standup today","project_id":"alpha"}'

# Ask a question (scoped to project alpha)
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"query":"What are our authentication requirements?","project_id":"alpha"}'
```

## How it works

**Ingestion graph** (`graphs/ingestion.py`)
`START → classify → [requirement_update?] → extract → store → END`.
Non-requirements skip straight to `END`. Each node returns a partial dict that
LangGraph merges into shared state.

**Chat graph** (`graphs/chat.py`)
`START → retrieve → synthesize → END`. `retrieve` hard-enforces `project_id` and
raises if it is missing — no cross-project leakage. `synthesize` answers using
only the retrieved memories and cites their ids.

## Decisions baked in (and why)

- **Mem0 filters use scalar equality only.** Mem0's advanced filter operators
  (`AND`/`OR`/`gte`/`in`) are reported broken against the Qdrant backend
  (mem0 issue #3975). We keep metadata flat and filter by exact match. If you
  later need ranges or OR, post-filter the returned results in code rather than
  trusting the operator path.
- **Entity + project scope both go inside `filters`.** Current Mem0 `search()`
  rejects top-level `user_id`; scopes belong in `filters={...}`.
- **Qwen3 thinking is disabled** (`reasoning=False`) for the classify/extract
  nodes. Thinking mode makes structured JSON output flaky — the model plans the
  JSON in a reasoning block and sometimes never emits it.
- **LLM JSON is defended twice:** `format="json"` on the model, plus
  `parse_llm_json()` which strips ``` fences and recovers the first `{...}` block.
- **Pinned versions everywhere.** qdrant client/server skew and
  langgraph/langgraph-prebuilt drift both fail silently; `requirements.txt` and
  `docker-compose.yml` pin matching versions.

## Out of scope (post-MVP)

Decay / relevance tiers · user preference memory · Memory Autopsy · multi-turn
chat history · Cascade/Risk/Assignment agents · auth.

The only milestone that matters now: paste a messy requirement → see a clean,
retrievable memory → ask a question → get a grounded answer.
