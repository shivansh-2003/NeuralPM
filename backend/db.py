"""Postgres connection singleton.

Usage (in any node or task):
    from db import get_pg_conn
    conn = get_pg_conn()
    row = conn.execute("SELECT * FROM memory_events WHERE id=%s", (event_id,)).fetchone()
    conn.commit()

The connection is created once per process and reused. If the connection drops,
psycopg2 will raise OperationalError — the caller should handle or let it bubble
up to FastAPI which returns 500.

Environment variable: DATABASE_URL
  Format: postgresql://user:password@host:port/dbname
  Example: postgresql://postgres:postgres@localhost:5432/neuralpm
"""

import os
import threading

import psycopg2
import psycopg2.extras  # RealDictCursor

_lock = threading.Lock()
_conn = None


def get_pg_conn():
    """Return the shared psycopg2 connection, creating it on first call."""
    global _conn
    with _lock:
        if _conn is None or _conn.closed:
            database_url = os.environ.get("DATABASE_URL")
            if not database_url:
                raise RuntimeError(
                    "DATABASE_URL environment variable is not set. "
                    "Example: postgresql://postgres:postgres@localhost:5432/neuralpm"
                )
            _conn = psycopg2.connect(
                database_url,
                cursor_factory=psycopg2.extras.RealDictCursor,
            )
            _conn.autocommit = False
    return _conn
