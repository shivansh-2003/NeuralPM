import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from core.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String(255))
    role = Column(String(20), default="manager")  # manager | member | admin
    member_id = Column(UUID(as_uuid=True), ForeignKey("members.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
