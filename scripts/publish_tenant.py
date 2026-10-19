import argparse, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(); p.add_argument('slug'); p.add_argument('--unpublish',action='store_true'); a=p.parse_args()
path=ROOT/'tenants'/a.slug/'config.json'
if not path.exists(): raise SystemExit(f'Не найдена студия {a.slug}')
c=json.loads(path.read_text(encoding='utf-8'))
if not a.unpublish:
    import subprocess,sys
    result=subprocess.run([sys.executable,str(ROOT/'scripts'/'check_tenant.py'),a.slug])
    if result.returncode: raise SystemExit('Публикация отменена: сначала исправьте ошибки проверки.')
c['published']=not a.unpublish
path.write_text(json.dumps(c,ensure_ascii=False,indent=2),encoding='utf-8')
print(('Черновик:' if a.unpublish else 'Опубликовано:')+f' /s/{a.slug}/')
