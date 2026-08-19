from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from domain.members.models import Member
from domain.tasks.models import Task


def recalculate_active_points(db: Session, member_id: UUID) -> int:
    total = (
        db.query(func.coalesce(func.sum(Task.estimated_points), 0))
        .filter(Task.assignee_id == member_id, Task.status != "completed")
        .scalar()
    )
    db.query(Member).filter(Member.id == member_id).update({"active_points": total})
    db.commit()
    return total


def load_percentage(member: Member) -> float:
    if not member.capacity:
        return 0.0
    return round((member.active_points / member.capacity) * 100, 1)
