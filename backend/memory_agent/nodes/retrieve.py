"""Retrieve node: project-scoped semantic search + FalkorDB graph relations.

With FalkorDB graph_store configured, mem0.search() returns:
  {
    "results": [                        ← vector hits (Qdrant, cosine similarity)
      {"id": "...", "memory": "...", "score": 0.87, "metadata": {...}},
      ...
    ],
    "relations": [                      ← graph-connected entities (FalkorDB)
      {"source": "Sarah", "relationship": "ASSIGNED_TO", "target": "Payment API"},
      {"source": "Payment API", "relationship": "BLOCKS", "target": "Checkout Flow"},
      ...
    ]
  }

We surface both to the synthesize_node so answers can blend semantic retrieval
with graph-traversal facts (e.g. "who is blocking what" from the relations list).

project_id isolation rule:
  The hard filter on project_id is a guarantee, not a convenience. If it is
  missing, we raise immediately. FalkorDB's per-user isolation (mem0_{user_id})
  adds a second physical boundary on top of this metadata filter.

Archived-tier exclusion:
  Phase 1.5's decay job will start tagging old memories memory_tier='archived'.
  We exclude those from chat context now, ahead of that job existing, so
  Phase 1.5 doesn't need to touch this file. mem0's `{"in": [...]}` filter
  operator is reported broken against the Qdrant backend (mem0 issue #3975 —
  see README "Decisions baked in"), so this is a post-filter in code, not a
  query-side filter.

Access bookkeeping:
  Bumping access_count/last_accessed on the top hits is decay bookkeeping for
  Phase 1.5's relevance scoring. It's best-effort — a Postgres hiccup here
  must never fail a chat query.
"""

from memory_agent.config import get_mem0_client
from db import get_pg_conn

MAX_RESULTS = 8


def retrieve_node(state: dict) -> dict:
    project_id = state.get("project_id")
    if not project_id:
        raise ValueError(
            "project_id is required for retrieval — "
            "refusing to search across all projects"
        )

    client = get_mem0_client()

    # user_id + project_id both go into filters (mem0 v2.x requires entity
    # scopes inside filters, not as top-level kwargs to search()).
    response = client.search(
        state["query"],
        filters={
            "user_id":    state["user_id"],
            "project_id": project_id,
        },
        limit=MAX_RESULTS,
    )

    # ── Parse mem0 response shape ─────────────────────────────────────────── #
    # With graph_store:    dict  {"results": [...], "relations": [...]}
    # Without graph_store: list  [...]  (or dict with only "results" key)
    if isinstance(response, dict):
        memories   = response.get("results", [])
        relations  = response.get("relations", [])
    else:
        memories   = response if isinstance(response, list) else []
        relations  = []

    memories = [m for m in memories if (m.get("metadata") or {}).get("memory_tier") != "archived"]

    memory_ids = [m.get("id") for m in memories if m.get("id")]
    if memory_ids:
        try:
            conn = get_pg_conn()
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE memory_events SET access_count = access_count + 1, "
                    "last_accessed = NOW() WHERE id = ANY(%s)",
                    (memory_ids,),
                )
            conn.commit()
        except Exception:
            pass

    return {
        "retrieved_memories": memories,
        "graph_relations":    relations,   # forwarded to synthesize_node
    }
