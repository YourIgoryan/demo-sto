from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import urllib.request
import urllib.error
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from aiogram import Bot, Dispatcher
from aiogram import F
from aiogram.filters import Command
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message, WebAppInfo
from dotenv import load_dotenv

BOT_DIR = Path(__file__).resolve().parent
ROOT = BOT_DIR.parent
load_dotenv(BOT_DIR / ".env")
# Use the same SQLite database as FastAPI.
sys.path.insert(0, str(ROOT / "backend"))
from app.db import connect  # noqa: E402

TOKEN = os.getenv("BOT_TOKEN", "").strip()
ADMIN_CHAT_ID_RAW = os.getenv("ADMIN_CHAT_ID", "").strip()
TENANT_SLUG = os.getenv("TENANT_SLUG", "sample").strip()
POLL_SECONDS = max(3, int(os.getenv("POLL_SECONDS", "5")))
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "").strip().rstrip("/")
API_BASE_URL = os.getenv("AUTOSTUDIO_API_URL", "https://autostudio-api.onrender.com").strip().rstrip("/")
CONFIG_FILE = ROOT / "tenants" / TENANT_SLUG / "config.json"

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("autostudio-bot")
dp = Dispatcher()


def config() -> dict:
    if not CONFIG_FILE.exists():
        raise RuntimeError(f"Не найден файл настроек студии: {CONFIG_FILE}")
    return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))


def admin_id() -> int | None:
    try:
        return int(ADMIN_CHAT_ID_RAW) if ADMIN_CHAT_ID_RAW else None
    except ValueError:
        return None


def studio_now() -> datetime:
    try:
        return datetime.now(ZoneInfo(config().get("timezone", "Europe/Moscow")))
    except Exception:
        return datetime.now()


def money(value: int) -> str:
    return f"{value:,}".replace(",", " ") + " ₽"


def booking_text(row) -> str:
    try:
        starts = datetime.fromisoformat(row["start_at"]).strftime("%d.%m.%Y в %H:%M")
    except Exception:
        starts = row["start_at"]
    return (
        f"Новая запись #{row['id']}\n"
        f"Дата: {starts}\n"
        f"Услуга: {row['service_title']}\n"
        f"Клиент: {row['customer_name']}\n"
        f"Телефон: {row['phone']}\n"
        f"Автомобиль: {row['car']}\n"
        f"Статус: {row['status']}"
    )


def get_max_booking_id() -> int:
    with connect() as db:
        row = db.execute("SELECT COALESCE(MAX(id), 0) n FROM bookings WHERE tenant=?", (TENANT_SLUG,)).fetchone()
        return int(row["n"])


def get_bookings(start: datetime, end: datetime):
    with connect() as db:
        return db.execute(
            "SELECT id,start_at,end_at,service_title,customer_name,phone,car,status FROM bookings "
            "WHERE tenant=? AND start_at>=? AND start_at<? AND status NOT IN ('cancelled','rejected') ORDER BY start_at",
            (TENANT_SLUG, start.replace(tzinfo=None).isoformat(), end.replace(tzinfo=None).isoformat()),
        ).fetchall()


def money_for_period(start: datetime, end: datetime) -> int:
    with connect() as db:
        row = db.execute(
            "SELECT COALESCE(SUM(CASE WHEN kind='payment' THEN amount ELSE -amount END),0) amount "
            "FROM payments WHERE tenant=? AND created_at>=? AND created_at<?",
            (TENANT_SLUG, start.replace(tzinfo=None).isoformat(), end.replace(tzinfo=None).isoformat()),
        ).fetchone()
        return int(row["amount"])


async def require_admin(message: Message) -> bool:
    configured = admin_id()
    actor_id = message.from_user.id if message.from_user else None
    if configured is None:
        log.error("ADMIN_CHAT_ID не настроен: команда владельца заблокирована")
        await message.answer("Меню владельца временно недоступно: владелец не настроен.")
        return False
    if actor_id != configured or message.chat.type != "private":
        await message.answer("Команда доступна только владельцу в личном чате с ботом.")
        return False
    return True


def app_url(source: str = "start") -> str:
    if not PUBLIC_BASE_URL:
        return ""
    return f"{PUBLIC_BASE_URL}/s/{TENANT_SLUG}/?utm_source=telegram&utm_medium=bot&utm_campaign={source}"


