from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.db import get_db
from preferences.models import UserPreference

router = APIRouter(prefix="/preferences", tags=["preferences"])


@router.get("")
def list_preferences(user_id: UUID, db: Session = Depends(get_db)):
    return db.query(UserPreference).filter(UserPreference.user_id == user_id).all()


@router.delete("/{preference_id}", status_code=204)
def delete_preference(preference_id: UUID, db: Session = Depends(get_db)):
    db.query(UserPreference).filter(UserPreference.id == preference_id).delete()
    db.commit()


@router.patch("/{preference_id}")
def edit_preference(preference_id: UUID, preference_value: dict, db: Session = Depends(get_db)):
    pref = db.query(UserPreference).filter(UserPreference.id == preference_id).first()
    pref.preference_value = preference_value
    db.commit()
    return pref
