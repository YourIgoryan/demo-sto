from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'backend'))
from app.db import init_db,connect
from app.security import hash_password
init_db()
with connect() as c:
    exists=c.execute("SELECT 1 FROM owners WHERE tenant='sample' AND email='owner@sample.local'").fetchone()
    if not exists:
        c.execute("INSERT INTO owners(tenant,email,password_hash) VALUES(?,?,?)",('sample','owner@sample.local',hash_password('SampleOwner2026!')))
print('Sample owner ready: owner@sample.local / SampleOwner2026!')
print('DEMO ONLY: change this password and AUTOSTUDIO_SECRET before public deployment.')
