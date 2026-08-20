"""Shared 'write a memory' path: embed + write to Qdrant/FalkorDB via mem0, then
mirror to Postgres memory_events. Used by store_node (LLM-extracted requirements,
free-text chat ingestion) and by domain services that already have structured data
and want to record a memory without going through classify/extract (e.g.
domain/tasks/service.py on task create/update).

One write path, one INSERT statement, so there's a single source of truth for how a
memory lands across all three stores.
"""

import json
import uuid

from db import get_pg_conn
from memory_agent.config import get_mem0_client


def write_memory_event(
    text: str,
    *,
    user_id: str,
    project_id: str,
    event_type: str,
    agent_source: str = "MemoryAgent",
    sprint_id: str | None = None,
    task_id: str | None = None,
    member_id: str | None = None,
    priority: str = "medium",
    affected_module: str | None = None,
) -> dict:
    """Best-effort on the Postgres mirror — a DB hiccup must not lose the mem0 write,
    which already succeeded and is what retrieval actually reads from.
    """
    metadata = {
        "event_type":      event_type,
        "priority":        priority,
        "affected_module": affected_module or "unspecified",
        "project_id":      project_id,
        "sprint_id":       sprint_id or "unassigned",
        "memory_tier":     "active",
        "relevance_score": 1.0,
    }

    client = get_mem0_client()
    mem_result = client.add(text, user_id=user_id, metadata=metadata, infer=False)

    if isinstance(mem_result, dict):
        vector_ids = [r.get("id") for r in mem_result.get("results", []) if r.get("id")]
        relations  = mem_result.get("relations", [])
    else:
        vector_ids = []
        relations  = []

    event_id = vector_ids[0] if vector_ids else str(uuid.uuid4())

    pg_written = False
    try:
        conn = get_pg_conn()
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO memory_events
                    (id, task_id, event_type, description, agent_source, member_id,
                     sprint_id, metadata, timestamp, relevance_score, memory_tier)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW(), 1.0, 'active')
                ON CONFLICT (id) DO NOTHING
                """,
                (event_id, task_id, event_type, text, agent_source, member_id,
                 sprint_id, json.dumps(metadata)),
            )
        conn.commit()
        pg_written = True
    except Exception:
        pass

    return {
        "status":          "stored",
        "event_id":        event_id,
        "vector_memories": len(vector_ids),
        "graph_relations": len(relations),
        "relations":       relations,
        "pg_written":      pg_written,
    }
