import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from core.db import Base


class Task(Base):
    __tablename__ = "tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    sprint_id = Column(UUID(as_uuid=True), nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    category = Column(String(50))  # frontend | backend | api | testing | devops
    severity = Column(String(20))  # critical | high | medium | low
    urgency = Column(String(20))  # immediate | this_sprint | next_sprint | backlog
    status = Column(String(20), default="backlog")
    required_skills = Column(JSONB, default=list)
    affected_module = Column(String(100))
    estimated_points = Column(Integer)
    progress_pct = Column(Integer, default=0)
    due_date = Column(DateTime(timezone=True), nullable=True)
    assignee_id = Column(UUID(as_uuid=True), ForeignKey("members.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class TaskDependency(Base):
    __tablename__ = "task_dependencies"

    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True)
    depends_on_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True)
