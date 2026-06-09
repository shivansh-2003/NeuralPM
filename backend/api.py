"""FastAPI app — NeuralPM Memory Agent API.

Endpoints (Iteration 0 / 1):
    POST /memory/ingest   raw text -> classify/extract/store
    POST /memory/chat     question -> retrieve/allocate_context/synthesize/autopsy
    GET  /health          liveness check

Run:  uvicorn api:app --reload --port 8000
Docs: http://localhost:8000/docs
"""

from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from memory_agent.config import get_settings
from memory_agent.graphs.chat import chat_graph
from memory_agent.graphs.ingestion import ingestion_graph

app = FastAPI(title="NeuralPM API", version="1.0.0")

_settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ────────────────────────────────────────────────────────────────── #

@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


# ── Memory Agent: Ingest ──────────────────────────────────────────────────── #

class IngestRequest(BaseModel):
    raw_text:   str
    project_id: str
    sprint_id:  Optional[str] = None
    user_id:    str = "default_user"


class IngestResponse(BaseModel):
    classification:   Optional[dict]
    stored:           Optional[dict]
    classify_error:   Optional[str] = None
    extraction_error: Optional[str] = None


@app.post("/memory/ingest", response_model=IngestResponse)
def ingest(req: IngestRequest):
    result = ingestion_graph.invoke(req.model_dump())
    return IngestResponse(
        classification=result.get("classification"),
        stored=result.get("store_result"),
        classify_error=result.get("classify_error"),
        extraction_error=result.get("extraction_error"),
    )


# ── Memory Agent: Chat ────────────────────────────────────────────────────── #

class ChatRequest(BaseModel):
    query:      str
    project_id: str
    user_id:    str = "default_user"
    conversation_history: list[dict] = []
    attachment: Optional[str] = None   # base64 image/PDF — active from I-9


class ChatResponse(BaseModel):
    answer:          str
    memories_used:   int
    relations_used:  int
    autopsy:         dict


@app.post("/memory/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    if not req.project_id:
        raise HTTPException(status_code=400, detail="project_id is required")

    try:
        result = chat_graph.invoke(req.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return ChatResponse(
        answer=result.get("answer", ""),
        memories_used=result.get("memories_used", 0),
        relations_used=result.get("relations_used", 0),
        autopsy=result.get("autopsy", {}),
    )
