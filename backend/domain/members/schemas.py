from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class MemberSkill(BaseModel):
    skill: str
    proficiency: int = Field(ge=1, le=5)


class MemberCreate(BaseModel):
    project_id: UUID
    name: str
    role: Optional[str] = None
    skills: list[MemberSkill] = []
    capacity: int = 100


class MemberUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    skills: Optional[list[MemberSkill]] = None
    capacity: Optional[int] = None
    active_points: Optional[int] = None
    velocity_avg: Optional[float] = None
    availability: Optional[Literal["available", "partial", "pto", "deactivated"]] = None


class MemberRead(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    role: Optional[str]
    skills: list[MemberSkill]
    capacity: int
    active_points: int
    velocity_avg: float
    availability: str
    created_at: datetime

    class Config:
        from_attributes = True