def client_keyboard() -> InlineKeyboardMarkup:
    url = app_url()
    buttons = []
    if url.startswith("https://"):
        buttons.append([InlineKeyboardButton(text="Записаться онлайн", web_app=WebAppInfo(url=url))])
        buttons.append([InlineKeyboardButton(text="Открыть страницу студии", url=url)])
    else:
        buttons.append([InlineKeyboardButton(text="Услуги и запись", callback_data="client:services")])
    buttons.append([
        InlineKeyboardButton(text="Услуги", callback_data="client:services"),
        InlineKeyboardButton(text="Контакты", callback_data="client:contacts"),
    ])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def owner_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Сегодня", callback_data="owner:today"), InlineKeyboardButton(text="Завтра", callback_data="owner:tomorrow")],
        [InlineKeyboardButton(text="Неделя", callback_data="owner:week"), InlineKeyboardButton(text="Выручка", callback_data="owner:money")],
        [InlineKeyboardButton(text="Аналитика", callback_data="owner:analytics"), InlineKeyboardButton(text="Ссылка для клиента", callback_data="owner:link")],
    ])

@dp.message(Command("start"))
async def start(message: Message):
    cfg = config()
    name = cfg.get("name", TENANT_SLUG)
    if message.from_user and message.from_user.id == admin_id() and message.chat.type == "private":
        await message.answer(f"Панель владельца «{name}». Команды и отчёты доступны только этому аккаунту.", reply_markup=owner_keyboard())
        return
    text = f"Добро пожаловать в «{name}»!\n\nЗдесь можно посмотреть услуги и записаться онлайн. Выберите действие ниже."
    url = app_url()
    if not url.startswith("https://"):
        text += "\n\nОнлайн-запись временно недоступна. Свяжитесь со студией для записи."
    await message.answer(text, reply_markup=client_keyboard())


@dp.callback_query(F.data == "client:services")
async def client_services(callback: CallbackQuery):
    cfg = config()
    services = [s for s in cfg.get("services", []) if s.get("active", True)]
    if not services:
        text = "Список услуг пока не опубликован. Напишите или позвоните в студию для уточнения."
    else:
        lines = [f"Услуги студии «{cfg.get('name', TENANT_SLUG)}»:"]
        for service in services[:20]:
            title = str(service.get("title", "Услуга"))
            price = service.get("price_from")
            duration = service.get("duration_minutes")
            details = []
            if isinstance(price, (int, float)) and price > 0:
                details.append(f"от {money(int(price))}")
            if isinstance(duration, (int, float)) and duration > 0:
                hours, minutes = divmod(int(duration), 60)
                duration_text = (f"{hours} ч" if hours else "") + (f" {minutes} мин" if minutes else "")
                details.append(duration_text.strip())
            suffix = f" — {' · '.join(details)}" if details else ""
            description = str(service.get("description", "")).strip()
            lines.append(f"\n• {title}{suffix}" + (f"\n  {description}" if description else ""))
        text = "\n".join(lines)
    await callback.message.answer(text, reply_markup=client_keyboard())
    await callback.answer()


@dp.callback_query(F.data == "client:contacts")
async def client_contacts(callback: CallbackQuery):
    cfg = config()
    lines = [f"Контакты «{cfg.get('name', TENANT_SLUG)}»"]
    phone = str(cfg.get("phone", "")).strip()
    address = str(cfg.get("address", "")).strip()
    if phone:
        lines.append(f"Телефон: {phone}")
    if address:
        lines.append(f"Адрес: {address}")
    if not phone and not address:
        lines.append("Контактные данные пока не указаны. Уточните информацию у владельца студии.")
    await callback.message.answer("\n".join(lines), reply_markup=client_keyboard())
    await callback.answer()


@dp.message(Command("help"))
async def help_command(message: Message):
    if message.from_user and message.from_user.id == admin_id() and message.chat.type == "private":
        await message.answer("Команды владельца: /today, /tomorrow, /week, /money, /analytics, /test, /link. Все команды проверяют доступ.", reply_markup=owner_keyboard())
        return
    await message.answer("Помощь AutoStudio\n\nНажмите «Записаться онлайн», чтобы выбрать услугу и свободное время. Услуги и контакты доступны в меню /start.", reply_markup=client_keyboard())


