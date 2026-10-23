import getpass
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "backend"))

from app.security import hash_password

password = getpass.getpass("Новый пароль владельца: ")
confirm = getpass.getpass("Повтори новый пароль: ")

if not password:
    print("Пароль не должен быть пустым.")
    raise SystemExit(1)

if password != confirm:
    print("Пароли не совпадают.")
    raise SystemExit(1)

print("\nХЕШ ДЛЯ NEON:")
print(hash_password(password))