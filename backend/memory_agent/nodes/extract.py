"""Extract node: turn requirement text into a structured RequirementEvent.

Only runs when classification.type == 'requirement_update'. The Pydantic model
is the gate: if the LLM's JSON doesn't validate, we record the error and store
nothing.
"""

from pydantic import ValidationError

from memory_agent.config import get_llm
from memory_agent.nodes import parse_llm_json
from memory_agent.schemas.requirement import RequirementEvent

EXTRACT_PROMPT = """Extract structured requirement details from this message.

Project ID: {project_id}
Sprint ID: {sprint_id}
Message: {text}

Return ONLY a JSON object matching this exact schema:
{{
  "event_type": "requirement_update",
  "description": "<one clear sentence describing the requirement>",
  "acceptance_criteria": ["<criterion 1>", "<criterion 2>"],
  "priority": "critical" | "high" | "medium" | "low",
  "affected_module": "<module name or null>",
  "project_id": "{project_id}",
  "sprint_id": {sprint_id_json},
  "parent_requirement_id": null
}}

Rules:
- description must be a single complete sentence
- acceptance_criteria must be testable, concrete conditions (2-4 items)
- if priority is not stated, infer it from urgency language
- affected_module: extract the domain area (auth, payment, dashboard, ...) or null

Return only the JSON object. No explanation, no markdown."""


def extract_node(state: dict) -> dict:
    if state["classification"]["type"] != "requirement_update":
        return {}  # nothing to do; nodes return partial updates

    sprint_id = state.get("sprint_id")
    sprint_id_json = f'"{sprint_id}"' if sprint_id else "null"

    llm = get_llm(json_mode=True)
    prompt = EXTRACT_PROMPT.format(
        text=state["raw_text"],
        project_id=state["project_id"],
        sprint_id=sprint_id or "unassigned",
        sprint_id_json=sprint_id_json,
    )
    response = llm.invoke(prompt)

    try:
        data = parse_llm_json(response.content)
        # Force the trusted scoping fields rather than trusting the model.
        data["project_id"] = state["project_id"]
        if sprint_id:
            data["sprint_id"] = sprint_id
        event = RequirementEvent(**data)
        return {"extracted_event": event}
    except (ValidationError, ValueError) as e:
        return {"extraction_error": str(e)}