async def send_period(message: Message, day_offset: int, days: int, title: str):
    if not await require_admin(message):
        return
    start_day = studio_now().date() + timedelta(days=day_offset)
    start = datetime.combine(start_day, datetime.min.time())
    rows = get_bookings(start, start + timedelta(days=days))
    if not rows:
        await message.answer(f"{title}: записей нет.")
        return
    lines = [f"{title}: {len(rows)} записей"]
    for row in rows[:40]:
        try: when = datetime.fromisoformat(row["start_at"]).strftime("%H:%M")
        except Exception: when = str(row["start_at"])
        lines.append(f"\n#{row['id']} · {when} · {row['service_title']}\n{row['customer_name']} · {row['phone']} · {row['car']}\nСтатус: {row['status']}")
    await message.answer("\n".join(lines))

@dp.message(Command("today"))
async def today(message: Message):
    await send_period(message, 0, 1, "Сегодня")

@dp.message(Command("tomorrow"))
async def tomorrow(message: Message):
    await send_period(message, 1, 1, "Завтра")


@dp.message(Command("week"))
async def week(message: Message):
    if not await require_admin(message):
        return
    now = studio_now()
    start_date = now.date() - timedelta(days=now.weekday())
    start = datetime.combine(start_date, datetime.min.time())
    end = start + timedelta(days=7)
    rows = get_bookings(start, end)
    done = sum(1 for row in rows if row["status"] == "completed")
    await message.answer(f"Записи на текущей неделе: {len(rows)}\nЗавершённых среди них: {done}")


@dp.message(Command("money"))
async def money_command(message: Message):
    if not await require_admin(message):
        return
    now = studio_now()
    start = datetime.combine(now.date() - timedelta(days=now.weekday()), datetime.min.time())
    end = start + timedelta(days=7)
    await message.answer(f"Фактически получено за текущую неделю (с учётом возвратов): {money(money_for_period(start, end))}")


@dp.message(Command("analytics"))
async def analytics_command(message: Message):
    if not await require_admin(message): return
    start = datetime.combine(studio_now().date().replace(day=1), datetime.min.time()).isoformat()
    end = (studio_now().date() + timedelta(days=1)).isoformat()
    with connect() as db:
        rows = db.execute("SELECT source,medium,campaign,COUNT(*) bookings,SUM(CASE WHEN LOWER(status) IN ('cancelled','canceled','отменена','отменено','отменён','отменен') THEN 1 ELSE 0 END) cancellations FROM bookings WHERE tenant=? AND created_at>=? AND created_at<? GROUP BY source,medium,campaign ORDER BY bookings DESC", (TENANT_SLUG,start,end)).fetchall()
        visits = db.execute("SELECT source,medium,campaign,COUNT(*) visits FROM analytics_events WHERE tenant=? AND event_type='visit' AND created_at>=? AND created_at<? GROUP BY source,medium,campaign", (TENANT_SLUG,start,end)).fetchall()
        revenue = db.execute("SELECT b.source,b.medium,b.campaign,COALESCE(SUM(CASE WHEN p.kind='payment' THEN p.amount ELSE -p.amount END),0) revenue FROM bookings b JOIN payments p ON p.booking_id=b.id AND p.tenant=b.tenant WHERE b.tenant=? AND p.created_at>=? AND p.created_at<? GROUP BY b.source,b.medium,b.campaign", (TENANT_SLUG,start,end)).fetchall()
    data = {}
    for r in rows: data[(r['source'],r['medium'],r['campaign'])] = {'bookings':int(r['bookings'] or 0),'cancellations':int(r['cancellations'] or 0),'visits':0,'revenue':0}
    for r in visits: data.setdefault((r['source'],r['medium'],r['campaign']),{'bookings':0,'cancellations':0,'visits':0,'revenue':0})['visits'] += int(r['visits'] or 0)
    for r in revenue: data.setdefault((r['source'],r['medium'],r['campaign']),{'bookings':0,'cancellations':0,'visits':0,'revenue':0})['revenue'] += int(r['revenue'] or 0)
    lines=["Аналитика с начала месяца:"]
    if not data: lines.append("Пока нет данных по каналам.")
    for (source,medium,campaign),v in sorted(data.items(),key=lambda x:x[1]['bookings'],reverse=True)[:20]:
        conv=(100*v['bookings']/v['visits']) if v['visits'] else 0
        lines.append(f"\n{source} / {medium or '—'} / {campaign or '—'}\nПереходы: {v['visits']} · записи: {v['bookings']} · отмены: {v['cancellations']}\nКонверсия: {conv:.1f}% · выручка: {money(v['revenue'])}")
    await message.answer("\n".join(lines))

