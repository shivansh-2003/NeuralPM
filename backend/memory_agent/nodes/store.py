"""Store node: embed the requirement and write it to Qdrant + FalkorDB + Postgres
via memory_agent.writer.write_memory_event — the same shared write path domain
services use to record structured events (e.g. task changes).

infer=False (inside write_memory_event) tells mem0 to store our text verbatim instead
of running its own fact-extraction pipeline for the vector store. Graph extraction
(FalkorDB) still runs regardless of infer — it is a separate LLM call controlled by
the graph_store config, not the infer flag.
"""

from memory_agent.writer import write_memory_event


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

    result = write_memory_event(
        embed_text,
        user_id=state["user_id"],
        project_id=event.project_id,
        event_type=event.event_type,
        agent_source="MemoryAgent",
        sprint_id=event.sprint_id,
        priority=event.priority,
        affected_module=event.affected_module,
    )

    return {"store_result": result}
