from uuid import UUID

from sqlalchemy.orm import Session

from domain.projects.models import Project
from domain.projects.schemas import ProjectCreate, ProjectUpdate


def create(db: Session, data: ProjectCreate) -> Project:
    project = Project(**data.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def get(db: Session, project_id: UUID) -> Project | None:
    return db.query(Project).filter(Project.id == project_id).first()


def list_all(db: Session, status: str | None = None) -> list[Project]:
    q = db.query(Project)
    if status:
        q = q.filter(Project.status == status)
    return q.order_by(Project.created_at.desc()).all()


def update(db: Session, project: Project, data: ProjectUpdate) -> Project:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return project


def delete(db: Session, project: Project) -> None:
    db.delete(project)
    db.commit()
