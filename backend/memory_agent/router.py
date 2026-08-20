"""Memory Agent API — mounted into the main app (main.py) alongside the
domain routers, same convention as domain/*/router.py.

    POST /memory/ingest   raw text -> classify/extract/store
    POST /memory/chat     question -> retrieve/allocate_context/synthesize/autopsy
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.db import get_db
from domain.projects import service as projects_service
from memory_agent.graphs.chat import chat_graph
from memory_agent.graphs.ingestion import ingestion_graph
from pydantic import BaseModel
from realtime.websocket_manager import broadcast

router = APIRouter(prefix="/memory", tags=["memory"])


class IngestRequest(BaseModel):
    raw_text: str
    project_id: UUID
    sprint_id: Optional[str] = None
    user_id: str = "default_user"


class IngestResponse(BaseModel):
    classification: Optional[dict]
    stored: Optional[dict]
    classify_error: Optional[str] = None
    extraction_error: Optional[str] = None


@router.post("/ingest", response_model=IngestResponse)
def ingest(req: IngestRequest, db: Session = Depends(get_db)):
    projects_service.get_project(db, req.project_id)  # 404s via NotFoundError if missing

    result = ingestion_graph.invoke(req.model_dump(mode="json"))

    if result.get("store_result", {}).get("status") == "stored":
        broadcast(str(req.project_id), {
            "type": "memory_stored",
            "event_type": result.get("classification", {}).get("type"),
        })

    return IngestResponse(
        classification=result.get("classification"),
        stored=result.get("store_result"),
        classify_error=result.get("classify_error"),
        extraction_error=result.get("extraction_error"),
    )


class ChatRequest(BaseModel):
    query: str
    project_id: UUID
    user_id: str = "default_user"
    conversation_history: list[dict] = []
    attachment: Optional[str] = None  # base64 image/PDF — active from I-9


class ChatResponse(BaseModel):
    answer: str
    memories_used: int
    relations_used: int
    autopsy: dict


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest, db: Session = Depends(get_db)):
    projects_service.get_project(db, req.project_id)  # 404s via NotFoundError if missing

    result = chat_graph.invoke(req.model_dump(mode="json"))

    return ChatResponse(
        answer=result.get("answer", ""),
        memories_used=result.get("memories_used", 0),
        relations_used=result.get("relations_used", 0),
        autopsy=result.get("autopsy", {}),
    )
