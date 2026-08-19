from uuid import UUID

from sqlalchemy.orm import Session

from domain.notifications.models import Notification


def create(db: Session, project_id: UUID, type: str, payload: dict, user_id: UUID | None = None) -> Notification:
    n = Notification(project_id=project_id, user_id=user_id, type=type, payload=payload)
    db.add(n)
    db.commit()
    db.refresh(n)
    return n


def list_for_user(db: Session, project_id: UUID, user_id: UUID, unread_only: bool = False) -> list[Notification]:
    q = db.query(Notification).filter(
        Notification.project_id == project_id,
        (Notification.user_id == user_id) | (Notification.user_id.is_(None)),
    )
    if unread_only:
        q = q.filter(Notification.read.is_(False))
    return q.order_by(Notification.created_at.desc()).all()


def mark_read(db: Session, notification_id: UUID) -> None:
    db.query(Notification).filter(Notification.id == notification_id).update({"read": True})
    db.commit()
