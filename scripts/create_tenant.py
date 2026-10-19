from __future__ import annotations
import argparse, json, re, secrets, sqlite3, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))
from app.db import init_db, connect
from app.security import hash_password

def main():
    p=argparse.ArgumentParser(description='Создать новую студию из шаблона')
    p.add_argument('slug', help='URL-имя, латиница и дефисы')
    p.add_argument('--name', required=True)
    p.add_argument('--email', required=True)
    p.add_argument('--password', help='Если не указан, будет создан временный пароль')
    args=p.parse_args()
    slug=args.slug.lower()
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]{1,48}',slug): raise SystemExit('Ошибка: slug должен содержать 2–49 символов a-z, 0-9 и дефисы.')
    dest=ROOT/'tenants'/slug
    if dest.exists(): raise SystemExit(f'Папка {dest} уже существует.')
    template=json.loads((ROOT/'tenants'/'sample'/'config.json').read_text(encoding='utf-8'))
    template['slug']=slug; template['name']=args.name.strip(); template['published']=False
    template['description']=''; template['phone']=''; template['address']=''; template['map_url']=''
    template['hero_image']=''; template['gallery']=[]; template['logo']=''; template['services']=[]
    template['boxes']=[{'id':'box-1','title':'Бокс 1','active':True}]
    (dest/'media').mkdir(parents=True)
    (dest/'config.json').write_text(json.dumps(template,ensure_ascii=False,indent=2),encoding='utf-8')
    init_db(); password=args.password or secrets.token_urlsafe(10)
    with connect() as c:
        c.execute('INSERT INTO owners(tenant,email,password_hash) VALUES(?,?,?)',(slug,args.email.strip().lower(),hash_password(password)))
    print(f'Создан черновик: tenants/{slug}/config.json')
    print(f'Ссылка после публикации: /s/{slug}/')
    print(f'Кабинет: /owner/{slug}/')
    print(f'Владелец: {args.email.strip().lower()}')
    if not args.password: print(f'Временный пароль: {password}')
    print('Студия НЕ опубликована. Сначала заполните config.json и выполните check_tenant.py.')
if __name__=='__main__': main()
