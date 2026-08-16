from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.db import get_db
from domain.members import service
from domain.members.schemas import MemberCreate, MemberRead, MemberUpdate

router = APIRouter(prefix="/members", tags=["members"])


@router.post("", response_model=MemberRead, status_code=201)
def create_member(data: MemberCreate, db: Session = Depends(get_db)):
    return service.create_member(db, data)


@router.get("", response_model=list[MemberRead])
def list_members(project_id: UUID, availability: str | None = None, db: Session = Depends(get_db)):
    return service.list_members(db, project_id, availability)


@router.get("/{member_id}", response_model=MemberRead)
def get_member(member_id: UUID, db: Session = Depends(get_db)):
    return service.get_member(db, member_id)


@router.patch("/{member_id}", response_model=MemberRead)
def update_member(member_id: UUID, data: MemberUpdate, db: Session = Depends(get_db)):
    return service.update_member(db, member_id, data)


@router.delete("/{member_id}", status_code=204)
def deactivate_member(member_id: UUID, db: Session = Depends(get_db)):
    service.deactivate_member(db, member_id)
