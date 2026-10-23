import getpass
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "backend"))

url = getpass.getpass("Вставь DATABASE_URL из Render (ввод скрыт): ")
os.environ["DATABASE_URL"] = url

from app.db import connect
from app.security import verify_password

email = "igor.kornilov155@gmail.com"
password = getpass.getpass("Пароль владельца: ")

with connect() as conn:
    row = conn.execute(
        "SELECT password_hash FROM owners WHERE tenant=? AND lower(email)=?",
        ("sample", email.lower()),
    ).fetchone()

if row is None:
    print("RESULT: OWNER_NOT_FOUND_IN_NEON")
elif verify_password(password, row["password_hash"]):
    print("RESULT: PASSWORD_MATCH")
else:
    print("RESULT: PASSWORD_MISMATCH")