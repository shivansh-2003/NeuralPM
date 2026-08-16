from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class RequiredSkill(BaseModel):
    skill: str
    weight: float = Field(ge=0.0, le=1.0)


class TaskCreate(BaseModel):
    project_id: UUID
    sprint_id: Optional[UUID] = None
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    severity: Optional[Literal["critical", "high", "medium", "low"]] = None
    urgency: Optional[Literal["immediate", "this_sprint", "next_sprint", "backlog"]] = None
    required_skills: list[RequiredSkill] = []
    affected_module: Optional[str] = None
    estimated_points: Optional[int] = None
    due_date: Optional[datetime] = None
    assignee_id: Optional[UUID] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    severity: Optional[Literal["critical", "high", "medium", "low"]] = None
    urgency: Optional[Literal["immediate", "this_sprint", "next_sprint", "backlog"]] = None
    status: Optional[str] = None
    required_skills: Optional[list[RequiredSkill]] = None
    affected_module: Optional[str] = None
    estimated_points: Optional[int] = None
    progress_pct: Optional[int] = None
    due_date: Optional[datetime] = None
    assignee_id: Optional[UUID] = None


class TaskRead(BaseModel):
    id: UUID
    project_id: UUID
    sprint_id: Optional[UUID]
    title: str
    description: Optional[str]
    category: Optional[str]
    severity: Optional[str]
    urgency: Optional[str]
    status: str
    required_skills: list[RequiredSkill]
    affected_module: Optional[str]
    estimated_points: Optional[int]
    progress_pct: int
    due_date: Optional[datetime]
    assignee_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TaskDependencyCreate(BaseModel):
    depends_on_id: UUID


class TaskDependencyRead(BaseModel):
    task_id: UUID
    depends_on_id: UUID

    class Config:
        from_attributes = True
