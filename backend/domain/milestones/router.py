from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.db import get_db
from core.exceptions import NotFoundError
from domain.milestones import repository
from domain.milestones.schemas import MilestoneCreate, MilestoneRead, MilestoneUpdate

router = APIRouter(prefix="/milestones", tags=["milestones"])


@router.post("", response_model=MilestoneRead, status_code=201)
def create_milestone(data: MilestoneCreate, db: Session = Depends(get_db)):
    return repository.create(db, data)


@router.get("", response_model=list[MilestoneRead])
def list_milestones(project_id: UUID, db: Session = Depends(get_db)):
    return repository.list_by_project(db, project_id)


@router.patch("/{milestone_id}", response_model=MilestoneRead)
def update_milestone(milestone_id: UUID, data: MilestoneUpdate, db: Session = Depends(get_db)):
    milestone = repository.get(db, milestone_id)
    if not milestone:
        raise NotFoundError("Milestone", str(milestone_id))
    return repository.update(db, milestone, data)


@router.delete("/{milestone_id}", status_code=204)
def delete_milestone(milestone_id: UUID, db: Session = Depends(get_db)):
    milestone = repository.get(db, milestone_id)
    if not milestone:
        raise NotFoundError("Milestone", str(milestone_id))
    repository.delete(db, milestone)
