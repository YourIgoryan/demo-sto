"""Remove cancelled/rejected test bookings from AutoStudio after making a backup.
Save this file in the AutoStudio project root and run: python cleanup_cancelled_bookings.py
Set CONFIRM_DELETE_CANCELLED=YES to actually delete rows.
"""
from __future__ import annotations
import os
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path

# Same path convention as backend/app/db.py
ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.getenv("AUTOSTUDIO_DB", str(ROOT / "data" / "autostudio.db")))
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
CANCELLED = ("cancelled", "canceled", "отменена", "отменено", "отменён", "отменен")
REJECTED = ("rejected", "отклонена", "отклонено")
STATUSES = CANCELLED + REJECTED

if DATABASE_URL:
    print("DATABASE_URL is set (PostgreSQL). This script intentionally refuses to modify it;")
    print("make a database backup first and run a reviewed DELETE against the production database.")
    raise SystemExit(2)
if not DB_PATH.exists():
    print(f"Database not found: {DB_PATH}")
    print("No records were changed. Check AUTOSTUDIO_DB or run this in the project root.")
    raise SystemExit(1)

conn = sqlite3.connect(DB_PATH)
try:
    conn.row_factory = sqlite3.Row
    statuses = ",".join("?" for _ in STATUSES)
    rows = conn.execute(
        f"SELECT id, tenant, start_at, status FROM bookings WHERE LOWER(TRIM(status)) IN ({statuses}) ORDER BY start_at",
        tuple(STATUSES),
    ).fetchall()
    print(f"Database: {DB_PATH}")
    print(f"Cancelled/rejected records found: {len(rows)}")
    for row in rows:
        print(f"id={row['id']} tenant={row['tenant']} start_at={row['start_at']} status={row['status']}")
    if os.getenv("CONFIRM_DELETE_CANCELLED") != "YES":
        print("Preview only. Nothing deleted. To back up and delete these records, run:")
        print("  $env:CONFIRM_DELETE_CANCELLED='YES'; python cleanup_cancelled_bookings.py")
        raise SystemExit(0)
    backup = DB_PATH.with_name(f"{DB_PATH.stem}.backup-{datetime.now():%Y%m%d-%H%M%S}{DB_PATH.suffix}")
    shutil.copy2(DB_PATH, backup)
    conn.execute("BEGIN IMMEDIATE")
    cur = conn.execute(
        f"DELETE FROM bookings WHERE LOWER(TRIM(status)) IN ({statuses})",
        tuple(STATUSES),
    )
    conn.commit()
    print(f"Deleted: {cur.rowcount} cancelled/rejected rows")
    print(f"Backup saved: {backup}")
except Exception:
    conn.rollback()
    raise
finally:
    conn.close()
