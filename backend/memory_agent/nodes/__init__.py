"""Graph nodes plus a shared helper for parsing LLM JSON output."""

import json
import re


def parse_llm_json(raw: str) -> dict:
    """Parse JSON from an LLM response, tolerating common deviations.

    Even with format="json", models occasionally wrap output in ```json fences
    or prepend stray whitespace. This strips fences and grabs the first JSON
    object if there is surrounding text. Raises json.JSONDecodeError on failure.

    Also strips <think>...</think> blocks: reasoning=False disables Qwen3's
    thinking mode, but it isn't airtight — a leaked think-block ahead of the
    JSON is the single biggest cause of parse failures if left in.
    """
    text = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()

    # Strip ```json ... ``` or ``` ... ``` fences.
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Fall back to the first {...} block if the model added prose.
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise
