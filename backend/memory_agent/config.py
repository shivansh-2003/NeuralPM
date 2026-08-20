"""Central configuration: settings, the shared Mem0 client, and the LLM factory.

FalkorDB integration strategy (from FalkorDB blog + AIAnytime reference):
  - mem0-falkordb is a runtime-patching plugin: call register() BEFORE importing
    or initialising mem0.Memory. It intercepts mem0's internal graph calls and
    translates them into FalkorDB-optimised Cypher — no mem0 fork needed.
  - graph_store.provider = "falkordb" replaces the default Neo4j provider.
  - FalkorDB auto-creates one graph per user_id (named mem0_{user_id}), giving
    per-user graph isolation with zero leakage and constant query time at scale.
  - FalkorDB uses the Redis wire protocol on port 6379 — same docker image, no
    Bolt URI or auth config needed for local dev.

Reference:
  https://www.falkordb.com/blog/graph-memory-llm-agents-mem0-falkordb/
  https://github.com/FalkorDB/mem0-falkordb
"""

# ⚠️  register() MUST be the very first thing that runs — before any mem0 import.
#     It monkey-patches mem0 internals at import time. Moving it below the mem0
#     import silently breaks the FalkorDB translation layer.
from mem0_falkordb import register
register()

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Qdrant (vector store)
    qdrant_host: str = "localhost"
    qdrant_port: int = 6333
    qdrant_collection: str = "neuralpm_memories"

    # FalkorDB (graph store)
    falkordb_host: str = "localhost"
    falkordb_port: int = 6379
    falkordb_database: str = "mem0"

    # Ollama
    ollama_base_url: str = "http://localhost:11434"
    llm_model: str = "qwen3:8b"
    embed_model: str = "qwen3-embedding:0.6b"
    embed_dims: int = 1024  # MUST match embed_model's real output dimension


@lru_cache
def get_settings() -> Settings:
    return Settings()


# --------------------------------------------------------------------------- #
# NeuralPM graph extraction prompt                                             #
# --------------------------------------------------------------------------- #
# mem0 uses its LLM to extract entities + relationships from the stored text
# and writes them into FalkorDB as typed nodes and edges. The custom_prompt
# tells that LLM what to focus on for NeuralPM's domain.
#
# FalkorDB will auto-create graphs named:
#   mem0_{user_id}   (e.g. mem0_alice, mem0_project_alpha_pm)
# Per-user isolation means a query for user A never touches user B's graph.

GRAPH_EXTRACTION_PROMPT = """
You are extracting a knowledge graph from project management events.

Entities to capture (as nodes):
  - Engineers / team members (name, role)
  - Tasks (id, title, module, status)
  - Requirements (description, module, priority)
  - Risks (type: stale | overload | deadline | blocker_chain, severity)
  - Sprints (id or name)
  - Modules (payment, auth, dashboard, etc.)
  - Agents (AssignmentAgent, RiskAgent, CascadeAgent)

Relationships to capture (as typed edges):
  - (Engineer)-[:ASSIGNED_TO]->(Task)
  - (Task)-[:BLOCKS]->(Task)
  - (Requirement)-[:PART_OF]->(Module)
  - (Risk)-[:AFFECTS]->(Task)
  - (Risk)-[:CAUSED_BY]->(Task or Requirement)
  - (Task)-[:DELAYED_BY]->(Task)
  - (Agent)-[:FLAGGED]->(Risk)
  - (Agent)-[:SUGGESTED]->(Engineer)
  - (Engineer)-[:OVERLOADED_AT]->(Sprint)

Always extract the causal direction. If "Payment API was delayed because Sarah
was overloaded", create both the overload node and the DELAYED_BY relationship.
""".strip()


# --------------------------------------------------------------------------- #
# Shared Mem0 client (Qdrant vectors + FalkorDB graph)                        #
# --------------------------------------------------------------------------- #

def _build_mem0_client():
    """
    ── DEPLOYMENT SWAP POINT ──────────────────────────────────────────────
    To switch to OpenAI for production: set embedder.provider to "openai",
    model to "text-embedding-3-small", and embed_dims to 1536. This REQUIRES
    a new Qdrant collection — dims can't change on an existing one. Do not
    do this until the Ollama path is fully proven.
    ────────────────────────────────────────────────────────────────────────
    """
    from mem0 import Memory  # imported AFTER register() has patched internals

    s = get_settings()
    config = {
        # ── Vector store: Qdrant ──────────────────────────────────────────── #
        "vector_store": {
            "provider": "qdrant",
            "config": {
                "collection_name": s.qdrant_collection,
                "host": s.qdrant_host,
                "port": s.qdrant_port,
                "embedding_model_dims": s.embed_dims,
            },
        },

        # ── Graph store: FalkorDB ─────────────────────────────────────────── #
        # register() above has already told mem0 that "falkordb" is a valid
        # provider. Each user_id gets its own isolated graph: mem0_{user_id}.
        "graph_store": {
            "provider": "falkordb",
            "config": {
                "host": s.falkordb_host,
                "port": s.falkordb_port,
                "database": s.falkordb_database,
            },
            "custom_prompt": GRAPH_EXTRACTION_PROMPT,
        },

        # ── Embedder: Qwen3-Embedding via Ollama ──────────────────────────── #
        "embedder": {
            "provider": "ollama",
            "config": {
                "model": s.embed_model,
                "ollama_base_url": s.ollama_base_url,
                "embedding_dims": s.embed_dims,
            },
        },

        # ── LLM: Qwen3 via Ollama ─────────────────────────────────────────── #
        # Used by mem0 for graph entity extraction (even when infer=False for
        # the vector store path). temperature=0 keeps extraction deterministic.
        "llm": {
            "provider": "ollama",
            "config": {
                "model": s.llm_model,
                "ollama_base_url": s.ollama_base_url,
                "temperature": 0,
            },
        },
    }
    return Memory.from_config(config)


# Lazy singleton — importing this module doesn't require services to be running.
_mem0_client = None


def get_mem0_client():
    global _mem0_client
    if _mem0_client is None:
        _mem0_client = _build_mem0_client()
    return _mem0_client


# --------------------------------------------------------------------------- #
# Shared LLM factory (for our own LangGraph nodes)                            #
# --------------------------------------------------------------------------- #
# Qwen3 thinks by default, which breaks structured JSON output. We disable
# thinking and constrain output format. temperature=0 for deterministic parsing.

def get_llm(json_mode: bool = True, temperature: float = 0.0):
    """
    ── DEPLOYMENT SWAP POINT ──────────────────────────────────────────────
    To switch to OpenAI: return ChatOpenAI(model="gpt-5.6", ...) here. Note
    GPT-5.6 doesn't need reasoning=False or <think>-block stripping — that
    logic (see parse_llm_json) is Qwen3-specific and should become
    conditional (or removed) on this swap.
    ────────────────────────────────────────────────────────────────────────
    """
    from langchain_ollama import ChatOllama

    s = get_settings()
    kwargs = {
        "model": s.llm_model,
        "base_url": s.ollama_base_url,
        "temperature": temperature,
        "reasoning": False,   # disable Qwen3 thinking mode
    }
    if json_mode:
        kwargs["format"] = "json"
    return ChatOllama(**kwargs)
