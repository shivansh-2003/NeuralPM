r"""Ingestion graph: two entry paths, one exit pipeline.

Text path  (raw_text, no file):
    START -> classify -> (requirement_update?) -> extract -> store -> END
                       \-> (casual_chat / preference_signal) -------> END

File path  (file_bytes present):
    START -> parse_file -> extract -> store -> END
    Files always bypass classify and are stored as requirement_update memory.

State is a plain dict. Nodes return partial updates which LangGraph merges.
"""

from langgraph.graph import END, START, StateGraph

from memory_agent.nodes.classify import classify_node
from memory_agent.nodes.extract import extract_node
from memory_agent.nodes.parse_file import parse_file_node
from memory_agent.nodes.store import store_node


def _entry_router(state: dict) -> str:
    """Route to parse_file if a file was uploaded, otherwise classify text."""
    if state.get("file_bytes"):
        return "parse_file"
    return "classify"


def _route_after_classify(state: dict) -> str:
    if state["classification"]["type"] == "requirement_update":
        return "extract"
    return END


def build_ingestion_graph():
    graph = StateGraph(dict)

    graph.add_node("parse_file", parse_file_node)
    graph.add_node("classify", classify_node)
    graph.add_node("extract", extract_node)
    graph.add_node("store", store_node)

    graph.add_conditional_edges(
        START,
        _entry_router,
        {"parse_file": "parse_file", "classify": "classify"},
    )

    # File path: parse_file always proceeds to extract
    graph.add_edge("parse_file", "extract")

    # Text path: classify gates the extract step
    graph.add_conditional_edges(
        "classify",
        _route_after_classify,
        {"extract": "extract", END: END},
    )

    graph.add_edge("extract", "store")
    graph.add_edge("store", END)

    return graph.compile()


ingestion_graph = build_ingestion_graph()
