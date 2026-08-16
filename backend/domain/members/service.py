from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundError
from domain.members import repository
from domain.members.schemas import MemberCreate, MemberUpdate


def create_member(db: Session, data: MemberCreate):
    return repository.create(db, data)


def get_member(db: Session, member_id: UUID):
    member = repository.get(db, member_id)
    if not member:
        raise NotFoundError("Member", str(member_id))
    return member


def list_members(db: Session, project_id: UUID, availability: str | None = None):
    return repository.list_by_project(db, project_id, availability)


def update_member(db: Session, member_id: UUID, data: MemberUpdate):
    member = get_member(db, member_id)
    return repository.update(db, member, data)


def deactivate_member(db: Session, member_id: UUID):
    """Soft delete — matches the Assignment Agent's expectation that
    fetch_members_node filters availability != 'deactivated'."""
    member = get_member(db, member_id)
    return repository.update(db, member, MemberUpdate(availability="deactivated"))
