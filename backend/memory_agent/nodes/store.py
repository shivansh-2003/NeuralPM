"""Store node: embed the requirement and write it to Qdrant + FalkorDB via mem0,
then mirror the scalar decay fields to Postgres memory_events.

Two writes per ingest:
  1. mem0.add()  → Qdrant (vector + payload) + FalkorDB (entity/relationship graph)
  2. Postgres INSERT memory_events  → source of truth for decay metadata (I-2)

The Postgres row ID == the Qdrant point ID (UUID returned by mem0.add).
Keeping them in sync means the Celery decay job can UPDATE Postgres and then
call qdrant.set_payload() on the same UUID without any join.

infer=False tells mem0 to store our text verbatim instead of running its own
fact-extraction pipeline for the vector store. Graph extraction (FalkorDB) still
runs regardless of infer — it is a separate LLM call controlled by the graph_store
config, not the infer flag.
"""

import json
import uuid

from db import get_pg_conn
from memory_agent.config import get_mem0_client


def store_node(state: dict) -> dict:
    event = state.get("extracted_event")
    if event is None:
        return {
            "store_result": {
                "status":  "skipped",
                "reason":  "no requirement extracted",
            }
        }

    # ── Build embed text ──────────────────────────────────────────────────── #
    # Rich enough for semantic search AND for FalkorDB's extraction LLM to
    # identify meaningful entities and causal relationships.
    criteria   = ". ".join(event.acceptance_criteria)
    embed_text = event.description
    if criteria:
        embed_text = f"{event.description}. Acceptance criteria: {criteria}"
    if event.affected_module:
        embed_text = f"[Module: {event.affected_module}] {embed_text}"

    # ── Flat scalar metadata (Qdrant payload + Postgres mirror) ──────────── #
    metadata = {
        "event_type":            event.event_type,
        "priority":              event.priority,
        "affected_module":       event.affected_module or "unspecified",
        "project_id":            event.project_id,
        "sprint_id":             event.sprint_id or "unassigned",
        "parent_requirement_id": event.parent_requirement_id or "",
        "memory_tier":           "active",
        "relevance_score":       1.0,
    }

    # ── 1. mem0: Qdrant vector + FalkorDB graph ──────────────────────────── #
    client = get_mem0_client()
    mem_result = client.add(
        embed_text,
        user_id=state["user_id"],
        metadata=metadata,
        infer=False,
    )

    # mem0 returns either:
    #   dict {"results": [{"id": "...", "memory": "..."}], "relations": [...]}
    #   OR a list (older versions without graph_store)
    if isinstance(mem_result, dict):
        vector_ids = [r.get("id") for r in mem_result.get("results", []) if r.get("id")]
        relations  = mem_result.get("relations", [])
    else:
        vector_ids = []
        relations  = []

    # Use the mem0-assigned UUID if available; fall back to a fresh one.
    event_id = vector_ids[0] if vector_ids else str(uuid.uuid4())

    # ── 2. Postgres: memory_events row ──────────────────────────────────── #
    try:
        conn = get_pg_conn()
        conn.execute(
            """
            INSERT INTO memory_events
                (id, event_type, description, agent_source, metadata, timestamp,
                 relevance_score, memory_tier)
            VALUES (%s, %s, %s, %s, %s, NOW(), 1.0, 'active')
            ON CONFLICT (id) DO NOTHING
            """,
            (
                event_id,
                event.event_type,
                embed_text,
                "MemoryAgent",
                json.dumps(metadata),
            ),
        )
        conn.commit()
        pg_written = True
    except Exception as pg_err:
        # Don't crash the ingest — Postgres write is for decay (I-2).
        # The memory is already in Qdrant/FalkorDB which is what matters for I-1.
        pg_written = False
        pg_error   = str(pg_err)

    return {
        "store_result": {
            "status":          "stored",
            "event_id":        event_id,
            "vector_memories": len(vector_ids),
            "graph_relations": len(relations),
            "relations":       relations,      # for Memory Autopsy
            "pg_written":      pg_written,
        }
    }
