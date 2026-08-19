from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.db import get_db
from core.exceptions import ConflictError
from domain.agent_settings.models import AgentSetting

router = APIRouter(prefix="/settings/agents", tags=["agent-settings"])

VALID_AGENTS = {"assignment", "risk", "cascade"}


@router.get("")
def list_settings(project_id: UUID, db: Session = Depends(get_db)):
    rows = db.query(AgentSetting).filter(AgentSetting.project_id == project_id).all()
    existing = {r.agent_name: r.mode for r in rows}
    return {name: existing.get(name, "suggest") for name in VALID_AGENTS}


@router.put("/{agent_name}")
def set_mode(agent_name: str, mode: str, project_id: UUID, db: Session = Depends(get_db)):
    if agent_name not in VALID_AGENTS or mode not in {"suggest", "auto"}:
        raise ConflictError("Invalid agent_name or mode")
    row = db.query(AgentSetting).filter_by(project_id=project_id, agent_name=agent_name).first()
    if row:
        row.mode = mode
    else:
        row = AgentSetting(project_id=project_id, agent_name=agent_name, mode=mode)
        db.add(row)
    db.commit()
    return {"agent_name": agent_name, "mode": mode}
