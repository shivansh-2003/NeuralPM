from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.db import get_db
from domain.members.models import Member
from domain.tasks.models import Task

router = APIRouter(prefix="/search", tags=["search"])


@router.get("")
def search(q: str, project_id: UUID, db: Session = Depends(get_db)):
    pattern = f"%{q}%"

    tasks = (
        db.query(Task)
        .filter(Task.project_id == project_id, Task.title.ilike(pattern))
        .limit(10)
        .all()
    )
    members = (
        db.query(Member)
        .filter(Member.project_id == project_id, Member.name.ilike(pattern))
        .limit(10)
        .all()
    )

    return {
        "tasks": [{"id": t.id, "title": t.title, "status": t.status} for t in tasks],
        "members": [{"id": m.id, "name": m.name, "role": m.role} for m in members],
        "memories": [],  # placeholder — filled in once Qdrant semantic search exists
    }
