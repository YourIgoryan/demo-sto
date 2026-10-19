from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from aiogram import Bot, Dispatcher
from aiogram.filters import Command
from aiogram.types import Message
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
STATE_FILE = BOT_DIR / f".last_booking_{TENANT_SLUG}.txt"
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
    if configured is None:
        await message.answer(
            f"Ваш Telegram ID: {message.chat.id}\n\n"
            "Впишите это число в bot/.env в строку ADMIN_CHAT_ID, сохраните файл и перезапустите бота."
        )
        return False
    if message.chat.id != configured:
        await message.answer("Этот бот настроен для владельца другой студии.")
        return False
    return True


@dp.message(Command("start"))
async def start(message: Message):
    if admin_id() is None:
        await message.answer(
            f"AutoStudio подключается к студии «{config().get('name', TENANT_SLUG)}».\n"
            f"Ваш Telegram ID: {message.chat.id}\n\n"
            "Добавьте этот ID в bot/.env в поле ADMIN_CHAT_ID и перезапустите бота."
        )
        return
    if not await require_admin(message):
        return
    await message.answer(
        f"Бот уведомлений студии «{config().get('name', TENANT_SLUG)}» подключён.\n\n"
        "/today — записи на сегодня\n"
        "/tomorrow — записи на завтра\n"
        "/week — записи за неделю\n"
        "/money — полученные деньги за текущую неделю\n"
        "/test — проверить уведомления\n"
        "/link — ссылка на запись"
    )


@dp.message(Command("help"))
async def help_command(message: Message):
    if not await require_admin(message):
        return
    await message.answer("Команды: /today, /tomorrow, /week, /money, /test, /link")


async def send_period(message: Message, offset_days: int, days: int, title: str):
    if not await require_admin(message):
        return
    now = studio_now()
    start_date = now.date() + timedelta(days=offset_days)
    start = datetime.combine(start_date, datetime.min.time())
    end = start + timedelta(days=days)
    rows = get_bookings(start, end)
    if not rows:
        await message.answer(f"{title}: записей нет.")
        return
    lines = [f"{title} — {len(rows)} записей:"]
    for row in rows[:40]:
        try:
            dt = datetime.fromisoformat(row["start_at"]).strftime("%d.%m %H:%M")
        except Exception:
            dt = row["start_at"]
        lines.append(f"\n• {dt} — {row['service_title']}\n  {row['customer_name']} · {row['car']}\n  {row['phone']} · {row['status']}")
    if len(rows) > 40:
        lines.append(f"\nПоказаны первые 40 из {len(rows)} записей.")
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


@dp.message(Command("link"))
async def link_command(message: Message):
    if not await require_admin(message):
        return
    if not PUBLIC_BASE_URL:
        await message.answer("Укажите публичный HTTPS-адрес в bot/.env в поле PUBLIC_BASE_URL и перезапустите бота.")
        return
    await message.answer(f"Ссылка на запись: {PUBLIC_BASE_URL}/s/{TENANT_SLUG}/")


@dp.message(Command("test"))
async def test_command(message: Message):
    if not await require_admin(message):
        return
    await message.answer(f"Связь с AutoStudio работает. Студия: {config().get('name', TENANT_SLUG)}. База: подключена.")


async def notify_new_bookings(bot: Bot):
    target = admin_id()
    if target is None:
        log.warning("ADMIN_CHAT_ID не задан — уведомления о новых записях отключены")
        return
    # On the first start, record the current maximum to avoid flooding with old demo bookings.
    if not STATE_FILE.exists():
        STATE_FILE.write_text(str(get_max_booking_id()), encoding="utf-8")
    try:
        last_id = int(STATE_FILE.read_text(encoding="utf-8").strip() or "0")
    except (ValueError, OSError):
        last_id = get_max_booking_id()
    while True:
        try:
            with connect() as db:
                rows = db.execute(
                    "SELECT * FROM bookings WHERE tenant=? AND id>? ORDER BY id LIMIT 100",
                    (TENANT_SLUG, last_id),
                ).fetchall()
            for row in rows:
                last_id = int(row["id"])
                STATE_FILE.write_text(str(last_id), encoding="utf-8")
                if row["status"] not in ("cancelled", "rejected"):
                    await bot.send_message(target, booking_text(row))
        except Exception:
            log.exception("Ошибка проверки новых записей")
        await asyncio.sleep(POLL_SECONDS)


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
        await asyncio.gather(dp.start_polling(bot), notify_new_bookings(bot))
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
