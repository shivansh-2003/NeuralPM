"""Memory Autopsy node.

Builds the transparency payload shown beneath every chatbot answer.
It answers the question "how did the system produce this answer?" by
surfacing exactly which memories were loaded, which were excluded and
why, how much of the context window was consumed, and which graph
relations contributed.

State keys consumed:
  query                — the original user question
  context_memories     — memories that made it into the prompt
  retrieved_memories   — everything retrieved before budget filtering
  filtered_out_budget  — memories dropped by allocate_context (budget hit)
  graph_relations      — FalkorDB relations used in the answer
  budget_used          — token breakdown dict from allocate_context
  memories_used        — count (set by synthesize_node)
  relations_used       — count (set by synthesize_node)

State keys produced:
  autopsy              — full autopsy dict, returned in the API response

Autopsy format:
  {
    "query":          "...",
    "timestamp":      "...",
    "context_tokens": 3247,
    "token_ceiling":  8192,
    "pct_used":       39.6,
    "loaded": [
      {"id": "...", "event_type": "...", "tier": "active",
       "relevance": 0.95, "score": 0.87, "text_preview": "..."}
    ],
    "filtered_out": [
      {"id": "...", "tier": "active", "reason": "superseded", "text_preview": "..."}
    ],
    "graph_relations": [
      {"source": "Sarah", "relationship": "ASSIGNED_TO", "target": "Payment API"}
    ],
    "budget_breakdown": {
      "active_project": 1842, "causal_history": 891, "recent_conversation": 514
    }
  }
"""

from datetime import datetime, timezone


def _reason_filtered(m: dict) -> str:
    meta = m.get("metadata") or {}
    if meta.get("superseded_by"):
        return f"superseded by {meta['superseded_by']}"
    tier = meta.get("memory_tier", "")
    if tier == "archived":
        return "archived (age > 365 days)"
    return "budget limit reached"


def autopsy_node(state: dict) -> dict:
    context_memories   = state.get("context_memories")    or state.get("retrieved_memories", [])
    retrieved_memories = state.get("retrieved_memories",   [])
    filtered_budget    = state.get("filtered_out_budget",  [])
    relations          = state.get("context_relations")   or state.get("graph_relations", [])
    budget             = state.get("budget_used",          {})

    # Memories that were retrieved but not in context (scope-filtered or superseded)
    context_ids     = {m.get("id") for m in context_memories}
    scope_filtered  = [m for m in retrieved_memories if m.get("id") not in context_ids
                       and m not in filtered_budget]

    loaded_entries = [
        {
            "id":           m.get("id", "?"),
            "event_type":   (m.get("metadata") or {}).get("event_type", "?"),
            "tier":         (m.get("metadata") or {}).get("memory_tier", "active"),
            "relevance":    (m.get("metadata") or {}).get("relevance_score", 1.0),
            "score":        round(float(m.get("score") or 0.0), 3),
            "text_preview": (m.get("memory") or m.get("text", ""))[:100],
        }
        for m in context_memories
    ]

    filtered_entries = []
    for m in scope_filtered:
        filtered_entries.append({
            "id":           m.get("id", "?"),
            "tier":         (m.get("metadata") or {}).get("memory_tier", "?"),
            "reason":       _reason_filtered(m),
            "text_preview": (m.get("memory") or m.get("text", ""))[:60],
        })
    for m in filtered_budget:
        filtered_entries.append({
            "id":           m.get("id", "?"),
            "tier":         (m.get("metadata") or {}).get("memory_tier", "?"),
            "reason":       "budget limit reached",
            "text_preview": (m.get("memory") or m.get("text", ""))[:60],
        })

    graph_entries = [
        {
            "source":       r.get("source",       r.get("from", "?")),
            "relationship": r.get("relationship", r.get("type", "?")),
            "target":       r.get("target",       r.get("to",   "?")),
        }
        for r in relations
    ]

    autopsy = {
        "query":          state.get("query", ""),
        "timestamp":      datetime.now(timezone.utc).isoformat(),
        "context_tokens": budget.get("total", 0),
        "token_ceiling":  budget.get("ceiling", 8192),
        "pct_used":       budget.get("pct_used", 0),
        "memories_loaded":  len(loaded_entries),
        "memories_filtered": len(filtered_entries),
        "loaded":          loaded_entries,
        "filtered_out":    filtered_entries,
        "graph_relations": graph_entries,
        "budget_breakdown": {
            "active_project":      budget.get("active_project", 0),
            "causal_history":      budget.get("causal_history", 0),
            "recent_conversation": budget.get("recent_conversation", 0),
            "user_preferences":    budget.get("user_preferences", 0),
            "reserve":             budget.get("reserve", 0),
        },
    }

    return {"autopsy": autopsy}
