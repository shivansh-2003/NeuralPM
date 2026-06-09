"""Classify node: decide what kind of message this is.

requirement_update -> goes on to extraction and storage
casual_chat / preference_signal -> skipped for the MVP (no storage)
"""

from memory_agent.config import get_llm
from memory_agent.nodes import parse_llm_json
from memory_agent.schemas.requirement import ClassifyResult

CLASSIFY_PROMPT = """Classify this message from a Product Owner or team member.

Message: {text}

Return ONLY a JSON object matching this schema:
{{"type": "requirement_update" | "casual_chat" | "preference_signal", "confidence": 0.0-1.0}}

Definitions:
- requirement_update: describes a feature, user story, acceptance criterion, or a change to scope
- casual_chat: greetings, status checks, general conversation
- preference_signal: expresses a personal preference about how the system should behave

Return only the JSON object. No explanation, no markdown."""


def classify_node(state: dict) -> dict:
    llm = get_llm(json_mode=True)
    prompt = CLASSIFY_PROMPT.format(text=state["raw_text"])
    response = llm.invoke(prompt)

    try:
        result = ClassifyResult(**parse_llm_json(response.content))
        return {"classification": result.model_dump()}
    except Exception as e:
        # On any parse/validation failure, default to casual_chat so the graph
        # skips storage rather than writing garbage. Surface the reason.
        return {
            "classification": {"type": "casual_chat", "confidence": 0.0},
            "classify_error": str(e),
        }
