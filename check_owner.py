import getpass
import sys

sys.path.insert(0, "backend")

from app.db import connect
from app.security import verify_password

email = "igor.kornilov155@gmail.com"
password = getpass.getpass("Пароль владельца: ")

with connect() as c:
    row = c.execute(
        "SELECT password_hash FROM owners WHERE tenant=? AND lower(email)=?",
        ("sample", email.lower())
    ).fetchone()

if row is None:
    print("RESULT: OWNER_NOT_FOUND_IN_LOCAL_DB")
elif verify_password(password, row["password_hash"]):
    print("RESULT: PASSWORD_MATCH")
else:
    print("RESULT: PASSWORD_MISMATCH")