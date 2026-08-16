from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.db import get_db
from domain.projects import service
from domain.projects.schemas import ProjectCreate, ProjectRead, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectRead, status_code=201)
def create_project(data: ProjectCreate, db: Session = Depends(get_db)):
    return service.create_project(db, data)


@router.get("", response_model=list[ProjectRead])
def list_projects(status: str | None = None, db: Session = Depends(get_db)):
    return service.list_projects(db, status)


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(project_id: UUID, db: Session = Depends(get_db)):
    return service.get_project(db, project_id)


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project(project_id: UUID, data: ProjectUpdate, db: Session = Depends(get_db)):
    return service.update_project(db, project_id, data)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: UUID, db: Session = Depends(get_db)):
    service.delete_project(db, project_id)
