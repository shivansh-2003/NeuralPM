from sqlalchemy.orm import Session

from domain.users.models import User
from domain.users.schemas import UserCreate


def create(db: Session, data: UserCreate, hashed_password: str) -> User:
    user = User(
        email=data.email,
        hashed_password=hashed_password,
        full_name=data.full_name,
        role=data.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def get_by_id(db: Session, user_id) -> User | None:
    return db.query(User).filter(User.id == user_id).first()
