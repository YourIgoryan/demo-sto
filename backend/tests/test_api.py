import sys
import unittest
from datetime import timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend'))
from fastapi.testclient import TestClient
from app.main import app, hours_for, load_config, studio_today
from app.db import connect

class AutoStudioApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client_ctx = TestClient(app)
        cls.client = cls.client_ctx.__enter__()
        login = cls.client.post('/api/auth/login', json={'tenant':'sample','email':'owner@sample.local','password':'SampleOwner2026!'})
        if login.status_code != 200:
            raise RuntimeError('Run scripts/init_sample.py before tests')
        cls.auth = {'Authorization': 'Bearer ' + login.json()['access_token']}
        cfg = load_config('sample', public=False)
        day = studio_today(cfg) + timedelta(days=1)
        while not hours_for(cfg, day): day += timedelta(days=1)
        cls.day = day.isoformat()

    @classmethod
    def tearDownClass(cls):
        with connect() as c:
            c.execute("DELETE FROM payments WHERE booking_id IN (SELECT id FROM bookings WHERE tenant='sample' AND idempotency_key LIKE 'unittest-%')")
            c.execute("DELETE FROM bookings WHERE tenant='sample' AND idempotency_key LIKE 'unittest-%'")
        cls.client_ctx.__exit__(None, None, None)

    def test_public_config_and_availability(self):
        self.assertEqual(self.client.get('/api/health').status_code, 200)
        config = self.client.get('/api/public/sample/config')
        self.assertEqual(config.status_code, 200)
        self.assertGreater(len(config.json()['services']), 0)
        slots = self.client.get('/api/public/sample/availability', params={'service_id':'wash','day':self.day,'days':1})
        self.assertEqual(slots.status_code, 200)
        self.assertGreater(len(slots.json()['days'][0]['slots']), 0)

    def test_idempotency_and_overlap_lock(self):
        available = self.client.get('/api/public/sample/availability', params={'service_id':'wash','day':self.day,'days':1}).json()['days'][0]['slots']
        slot = available[0]
        body = {'service_id':'wash','start_at':slot['start_at'],'customer_name':'Unit Test','phone':'+79990000000','car':'QA vehicle','box_id':slot['box_id']}
        key = 'unittest-idempotency'
        first = self.client.post('/api/public/sample/book', json=body, headers={'Idempotency-Key':key})
        self.assertEqual(first.status_code, 200)
        retry = self.client.post('/api/public/sample/book', json=body, headers={'Idempotency-Key':key})
        self.assertTrue(retry.json()['duplicate'])
        conflict = self.client.post('/api/public/sample/book', json=body, headers={'Idempotency-Key':'unittest-overlap'})
        self.assertEqual(conflict.status_code, 409)

    def test_owner_tenant_scope(self):
        self.assertEqual(self.client.get('/api/owner/sample/dashboard', headers=self.auth).status_code, 200)
        self.assertEqual(self.client.get('/api/owner/other/dashboard', headers=self.auth).status_code, 403)

if __name__ == '__main__': unittest.main(verbosity=2)
