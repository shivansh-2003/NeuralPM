from uuid import UUID

from sqlalchemy.orm import Session

from domain.milestones.models import Milestone
from domain.milestones.schemas import MilestoneCreate, MilestoneUpdate


def create(db: Session, data: MilestoneCreate) -> Milestone:
    milestone = Milestone(**data.model_dump())
    db.add(milestone)
    db.commit()
    db.refresh(milestone)
    return milestone


def get(db: Session, milestone_id: UUID) -> Milestone | None:
    return db.query(Milestone).filter(Milestone.id == milestone_id).first()


def list_by_project(db: Session, project_id: UUID) -> list[Milestone]:
    return db.query(Milestone).filter(Milestone.project_id == project_id).order_by(Milestone.due_date).all()


def update(db: Session, milestone: Milestone, data: MilestoneUpdate) -> Milestone:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(milestone, field, value)
    db.commit()
    db.refresh(milestone)
    return milestone


def delete(db: Session, milestone: Milestone) -> None:
    db.delete(milestone)
    db.commit()
