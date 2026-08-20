"""FastAPI app — NeuralPM Memory Agent API.

Endpoints (Iteration 0 / 1):
    POST /memory/ingest         raw text -> classify/extract/store
    POST /memory/ingest/file    file upload (PDF / text) -> parse/extract/store
    POST /memory/chat           question -> retrieve/allocate_context/synthesize/autopsy
    GET  /health                liveness check

Run:  uvicorn api:app --reload --port 8000
Docs: http://localhost:8000/docs
"""

from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
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


# ── Memory Agent: Ingest (text) ───────────────────────────────────────────── #

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


# ── Memory Agent: Ingest (file upload) ───────────────────────────────────── #

@app.post("/memory/ingest/file", response_model=IngestResponse)
async def ingest_file(
    file:       UploadFile = File(...),
    project_id: str        = Form(...),
    sprint_id:  Optional[str] = Form(None),
    user_id:    str        = Form("default_user"),
):
    _validate_file_type(file)

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    state = {
        "file_bytes": file_bytes,
        "file_name":  file.filename or "upload",
        "project_id": project_id,
        "sprint_id":  sprint_id,
        "user_id":    user_id,
        # raw_text is populated by parse_file_node; provide empty default
        "raw_text":   "",
    }

    try:
        result = ingestion_graph.invoke(state)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return IngestResponse(
        classification=result.get("classification"),
        stored=result.get("store_result"),
        classify_error=result.get("classify_error"),
        extraction_error=result.get("extraction_error"),
    )


_ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md", ".rst", ".csv"}
_ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "text/plain",
    "text/markdown",
    "text/x-rst",
    "text/csv",
    "application/octet-stream",  # browsers sometimes send this for .md/.rst
}


def _validate_file_type(file: UploadFile) -> None:
    import os
    ext = os.path.splitext(file.filename or "")[1].lower()
    content_type = (file.content_type or "").split(";")[0].strip()

    if ext not in _ALLOWED_EXTENSIONS and content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{ext}' ({content_type}). "
                   f"Allowed: {', '.join(sorted(_ALLOWED_EXTENSIONS))}",
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
