import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID

from core.db import Base


class Milestone(Base):
    __tablename__ = "milestones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    title = Column(String, nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=False)
    is_external = Column(Boolean, default=False)  # True = hard client commitment
    description = Column(Text)
