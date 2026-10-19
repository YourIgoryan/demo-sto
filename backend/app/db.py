from __future__ import annotations
import os, sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = Path(os.getenv("AUTOSTUDIO_DB", str(ROOT / "data" / "autostudio.db")))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

class ConnectionContext:
    def __init__(self):
        self.conn = sqlite3.connect(DB_PATH, timeout=15, isolation_level=None, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys=ON")
        self.conn.execute("PRAGMA busy_timeout=15000")
    def __enter__(self):
        return self.conn
    def __exit__(self, exc_type, exc, tb):
        if exc_type is not None:
            try: self.conn.rollback()
            except sqlite3.Error: pass
        self.conn.close()
        return False

def connect() -> ConnectionContext:
    return ConnectionContext()

def init_db() -> None:
    with connect() as c:
        c.executescript('''
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS owners (
          tenant TEXT NOT NULL, email TEXT NOT NULL, password_hash TEXT NOT NULL,
          PRIMARY KEY (tenant, email)
        );
        CREATE TABLE IF NOT EXISTS bookings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tenant TEXT NOT NULL, public_id TEXT NOT NULL UNIQUE, idempotency_key TEXT NOT NULL,
          service_id TEXT NOT NULL, service_title TEXT NOT NULL, duration_minutes INTEGER NOT NULL,
          prep_minutes INTEGER NOT NULL DEFAULT 0, box_id TEXT NOT NULL,
          start_at TEXT NOT NULL, end_at TEXT NOT NULL,
          customer_name TEXT NOT NULL, phone TEXT NOT NULL, car TEXT NOT NULL,
          note TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'booked',
          created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
          UNIQUE(tenant, idempotency_key)
        );
        CREATE INDEX IF NOT EXISTS ix_bookings_tenant_start ON bookings(tenant, start_at);
        CREATE INDEX IF NOT EXISTS ix_bookings_tenant_box_time ON bookings(tenant, box_id, start_at, end_at);
        CREATE TABLE IF NOT EXISTS payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT, tenant TEXT NOT NULL,
          booking_id INTEGER NOT NULL REFERENCES bookings(id), kind TEXT NOT NULL,
          amount INTEGER NOT NULL, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS ix_payments_tenant ON payments(tenant, created_at);
        ''')
