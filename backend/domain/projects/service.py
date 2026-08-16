from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ConflictError, NotFoundError
from domain.projects import repository
from domain.projects.schemas import ProjectCreate, ProjectUpdate


def create_project(db: Session, data: ProjectCreate):
    return repository.create(db, data)


def get_project(db: Session, project_id: UUID):
    project = repository.get(db, project_id)
    if not project:
        raise NotFoundError("Project", str(project_id))
    return project


def list_projects(db: Session, status: str | None = None):
    return repository.list_all(db, status)


def update_project(db: Session, project_id: UUID, data: ProjectUpdate):
    project = get_project(db, project_id)
    return repository.update(db, project, data)


def delete_project(db: Session, project_id: UUID):
    project = get_project(db, project_id)
    if project.status == "active":
        raise ConflictError("Cannot delete an active project — archive it first")
    repository.delete(db, project)
