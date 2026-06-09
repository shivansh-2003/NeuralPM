"""Synthesize node: answer grounded in context memories + FalkorDB graph relations.

Two information sources injected into the prompt:
  1. context_memories   — vector hits selected by allocate_context_node
     (falls back to retrieved_memories if allocate_context hasn't run)
  2. context_relations  — FalkorDB graph triples
     (falls back to graph_relations)

Citation discipline:
  - Vector memory facts are cited as [mem_abc123]
  - Graph relationship facts are tagged [graph]
  - If neither source has enough info, the answer says so plainly

File attachment path (Iteration 9):
  If state["attachment"] is present (base64 image/PDF), the node
  calls Qwen2.5-VL:7b directly via the Ollama REST API instead of
  ChatOllama. For I-1 this path is inert — just ensure the model is
  pulled before I-9.
"""

from memory_agent.config import get_llm, get_settings

SYNTHESIZE_PROMPT = """You are a project intelligence assistant for NeuralPM.
Answer the user's question using ONLY the two sources below.
Do not use any outside knowledge.

── Vector Memories (semantic search hits) ─────────────────────────────────────
{memories}

── Graph Relations (entity relationships from FalkorDB) ──────────────────────
{relations}

───────────────────────────────────────────────────────────────────────────────
Question: {query}

Rules:
- Answer directly and concisely.
- Cite vector memories: [mem_abc123]
- Cite graph relationships with [graph], e.g. "Sarah is ASSIGNED_TO Payment API [graph]"
- Combine both sources when they complement each other.
- If neither source contains enough information, say so plainly.
- Do not invent facts not present in either source."""


def _fmt_memories(memories: list) -> str:
    if not memories:
        return "  (none retrieved)"
    lines = []
    for m in memories:
        mid      = m.get("id", "?")
        text     = m.get("memory", m.get("text", ""))
        meta     = m.get("metadata") or {}
        module   = meta.get("affected_module", "")
        priority = meta.get("priority", "")
        tier     = meta.get("memory_tier", "")
        score    = m.get("score")
        parts    = []
        if module and module != "unspecified":
            parts.append(module)
        if priority:
            parts.append(priority)
        if tier and tier != "active":
            parts.append(tier)
        if isinstance(score, (int, float)):
            parts.append(f"score={score:.2f}")
        tag = f" ({', '.join(parts)})" if parts else ""
        lines.append(f"  [{mid}]{tag}: {text}")
    return "\n".join(lines)


def _fmt_relations(relations: list) -> str:
    if not relations:
        return "  (none)"
    lines = []
    for r in relations:
        src  = r.get("source",       r.get("from",  "?"))
        rel  = r.get("relationship", r.get("type",  "?"))
        tgt  = r.get("target",       r.get("to",    "?"))
        lines.append(f"  ({src})-[:{rel}]->({tgt})")
    return "\n".join(lines)


def synthesize_node(state: dict) -> dict:
    # Prefer allocate_context output; fall back to raw retrieve output.
    memories  = state.get("context_memories")  or state.get("retrieved_memories", [])
    relations = state.get("context_relations") or state.get("graph_relations",    [])
    query     = state.get("query", "")
    attachment = state.get("attachment")   # base64 for Qwen-VL (I-9 onwards)

    if not memories and not relations:
        return {
            "answer":        "No relevant memories found for this project.",
            "memories_used": 0,
            "relations_used": 0,
        }

    prompt = SYNTHESIZE_PROMPT.format(
        memories=_fmt_memories(memories),
        relations=_fmt_relations(relations),
        query=query,
    )

    # ── Multimodal path (Qwen2.5-VL) — active from I-9 ──────────────────── #
    if attachment:
        try:
            import httpx
            s = get_settings()
            payload = {
                "model": "qwen2.5vl:7b",
                "messages": [{
                    "role": "user",
                    "content": [
                        {"type": "text",      "text": prompt},
                        {"type": "image_url", "image_url": {"url": attachment}},
                    ],
                }],
                "stream": False,
                "options": {"temperature": 0.2},
            }
            resp   = httpx.post(f"{s.ollama_base_url}/api/chat",
                                json=payload, timeout=90)
            answer = resp.json()["message"]["content"].strip()
        except Exception as e:
            answer = f"[Multimodal analysis failed: {e}] Falling back to text-only answer.\n\n"
            llm    = get_llm(json_mode=False, temperature=0.2)
            answer += llm.invoke(prompt).content.strip()
    else:
        # ── Standard path (Qwen3:8b) ──────────────────────────────────────── #
        llm    = get_llm(json_mode=False, temperature=0.2)
        answer = llm.invoke(prompt).content.strip()

    return {
        "answer":         answer,
        "memories_used":  len(memories),
        "relations_used": len(relations),
    }
