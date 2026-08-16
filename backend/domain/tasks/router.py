from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.db import get_db
from domain.tasks import service
from domain.tasks.schemas import (
    TaskCreate,
    TaskDependencyCreate,
    TaskDependencyRead,
    TaskRead,
    TaskUpdate,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post("", response_model=TaskRead, status_code=201)
def create_task(data: TaskCreate, db: Session = Depends(get_db)):
    return service.create_task(db, data)


@router.get("", response_model=list[TaskRead])
def list_tasks(
    project_id: UUID,
    status: str | None = None,
    assignee_id: UUID | None = None,
    severity: str | None = None,
    db: Session = Depends(get_db),
):
    return service.list_tasks(db, project_id, status=status, assignee_id=assignee_id, severity=severity)


@router.get("/{task_id}", response_model=TaskRead)
def get_task(task_id: UUID, db: Session = Depends(get_db)):
    return service.get_task(db, task_id)


@router.patch("/{task_id}", response_model=TaskRead)
def update_task(task_id: UUID, data: TaskUpdate, db: Session = Depends(get_db)):
    return service.update_task(db, task_id, data)


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: UUID, db: Session = Depends(get_db)):
    service.delete_task(db, task_id)


@router.post("/{task_id}/dependencies", response_model=TaskDependencyRead, status_code=201)
def add_dependency(task_id: UUID, data: TaskDependencyCreate, db: Session = Depends(get_db)):
    return service.add_dependency(db, task_id, data.depends_on_id)


@router.get("/{task_id}/dependencies", response_model=list[TaskDependencyRead])
def list_dependencies(task_id: UUID, db: Session = Depends(get_db)):
    return service.list_dependencies(db, task_id)


@router.delete("/{task_id}/dependencies/{depends_on_id}", status_code=204)
def remove_dependency(task_id: UUID, depends_on_id: UUID, db: Session = Depends(get_db)):
    service.remove_dependency(db, task_id, depends_on_id)


@router.get("/{task_id}/downstream")
def get_downstream(task_id: UUID, project_id: UUID, db: Session = Depends(get_db)):
    return service.get_downstream(db, task_id, project_id)
