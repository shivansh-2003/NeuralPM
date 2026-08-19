from datetime import datetime, timedelta, timezone

from jose import jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from core.config import get_settings
from core.exceptions import ConflictError, NotFoundError
from domain.users import repository
from domain.users.schemas import UserCreate

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: str) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expire_hours)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def register_user(db: Session, data: UserCreate):
    if repository.get_by_email(db, data.email):
        raise ConflictError(f"Email {data.email} already registered")
    return repository.create(db, data, hash_password(data.password))


def authenticate(db: Session, email: str, password: str):
    user = repository.get_by_email(db, email)
    if not user or not verify_password(password, user.hashed_password):
        raise NotFoundError("User", email)  # deliberately vague for security
    return user
