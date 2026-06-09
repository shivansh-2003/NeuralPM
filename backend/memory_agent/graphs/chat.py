"""Chat graph: retrieve -> allocate_context -> synthesize -> autopsy.

Flow:
    START -> retrieve -> allocate_context -> synthesize -> autopsy -> END

retrieve:          project-scoped Qdrant search + FalkorDB graph relations
allocate_context:  split memories across 5 token-budget slices (8192 ceiling)
synthesize:        Qwen3:8b grounded answer with [mem_id] + [graph] citations
autopsy:           build the Memory Autopsy transparency payload

The retrieve node enforces project_id scope and raises ValueError if missing.
The allocate_context node ensures the LLM prompt never exceeds MAX_TOKENS.
"""

from langgraph.graph import END, START, StateGraph

from memory_agent.nodes.allocate_context import allocate_context_node
from memory_agent.nodes.autopsy import autopsy_node
from memory_agent.nodes.retrieve import retrieve_node
from memory_agent.nodes.synthesize import synthesize_node


def build_chat_graph():
    graph = StateGraph(dict)

    graph.add_node("retrieve",         retrieve_node)
    graph.add_node("allocate_context", allocate_context_node)
    graph.add_node("synthesize",       synthesize_node)
    graph.add_node("autopsy",          autopsy_node)

    graph.add_edge(START,             "retrieve")
    graph.add_edge("retrieve",        "allocate_context")
    graph.add_edge("allocate_context","synthesize")
    graph.add_edge("synthesize",      "autopsy")
    graph.add_edge("autopsy",         END)

    return graph.compile()


chat_graph = build_chat_graph()
