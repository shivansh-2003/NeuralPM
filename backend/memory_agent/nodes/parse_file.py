"""parse_file node: extract raw text from an uploaded file.

Supports:
  - PDF  (.pdf)          — via pdfplumber
  - Plain text           — .txt, .md, .rst, .csv, and any other text/* type

Files always bypass classify and enter the ingestion graph as
requirement_update so that product-owner documents are stored verbatim
as long-term memory without the casual_chat / preference_signal gate.
"""

import io
import pdfplumber


_MAX_TEXT_BYTES = 200_000  # ~50k tokens — generous ceiling before truncation


def parse_file_node(state: dict) -> dict:
    """Read state['file_bytes'] + state['file_name'], return {'raw_text': ..., 'classification': ...}."""
    file_bytes: bytes = state["file_bytes"]
    file_name: str = state.get("file_name", "upload")

    raw_text = _extract_text(file_bytes, file_name)

    if len(raw_text.encode()) > _MAX_TEXT_BYTES:
        raw_text = raw_text.encode()[:_MAX_TEXT_BYTES].decode("utf-8", errors="ignore")

    return {
        "raw_text": raw_text,
        # Force requirement_update — files skip the classify gate entirely.
        "classification": {"type": "requirement_update", "confidence": 1.0},
    }


def _extract_text(file_bytes: bytes, file_name: str) -> str:
    name_lower = file_name.lower()

    if name_lower.endswith(".pdf"):
        return _extract_pdf(file_bytes)

    # Treat everything else as plain text (txt, md, rst, csv, …)
    for encoding in ("utf-8", "latin-1"):
        try:
            return file_bytes.decode(encoding)
        except UnicodeDecodeError:
            continue

    raise ValueError(f"Cannot decode file '{file_name}' as text. Only PDF and text files are supported.")


def _extract_pdf(file_bytes: bytes) -> str:
    text_parts = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
    if not text_parts:
        raise ValueError("PDF appears to contain no extractable text (may be a scanned image PDF).")
    return "\n\n".join(text_parts)
