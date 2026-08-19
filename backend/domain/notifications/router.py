from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.auth import get_current_user
from core.db import get_db
from domain.notifications import repository

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(
    project_id: UUID,
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return repository.list_for_user(db, project_id, current_user.id, unread_only)


@router.patch("/{notification_id}/read", status_code=204)
def mark_read(notification_id: UUID, db: Session = Depends(get_db)):
    repository.mark_read(db, notification_id)
