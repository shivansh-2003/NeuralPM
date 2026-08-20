"""Postgres connection singleton for the memory_agent's raw SQL writes
(memory_events — not an ORM-mapped table, see domain/ for those).

Usage (in any node or task):
    from db import get_pg_conn
    conn = get_pg_conn()
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM memory_events WHERE id=%s", (event_id,))
        row = cur.fetchone()
    conn.commit()

psycopg2 connections don't support .execute() directly — always go through
a cursor. Reuses core.config's database_url (Phase 0's settings) rather than
reading DATABASE_URL again, so there is one source of truth for the DB URL.
"""

import threading

import psycopg2
import psycopg2.extras  # RealDictCursor

from core.config import get_settings

_lock = threading.Lock()
_conn = None


def get_pg_conn():
    """Return the shared psycopg2 connection, creating it on first call."""
    global _conn
    with _lock:
        if _conn is None or _conn.closed:
            _conn = psycopg2.connect(
                get_settings().database_url,
                cursor_factory=psycopg2.extras.RealDictCursor,
            )
            _conn.autocommit = False
    return _conn
