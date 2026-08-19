from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

CYCLE_CHECK_QUERY = text("""
    WITH RECURSIVE chain AS (
        SELECT depends_on_id AS task_id, 1 AS depth
        FROM task_dependencies
        WHERE task_id = :new_depends_on_id

        UNION ALL

        SELECT td.depends_on_id, c.depth + 1
        FROM task_dependencies td
        JOIN chain c ON td.task_id = c.task_id
        WHERE c.depth < 50
    )
    SELECT 1 FROM chain WHERE task_id = :new_task_id LIMIT 1
""")


def would_create_cycle(db: Session, task_id: UUID, depends_on_id: UUID) -> bool:
    """True if adding task_id -> depends_on_id would create a cycle."""
    if task_id == depends_on_id:
        return True
    result = db.execute(
        CYCLE_CHECK_QUERY,
        {"new_task_id": str(task_id), "new_depends_on_id": str(depends_on_id)},
    ).first()
    return result is not None
