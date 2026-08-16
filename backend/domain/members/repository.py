from uuid import UUID

from sqlalchemy.orm import Session

from domain.members.models import Member
from domain.members.schemas import MemberCreate, MemberUpdate


def create(db: Session, data: MemberCreate) -> Member:
    member = Member(**data.model_dump())
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


def get(db: Session, member_id: UUID) -> Member | None:
    return db.query(Member).filter(Member.id == member_id).first()


def list_by_project(db: Session, project_id: UUID, availability: str | None = None) -> list[Member]:
    q = db.query(Member).filter(Member.project_id == project_id)
    if availability:
        q = q.filter(Member.availability == availability)
    return q.order_by(Member.name).all()


def update(db: Session, member: Member, data: MemberUpdate) -> Member:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(member, field, value)
    db.commit()
    db.refresh(member)
    return member


def delete(db: Session, member: Member) -> None:
    db.delete(member)
    db.commit()