@dp.message(Command("link"))
async def link_command(message: Message):
    if not await require_admin(message):
        return
    if not PUBLIC_BASE_URL:
        await message.answer("Укажите публичный HTTPS-адрес в bot/.env в поле PUBLIC_BASE_URL и перезапустите бота.")
        return
    await message.answer(f"Ссылка на запись: {app_url()}", reply_markup=client_keyboard())


@dp.message(Command("test"))
async def test_command(message: Message):
    if not await require_admin(message):
        return
    await message.answer(f"Связь с AutoStudio работает. Студия: {config().get('name', TENANT_SLUG)}. База: подключена.")


async def process_outbox(bot: Bot):
    """Durable outbox: unique event keys prevent duplicates; failed deliveries are retried."""
    while True:
        try:
            now = datetime.now().replace(microsecond=0).isoformat()
            with connect() as db:
                rows = db.execute("SELECT * FROM notification_outbox WHERE tenant=? AND status='pending' AND next_attempt_at<=? ORDER BY id LIMIT 30", (TENANT_SLUG, now)).fetchall()
            for row in rows:
                target = admin_id() if row['recipient_type'] == 'owner' else int(row['recipient_id'] or 0)
                if not target:
                    log.error("Невозможно доставить событие %s: адресат не настроен", row['event_key'])
                    with connect() as db:
                        db.execute("UPDATE notification_outbox SET attempts=attempts+1,next_attempt_at=?,last_error=? WHERE id=?", ((datetime.now()+timedelta(minutes=10)).replace(microsecond=0).isoformat(), "recipient is not configured", row['id']))
                    continue
                try:
                    await bot.send_message(target, row['message'])
                    with connect() as db:
                        db.execute("UPDATE notification_outbox SET status='sent',sent_at=?,last_error='' WHERE id=?", (datetime.now().replace(microsecond=0).isoformat(), row['id']))
                    log.info("Уведомление доставлено: %s", row['event_key'])
                except Exception as exc:
                    attempts = int(row['attempts']) + 1
                    delay = min(3600, 15 * (2 ** min(attempts, 8)))
                    next_try = (datetime.now()+timedelta(seconds=delay)).replace(microsecond=0).isoformat()
                    with connect() as db:
                        db.execute("UPDATE notification_outbox SET attempts=?,next_attempt_at=?,last_error=? WHERE id=?", (attempts,next_try,str(exc)[:1000],row['id']))
                    log.exception("Ошибка отправки %s; повтор через %s сек.", row['event_key'], delay)
        except Exception:
            log.exception("Ошибка обработки очереди уведомлений")
        await asyncio.sleep(POLL_SECONDS)

async def schedule_client_reminders():
    """Queue a single customer reminder due 24 hours before each upcoming visit."""
    while True:
        try:
            now = studio_now().replace(tzinfo=None, microsecond=0)
            horizon = (now + timedelta(hours=25)).isoformat()
            with connect() as db:
                rows = db.execute("SELECT id,public_id,start_at,service_title,customer_name,telegram_user_id FROM bookings WHERE tenant=? AND telegram_user_id IS NOT NULL AND telegram_user_id<>'' AND LOWER(status) NOT IN ('cancelled','canceled','rejected','отменена','отклонена') AND start_at>? AND start_at<=? ORDER BY start_at LIMIT 100", (TENANT_SLUG, now.isoformat(), horizon)).fetchall()
                for row in rows:
                    try:
                        visit_at = datetime.fromisoformat(str(row['start_at'])).replace(tzinfo=None)
                    except ValueError:
                        continue
                    studio_tz = ZoneInfo(config().get("timezone", "Europe/Moscow"))
                    due_local = (visit_at.replace(tzinfo=studio_tz) - timedelta(hours=24))
                    due = due_local.astimezone(ZoneInfo("UTC")).replace(tzinfo=None, microsecond=0).isoformat()
                    text = f"Напоминание о визите в «{config().get('name', TENANT_SLUG)}»\nДата: {visit_at.strftime('%d.%m.%Y в %H:%M')}\nУслуга: {row['service_title']}\nДо встречи!"
                    db.execute("INSERT INTO notification_outbox(tenant,event_key,recipient_type,recipient_id,message,status,attempts,next_attempt_at,created_at) VALUES(?,?, 'client', ?, ?, 'pending',0,?,?) ON CONFLICT(event_key) DO NOTHING", (TENANT_SLUG, f"booking:reminder24:{row['public_id']}", str(row['telegram_user_id']), text, due, now.isoformat()))
        except Exception:
            log.exception("Ошибка планирования напоминаний клиентам")
        await asyncio.sleep(60)

