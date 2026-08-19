from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ConflictError, NotFoundError
from domain.tasks import repository
from domain.tasks.cycle_check import would_create_cycle
from domain.tasks.dependency_graph import get_downstream_tasks
from domain.tasks.metrics import recalculate_active_points
from domain.tasks.schemas import TaskCreate, TaskUpdate
from realtime.websocket_manager import broadcast


def create_task(db: Session, data: TaskCreate):
    return repository.create(db, data)


def get_task(db: Session, task_id: UUID):
    task = repository.get(db, task_id)
    if not task:
        raise NotFoundError("Task", str(task_id))
    return task


def list_tasks(db: Session, project_id: UUID, **filters):
    return repository.list_by_project(db, project_id, **filters)


def update_task(db: Session, task_id: UUID, data: TaskUpdate):
    task = get_task(db, task_id)
    due_date_changed = data.due_date is not None and data.due_date != task.due_date
    status_changed_to_blocked = data.status == "blocked" and task.status != "blocked"
    old_assignee = task.assignee_id

    updated = repository.update(db, task, data)

    if data.assignee_id is not None and data.assignee_id != old_assignee:
        if old_assignee:
            recalculate_active_points(db, old_assignee)
        recalculate_active_points(db, updated.assignee_id)

    broadcast(str(updated.project_id), {
        "type": "task_updated",
        "task_id": str(updated.id),
        "status": updated.status,
        "assignee_id": str(updated.assignee_id) if updated.assignee_id else None,
    })

    # Future AI hook point: README's wiring says
    # "if deadline changed or status -> blocked: POST /cascade/trigger".
    # No-op today; the Cascade Agent plugs in here later with zero router/repo changes.
    if due_date_changed or status_changed_to_blocked:
        pass  # TODO(agents/cascade): trigger_cascade(project_id, task_id)

    return updated


def delete_task(db: Session, task_id: UUID):
    task = get_task(db, task_id)
    repository.delete(db, task)


def add_dependency(db: Session, task_id: UUID, depends_on_id: UUID):
    get_task(db, task_id)
    get_task(db, depends_on_id)
    if would_create_cycle(db, task_id, depends_on_id):
        raise ConflictError("Adding this dependency would create a cycle")
    return repository.add_dependency(db, task_id, depends_on_id)


def list_dependencies(db: Session, task_id: UUID):
    return repository.list_dependencies(db, task_id)


def remove_dependency(db: Session, task_id: UUID, depends_on_id: UUID):
    repository.remove_dependency(db, task_id, depends_on_id)


def get_downstream(db: Session, task_id: UUID, project_id: UUID):
    return get_downstream_tasks(db, task_id, project_id)
