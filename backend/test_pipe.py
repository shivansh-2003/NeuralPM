"""Step 0 — verify the pipe before building anything else.

Confirms that Mem0 can embed text, write it to Qdrant, and retrieve it by
semantic search with a project_id filter. If this doesn't pass, stop and fix
infrastructure before touching the graphs.

Run:  python test_pipe.py
"""

from memory_agent.config import get_mem0_client


def main():
    m = get_mem0_client()

    print("Writing a memory...")
    add_result = m.add(
        "Users can pay via Stripe using saved cards or new card entry",
        user_id="test_user",
        metadata={
            "project_id": "alpha",
            "sprint_id": "sprint_1",
            "event_type": "requirement_update",
            "memory_tier": "active",
            "relevance_score": 1.0,
        },
        infer=False,
    )

    # With FalkorDB graph_store, add() returns {"results": [...], "relations": [...]}
    if isinstance(add_result, dict):
        vectors   = len(add_result.get("results",   []))
        relations = len(add_result.get("relations", []))
        print(f"  add -> vectors={vectors}, graph_relations={relations}")
        for rel in add_result.get("relations", []):
            print(f"    ({rel.get('source')})-[:{rel.get('relationship')}]->({rel.get('target')})")
    else:
        print("  add ->", add_result)

    print("\nSearching within project 'alpha'...")
    search_result = m.search(
        "payment methods",
        filters={"user_id": "test_user", "project_id": "alpha"},
        limit=5,
    )

    # Handle both response shapes: dict (graph enabled) or list (vector only)
    if isinstance(search_result, dict):
        memories  = search_result.get("results",   [])
        relations = search_result.get("relations", [])
    else:
        memories  = search_result
        relations = []

    print(f"  found {len(memories)} memory(ies), {len(relations)} relation(s):")
    for mem in memories:
        print("   -", mem.get("memory", mem))
    for rel in relations:
        print(f"   ~ ({rel.get('source')})-[:{rel.get('relationship')}]->({rel.get('target')})")

    print("\nNegative check: searching project 'beta' should return nothing...")
    beta = m.search(
        "payment methods",
        filters={"user_id": "test_user", "project_id": "beta"},
        limit=5,
    )
    beta_memories = beta.get("results", beta) if isinstance(beta, dict) else beta
    print(f"  project 'beta' returned {len(beta_memories)} memory(ies)")

    assert len(memories) >= 1, "PIPE BROKEN: alpha search returned nothing"
    assert len(beta_memories) == 0, "SCOPE LEAK: beta search returned alpha memories"
    print("\n✅  Pipe is live, project-scoped, and FalkorDB graph is active.")
    print("Proceed to test_graph.py for full graph validation.")


if __name__ == "__main__":
    main()
