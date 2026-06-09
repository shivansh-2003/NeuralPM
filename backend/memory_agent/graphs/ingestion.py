r"""Ingestion graph: classify -> extract -> store.

Flow:
    START -> classify -> (requirement_update?) -> extract -> store -> END
                       \-> (otherwise) ---------------------------> END

State is a plain dict. Nodes return partial updates which LangGraph merges.
Uses the modern START/END edges rather than set_entry_point.
"""

from langgraph.graph import END, START, StateGraph

from memory_agent.nodes.classify import classify_node
from memory_agent.nodes.extract import extract_node
from memory_agent.nodes.store import store_node


def _route_after_classify(state: dict) -> str:
    if state["classification"]["type"] == "requirement_update":
        return "extract"
    return END  # casual_chat / preference_signal -> skip storage


def build_ingestion_graph():
    graph = StateGraph(dict)

    graph.add_node("classify", classify_node)
    graph.add_node("extract", extract_node)
    graph.add_node("store", store_node)

    graph.add_edge(START, "classify")
    graph.add_conditional_edges(
        "classify",
        _route_after_classify,
        {"extract": "extract", END: END},
    )
    graph.add_edge("extract", "store")
    graph.add_edge("store", END)

    return graph.compile()


ingestion_graph = build_ingestion_graph()
