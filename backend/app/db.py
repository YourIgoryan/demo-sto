from __future__ import annotations

import os
import re
import sqlite3
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
DB_PATH = Path(os.getenv("AUTOSTUDIO_DB", str(ROOT / "data" / "autostudio.db")))


class DatabaseIntegrityError(Exception):
    """Database uniqueness/constraint violation, independent of the backend."""


class SQLiteConnection:
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def execute(self, sql: str, params: Any = ()):
        return self.conn.execute(sql, params)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        try:
            if exc_type is not None:
                self.conn.rollback()
        finally:
            self.conn.close()
        return False


class PostgresConnection:
    """Small adapter preserving the sqlite-style execute/fetch API used by main.py."""

    def __init__(self, conn):
        self.conn = conn

    @staticmethod
    def _sql(sql: str) -> str:
        # This project uses qmark placeholders and no SQL string literals containing '?'.
        sql = sql.replace("?", "%s")
        if re.match(r"^\s*BEGIN\s+IMMEDIATE\s*;?\s*$", sql, re.IGNORECASE):
            return "BEGIN"
        return sql

    def execute(self, sql: str, params: Any = ()):
        normalized = self._sql(sql)
        try:
            cursor = self.conn.execute(normalized, params)
            if re.match(r"^\s*BEGIN\s+IMMEDIATE\s*;?\s*$", sql, re.IGNORECASE):
                # Serialize booking/move/payment transactions. The interval check and insert
                # must not race when two customers choose the same slot simultaneously.
                self.conn.execute("SELECT pg_advisory_xact_lock(684921730145)")
            return cursor
        except Exception as exc:
            try:
                import psycopg
                if isinstance(exc, psycopg.IntegrityError):
                    raise DatabaseIntegrityError(str(exc)) from exc
            except ImportError:
                pass
            raise

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        try:
            if exc_type is not None:
                self.conn.rollback()
            elif self.conn.info.transaction_status.name != "IDLE":
                self.conn.commit()
        finally:
            self.conn.close()
        return False


def connect():
    if DATABASE_URL:
        try:
            import psycopg
            from psycopg.rows import dict_row
        except ImportError as exc:
            raise RuntimeError(
                "DATABASE_URL задан, но psycopg не установлен. Добавьте psycopg[binary] в requirements.txt."
            ) from exc
        conn = psycopg.connect(DATABASE_URL, row_factory=dict_row, autocommit=True, connect_timeout=15)
        return PostgresConnection(conn)

    # Local development fallback. On Render set DATABASE_URL to Neon; SQLite on Render's
    # ephemeral filesystem is not persistent and should not be used for production bookings.
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=15, isolation_level=None, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=15000")
    return SQLiteConnection(conn)


def init_db() -> None:
    if DATABASE_URL:
        with connect() as c:
            c.execute("""
                CREATE TABLE IF NOT EXISTS owners (
                    tenant TEXT NOT NULL,
                    email TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY (tenant, email)
                )
            """)
            c.execute("""
                CREATE TABLE IF NOT EXISTS bookings (
                    id BIGSERIAL PRIMARY KEY,
                    tenant TEXT NOT NULL,
                    public_id TEXT NOT NULL UNIQUE,
                    idempotency_key TEXT NOT NULL,
                    service_id TEXT NOT NULL,
                    service_title TEXT NOT NULL,
                    duration_minutes INTEGER NOT NULL,
                    prep_minutes INTEGER NOT NULL DEFAULT 0,
                    box_id TEXT NOT NULL,
                    start_at TEXT NOT NULL,
                    end_at TEXT NOT NULL,
                    customer_name TEXT NOT NULL,
                    phone TEXT NOT NULL,
                    car TEXT NOT NULL,
                    note TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL DEFAULT 'booked',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    CONSTRAINT bookings_tenant_idempotency_unique UNIQUE (tenant, idempotency_key)
                )
            """)
            c.execute("""
                CREATE TABLE IF NOT EXISTS payments (
                    id BIGSERIAL PRIMARY KEY,
                    tenant TEXT NOT NULL,
                    booking_id BIGINT NOT NULL REFERENCES bookings(id),
                    kind TEXT NOT NULL,
                    amount BIGINT NOT NULL,
                    note TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL
                )
            """)
            c.execute("CREATE INDEX IF NOT EXISTS idx_bookings_tenant_start ON bookings(tenant, start_at)")
            c.execute("CREATE INDEX IF NOT EXISTS idx_bookings_tenant_box_interval ON bookings(tenant, box_id, start_at, end_at)")
            c.execute("CREATE INDEX IF NOT EXISTS idx_payments_tenant_created ON payments(tenant, created_at)")
        return

    with connect() as c:
        c.execute("""
            CREATE TABLE IF NOT EXISTS owners (
                tenant TEXT NOT NULL,
                email TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY (tenant, email)
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant TEXT NOT NULL,
                public_id TEXT NOT NULL UNIQUE,
                idempotency_key TEXT NOT NULL,
                service_id TEXT NOT NULL,
                service_title TEXT NOT NULL,
                duration_minutes INTEGER NOT NULL,
                prep_minutes INTEGER NOT NULL DEFAULT 0,
                box_id TEXT NOT NULL,
                start_at TEXT NOT NULL,
                end_at TEXT NOT NULL,
                customer_name TEXT NOT NULL,
                phone TEXT NOT NULL,
                car TEXT NOT NULL,
                note TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'booked',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE (tenant, idempotency_key)
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant TEXT NOT NULL,
                booking_id INTEGER NOT NULL REFERENCES bookings(id),
                kind TEXT NOT NULL,
                amount INTEGER NOT NULL,
                note TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
            )
        """)
        c.execute("CREATE INDEX IF NOT EXISTS idx_bookings_tenant_start ON bookings(tenant, start_at)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_bookings_tenant_box_interval ON bookings(tenant, box_id, start_at, end_at)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_payments_tenant_created ON payments(tenant, created_at)")
