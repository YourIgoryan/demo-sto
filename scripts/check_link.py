import argparse, json, urllib.error, urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description='Проверить публичную ссылку и API опубликованной студии')
p.add_argument('slug'); p.add_argument('--base-url',default='http://127.0.0.1:5173',help='Базовый URL приложения, например https://example.com')
a=p.parse_args(); base=a.base_url.rstrip('/'); errors=[]
local=ROOT/'tenants'/a.slug/'config.json'
if not local.exists(): raise SystemExit(f'FAIL: локальные настройки не найдены: {local}')
cfg=json.loads(local.read_text(encoding='utf-8'))
if not cfg.get('published'): raise SystemExit('FAIL: студия не опубликована; сначала выполните publish_tenant.py')
for path in (f'/api/public/{a.slug}/config',f'/s/{a.slug}/'):
    url=base+path
    try:
        with urllib.request.urlopen(url,timeout=12) as response:
            data=response.read()
            if response.status != 200: errors.append(f'{path}: HTTP {response.status}')
            elif path.endswith('/config'):
                parsed=json.loads(data.decode('utf-8'))
                if parsed.get('slug') != a.slug: errors.append(f'{path}: API вернул другую студию')
                else: print(f'OK API: {url} — {parsed.get("name")}')
            else: print(f'OK page: {url}')
    except (urllib.error.URLError,TimeoutError,ValueError) as e: errors.append(f'{url}: {e}')
if errors:
    print('ПРОВЕРКА ССЫЛКИ НЕ ПРОЙДЕНА'); [print(' - '+e) for e in errors]; raise SystemExit(1)
print('ПРОВЕРКА ССЫЛКИ ПРОЙДЕНА')
