import uuid

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from core.db import Base


class UserPreference(Base):
    __tablename__ = "user_preference_memory"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    preference_type = Column(String(50))
    preference_value = Column(JSONB, default=dict)
    confidence = Column(Float, default=0.0)
    evidence_count = Column(Integer, default=0)
    last_observed = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
