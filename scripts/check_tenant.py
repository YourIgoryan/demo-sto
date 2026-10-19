import argparse, json, re, sys
from datetime import datetime, date
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(); p.add_argument('slug'); a=p.parse_args()
path=ROOT/'tenants'/a.slug/'config.json'
errors=[]; warnings=[]
if not path.exists(): raise SystemExit(f'FAIL: нет файла {path}')
try: c=json.loads(path.read_text(encoding='utf-8'))
except Exception as e: raise SystemExit(f'FAIL: config.json не читается: {e}')
for key in ('slug','name','description','phone','address','hours','boxes','services','cards'):
    if not c.get(key): errors.append(f'не заполнено обязательное поле {key}')
if c.get('slug') != a.slug: errors.append('slug в конфиге не совпадает с именем папки')
if not re.fullmatch(r'[a-z0-9][a-z0-9-]{1,48}',a.slug): errors.append('slug не соответствует URL-формату')
if not isinstance(c.get('services'),list) or not c.get('services'): errors.append('добавьте хотя бы одну услугу')
else:
    ids=set()
    for i,s in enumerate(c['services'],1):
        if not all(s.get(k) for k in ('id','title')): errors.append(f'услуга #{i}: нужны id и title')
        try:
            if int(s.get('price_from',-1))<0 or int(s.get('duration_minutes',0))<15: errors.append(f'услуга #{i}: проверьте цену и длительность')
        except (TypeError,ValueError): errors.append(f'услуга #{i}: цена и длительность должны быть числами')
        if s.get('id') in ids: errors.append(f'повторяется id услуги {s.get("id")}')
        ids.add(s.get('id'))
if not c.get('hero_image'): errors.append('не задано главное фото автомобиля')
if not c.get('gallery'): warnings.append('галерея пока пустая')
valid_days=0
for weekday, item in c.get('hours',{}).items():
    if not isinstance(item,dict): errors.append(f'график для дня {weekday}: ожидался объект'); continue
    if item.get('closed'): continue
    try:
        op=datetime.strptime(item.get('open',''),'%H:%M').time(); cl=datetime.strptime(item.get('close',''),'%H:%M').time()
        if op >= cl: errors.append(f'график для дня {weekday}: закрытие должно быть позже открытия')
        else: valid_days += 1
    except ValueError: errors.append(f'график для дня {weekday}: время должно быть в формате HH:MM')
if valid_days == 0: errors.append('нет ни одного корректного рабочего дня')
if not any(isinstance(b,dict) and b.get('active',True) and b.get('id') for b in c.get('boxes',[])): errors.append('добавьте хотя бы один активный бокс')
if len(c.get('cards',[])) != 3: errors.append('на главной странице должны быть ровно три информационные карточки')
for closed in c.get('closed_dates',[]):
    try: date.fromisoformat(closed)
    except (TypeError,ValueError): errors.append(f'неверная закрытая дата: {closed}')
if errors:
    print('ПРОВЕРКА НЕ ПРОЙДЕНА'); [print(' - '+x) for x in errors]
else: print('ПРОВЕРКА ПРОЙДЕНА: структура настроек корректна')
[print('ПРЕДУПРЕЖДЕНИЕ: '+x) for x in warnings]
print('Публикация:', 'уже опубликована' if c.get('published') else 'черновик — публичная ссылка закрыта')
raise SystemExit(1 if errors else 0)
