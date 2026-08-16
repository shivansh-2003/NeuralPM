from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class MilestoneCreate(BaseModel):
    project_id: UUID
    title: str
    due_date: datetime
    is_external: bool = False
    description: Optional[str] = None


class MilestoneUpdate(BaseModel):
    title: Optional[str] = None
    due_date: Optional[datetime] = None
    is_external: Optional[bool] = None
    description: Optional[str] = None


class MilestoneRead(BaseModel):
    id: UUID
    project_id: UUID
    title: str
    due_date: datetime
    is_external: bool
    description: Optional[str]

    class Config:
        from_attributes = True
