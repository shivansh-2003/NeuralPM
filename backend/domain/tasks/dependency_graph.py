from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

DOWNSTREAM_QUERY = text("""
    WITH RECURSIVE downstream AS (
        SELECT td.task_id, 1 AS depth
        FROM task_dependencies td
        WHERE td.depends_on_id = :trigger_task_id

        UNION ALL

        SELECT td.task_id, ds.depth + 1
        FROM task_dependencies td
        JOIN downstream ds ON td.depends_on_id = ds.task_id
        WHERE ds.depth < 20
    )
    SELECT DISTINCT ON (t.id) t.id, t.title, t.status, t.due_date, ds.depth
    FROM downstream ds
    JOIN tasks t ON t.id = ds.task_id
    WHERE t.project_id = :project_id
      AND t.status NOT IN ('completed', 'cancelled')
    ORDER BY t.id, ds.depth
""")


def get_downstream_tasks(db: Session, trigger_task_id: UUID, project_id: UUID) -> list[dict]:
    """Pure SQL traversal — used today for a plain 'show dependency chain' view,
    and later by the Cascade Agent for propagation. No AI involved."""
    rows = db.execute(
        DOWNSTREAM_QUERY,
        {"trigger_task_id": str(trigger_task_id), "project_id": str(project_id)},
    ).mappings().all()
    return [dict(r) for r in sorted(rows, key=lambda r: r["depth"])]
