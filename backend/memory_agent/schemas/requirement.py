"""Pydantic v2 schemas.

These are the contract between the LLM and Qdrant. The classify node produces a
ClassifyResult; the extract node produces a RequirementEvent. If the LLM emits
malformed JSON, constructing these raises ValidationError, which the nodes catch
before anything reaches the vector store.
"""

from typing import Literal, Optional

from pydantic import BaseModel, Field

EventType = Literal["requirement_update", "casual_chat", "preference_signal"]
Priority = Literal["critical", "high", "medium", "low"]


class ClassifyResult(BaseModel):
    """Output of the classify node."""

    type: EventType
    confidence: float = Field(ge=0.0, le=1.0)


class RequirementEvent(BaseModel):
    """A structured requirement, ready to be embedded and stored.

    project_id is mandatory — it is the scoping key for retrieval. Everything
    else is optional or inferred.
    """

    event_type: Literal["requirement_update"] = "requirement_update"
    description: str = Field(..., description="One clear sentence describing the requirement")
    acceptance_criteria: list[str] = Field(
        default_factory=list, description="Testable conditions (2-4 items)"
    )
    priority: Priority = "medium"
    affected_module: Optional[str] = Field(
        default=None, description="Domain area, e.g. auth, payment, dashboard"
    )
    project_id: str
    sprint_id: Optional[str] = None
    parent_requirement_id: Optional[str] = None
