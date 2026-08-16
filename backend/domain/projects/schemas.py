from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[Literal["active", "archived", "completed"]] = None


class ProjectRead(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
