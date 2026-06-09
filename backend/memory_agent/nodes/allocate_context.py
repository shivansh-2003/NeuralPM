"""Context budget allocator node.

Sits between retrieve and synthesize. Splits the retrieved memories across
five budget slices so the LLM prompt never exceeds MAX_TOKENS and each
category of information gets a fair share.

Default slice ceilings (token estimates, not hard token counts):
  active_project    30%  — recently active memories (tier='active')
  causal_history    25%  — older but accessed memories (tier='compressed')
  recent_conversation 20%  — last few turns (from state["conversation_history"])
  user_preferences  15%  — reserved for preference context (I-4 onward)
  reserve           10%  — buffer for reasoning overhead

Unused budget in one slice is NOT redistributed in this implementation —
keeping the allocator simple for I-1. The key guarantee is that archived and
superseded memories are excluded before ranking.

Output keys added to state:
  context_memories      list — memories selected for the prompt
  context_relations     list — FalkorDB relations (all passed through)
  budget_used           dict — token estimates per slice + total
  filtered_out_budget   list — memories dropped because ceiling was hit
"""

from datetime import datetime, timezone

MAX_TOKENS = 8_192

DEFAULT_CEILINGS = {
    "active_project":       int(MAX_TOKENS * 0.30),   # 2 457
    "causal_history":       int(MAX_TOKENS * 0.25),   # 2 048
    "recent_conversation":  int(MAX_TOKENS * 0.20),   # 1 638
    "user_preferences":     int(MAX_TOKENS * 0.15),   # 1 228
    "reserve":              int(MAX_TOKENS * 0.10),   #   819
}


def _estimate_tokens(text: str) -> int:
    """~1 token per 4 chars — fast, good enough for budgeting."""
    return max(1, len(text) // 4)


def _blended_score(m: dict) -> float:
    """50% cosine + 30% relevance_score + 20% recency."""
    cosine    = float(m.get("score", 0.0) or 0.0)
    relevance = float((m.get("metadata") or {}).get("relevance_score", 1.0))

    ts_raw = (m.get("metadata") or {}).get("timestamp") or m.get("created_at")
    if ts_raw:
        try:
            ts       = datetime.fromisoformat(str(ts_raw).replace("Z", "+00:00"))
            age_days = max(0, (datetime.now(timezone.utc) - ts).days)
            recency  = max(0.0, 1.0 - age_days / 365.0)
        except Exception:
            recency = 0.5
    else:
        recency = 0.5

    return (0.50 * cosine) + (0.30 * relevance) + (0.20 * recency)


def _fill_budget(memories: list, ceiling: int) -> tuple[list, int, list]:
    """Fill up to ceiling tokens. Returns (selected, tokens_used, overflow)."""
    selected = []
    used     = 0
    overflow = []
    for m in memories:
        tokens = _estimate_tokens(m.get("memory", m.get("text", "")))
        if used + tokens <= ceiling:
            selected.append(m)
            used += tokens
        else:
            overflow.append(m)
    return selected, used, overflow


def allocate_context_node(state: dict) -> dict:
    memories  = state.get("retrieved_memories", [])
    relations = state.get("graph_relations", [])
    history   = state.get("conversation_history", [])

    # Sort all memories by blended score before splitting by tier.
    sorted_memories = sorted(memories, key=_blended_score, reverse=True)

    # Split by tier — never include archived or superseded in active/causal.
    active   = [m for m in sorted_memories
                if (m.get("metadata") or {}).get("memory_tier", "active") == "active"]
    causal   = [m for m in sorted_memories
                if (m.get("metadata") or {}).get("memory_tier") == "compressed"]

    # Fill each slice
    active_sel,  active_tok,  active_over  = _fill_budget(active,  DEFAULT_CEILINGS["active_project"])
    causal_sel,  causal_tok,  causal_over  = _fill_budget(causal,  DEFAULT_CEILINGS["causal_history"])
    history_sel, history_tok, _            = _fill_budget(
        [{"memory": f"{h.get('role','?').upper()}: {h.get('content','')}"} for h in history[-6:]],
        DEFAULT_CEILINGS["recent_conversation"],
    )

    context_memories  = active_sel + causal_sel
    filtered_overflow = active_over + causal_over

    budget_used = {
        "active_project":      active_tok,
        "causal_history":      causal_tok,
        "recent_conversation": history_tok,
        "total":               active_tok + causal_tok + history_tok,
        "ceiling":             MAX_TOKENS,
        "pct_used":            round((active_tok + causal_tok + history_tok) / MAX_TOKENS * 100, 1),
    }

    return {
        "context_memories":    context_memories,
        "context_relations":   relations,           # pass through unchanged
        "context_history":     history_sel,
        "budget_used":         budget_used,
        "filtered_out_budget": filtered_overflow,   # for Autopsy
    }
