import pytest

from core.exceptions import ConflictError
from domain.users import service as user_service
from domain.users.schemas import UserCreate


def test_register_authenticate_and_reject_duplicate(db_session):
    user = user_service.register_user(db_session, UserCreate(email="pm@test.com", password="test1234"))
    assert user_service.authenticate(db_session, "pm@test.com", "test1234").id == user.id

    with pytest.raises(ConflictError):
        user_service.register_user(db_session, UserCreate(email="pm@test.com", password="other"))
