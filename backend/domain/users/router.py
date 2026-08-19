from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.db import get_db
from domain.users import service
from domain.users.schemas import Token, UserCreate, UserLogin, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserRead, status_code=201)
def register(data: UserCreate, db: Session = Depends(get_db)):
    return service.register_user(db, data)


@router.post("/login", response_model=Token)
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = service.authenticate(db, data.email, data.password)
    token = service.create_access_token(str(user.id))
    return Token(access_token=token)
