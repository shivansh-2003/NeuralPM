from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from core.db import Base


class AgentSetting(Base):
    __tablename__ = "agent_settings"

    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), primary_key=True)
    agent_name = Column(String(20), primary_key=True)  # assignment | risk | cascade
    mode = Column(String(10), default="suggest")  # suggest | auto
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