async def monitor_backend(bot: Bot):
    """Log availability transitions and alert the owner once per transition."""
    previous = None
    while True:
        try:
            def check():
                with urllib.request.urlopen(API_BASE_URL + "/api/health", timeout=8) as response:
                    return response.status == 200
            healthy = await asyncio.to_thread(check)
            state = "up" if healthy else "down"
        except Exception as exc:
            state = "down"
            log.warning("Backend недоступен: %s", exc)
        if state != previous:
            log.info("Backend status changed: %s", state)
            target = admin_id()
            if target and previous is not None:
                try:
                    await bot.send_message(target, "Backend AutoStudio снова доступен." if state == "up" else "ВНИМАНИЕ: backend AutoStudio недоступен. Бот продолжает повторные проверки.")
                except Exception:
                    log.exception("Не удалось отправить уведомление о состоянии backend")
            previous = state
        await asyncio.sleep(60)

@dp.callback_query(F.data.startswith("owner:"))
async def owner_menu_callback(callback: CallbackQuery):
    if not callback.from_user or callback.from_user.id != admin_id() or not callback.message or callback.message.chat.type != "private":
        await callback.answer("Нет доступа", show_alert=True)
        return
    action = callback.data.split(":",1)[1]
    await callback.answer()
    if action in ("today", "tomorrow", "week"):
        offset = 0 if action == "today" else 1 if action == "tomorrow" else 0
        if action == "week":
            start_day = studio_now().date() - timedelta(days=studio_now().date().weekday())
            days, title = 7, "Текущая неделя"
        else:
            start_day = studio_now().date() + timedelta(days=offset)
            days, title = 1, "Сегодня" if offset == 0 else "Завтра"
        start = datetime.combine(start_day, datetime.min.time())
        rows = get_bookings(start, start + timedelta(days=days))
        if not rows:
            await callback.message.answer(f"{title}: записей нет.")
        else:
            lines = [f"{title}: {len(rows)} записей"]
            for row in rows[:40]:
                try: when = datetime.fromisoformat(row["start_at"]).strftime("%d.%m %H:%M")
                except Exception: when = str(row["start_at"])
                lines.append(f"\n#{row['id']} · {when} · {row['service_title']}\n{row['customer_name']} · {row['phone']} · {row['car']}\nСтатус: {row['status']}")
            await callback.message.answer("\n".join(lines))
    elif action == "money":
        now = studio_now(); start = datetime.combine(now.date()-timedelta(days=now.weekday()),datetime.min.time()); end = start+timedelta(days=7)
        await callback.message.answer(f"Фактически получено за текущую неделю: {money(money_for_period(start,end))}")
    elif action == "analytics":
        await callback.message.answer("Для подробной аналитики используйте команду /analytics.")
    elif action == "link":
        await callback.message.answer(f"Ссылка для клиентов: {app_url()}", reply_markup=client_keyboard())


async def main():
    if not TOKEN or TOKEN == "paste-token-here":
        raise SystemExit("Укажите BOT_TOKEN в файле bot/.env (токен выдаёт @BotFather).")
    cfg = config()
    if cfg.get("slug") != TENANT_SLUG:
        raise SystemExit("TENANT_SLUG не совпадает со slug в tenants/<slug>/config.json")
    bot = Bot(TOKEN)
    try:
        me = await bot.get_me()
        log.info("Бот запущен: @%s; студия=%s", me.username, TENANT_SLUG)
        await asyncio.gather(dp.start_polling(bot), process_outbox(bot), schedule_client_reminders(), monitor_backend(bot))
    finally:
        await bot.session.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        raise
    except Exception:
        log.exception("Бот завершился с ошибкой")
        raise
