import uuid

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from core.db import Base


class Member(Base):
    __tablename__ = "members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    name = Column(String, nullable=False)
    role = Column(String(100))
    skills = Column(JSONB, default=list)  # [{"skill": "python", "proficiency": 4}]
    capacity = Column(Integer, default=100)
    active_points = Column(Integer, default=0)
    velocity_avg = Column(Float, default=0)
    availability = Column(String(20), default="available")  # available | partial | pto | deactivated
    created_at = Column(DateTime(timezone=True), server_default=func.now())
