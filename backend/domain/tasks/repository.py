from uuid import UUID

from sqlalchemy.orm import Session

from domain.tasks.models import Task, TaskDependency
from domain.tasks.schemas import TaskCreate, TaskUpdate


def create(db: Session, data: TaskCreate) -> Task:
    task = Task(**data.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def get(db: Session, task_id: UUID) -> Task | None:
    return db.query(Task).filter(Task.id == task_id).first()


def list_by_project(
    db: Session,
    project_id: UUID,
    status: str | None = None,
    assignee_id: UUID | None = None,
    severity: str | None = None,
) -> list[Task]:
    q = db.query(Task).filter(Task.project_id == project_id)
    if status:
        q = q.filter(Task.status == status)
    if assignee_id:
        q = q.filter(Task.assignee_id == assignee_id)
    if severity:
        q = q.filter(Task.severity == severity)
    return q.order_by(Task.created_at.desc()).all()


def update(db: Session, task: Task, data: TaskUpdate) -> Task:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    return task


def delete(db: Session, task: Task) -> None:
    db.delete(task)
    db.commit()


def add_dependency(db: Session, task_id: UUID, depends_on_id: UUID) -> TaskDependency:
    dep = TaskDependency(task_id=task_id, depends_on_id=depends_on_id)
    db.add(dep)
    db.commit()
    return dep


def list_dependencies(db: Session, task_id: UUID) -> list[TaskDependency]:
    return db.query(TaskDependency).filter(TaskDependency.task_id == task_id).all()


def remove_dependency(db: Session, task_id: UUID, depends_on_id: UUID) -> None:
    db.query(TaskDependency).filter(
        TaskDependency.task_id == task_id,
        TaskDependency.depends_on_id == depends_on_id,
    ).delete()
    db.commit()
