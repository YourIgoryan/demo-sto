# AutoStudio — multi-tenant booking app for auto service / detailing

A separate React + TypeScript + Vite PWA frontend and FastAPI + SQLite backend. Tenant-specific public pages use `/s/<slug>/`; owner cabinets use `/owner/<slug>/`. Each tenant's editable public settings live in exactly one `tenants/<slug>/config.json`, and uploaded photos are stored in that tenant's `media/` folder.

## Start locally (Windows)

1. Install Python 3.11+ and Node.js 20+.
2. Run `run_local.bat`.
3. Open:
   - Public sample: `http://127.0.0.1:5173/s/sample/`
   - Owner cabin: `http://127.0.0.1:5173/owner/sample/`
   - API docs: `http://127.0.0.1:8000/docs`
4. Demo owner login: `owner@sample.local` / `SampleOwner2026!`.

The demo login is for local testing only. Before exposing the project publicly, change it, set a strong `AUTOSTUDIO_SECRET`, configure HTTPS, and use a production ASGI deployment. The application has not been deployed to a public domain from this workspace.

## New studio workflow

Run from the project root (PowerShell or CMD):

```powershell
backend\.venv\Scripts\python.exe scripts\create_tenant.py detail-north --name "Detail North" --email owner@detail-north.ru
backend\.venv\Scripts\python.exe scripts\check_tenant.py detail-north
```

If no `--password` is passed, the script prints a generated temporary password. Edit `tenants/detail-north/config.json` with the studio's phone, address, schedule, service prices/durations, box count, images, cards, cancellation rules, and other details. Put local images into `tenants/detail-north/media/` and reference them as `/tenants/detail-north/media/filename.jpg`. Then run:

```powershell
backend\.venv\Scripts\python.exe scripts\check_tenant.py detail-north
backend\.venv\Scripts\python.exe scripts\publish_tenant.py detail-north
backend\.venv\Scripts\python.exe scripts\check_link.py detail-north --base-url https://your-domain.example
```

The public page will be available at `/s/detail-north/`, and the owner cabinet at `/owner/detail-north/`. To hide a published page again:

```powershell
backend\.venv\Scripts\python.exe scripts\publish_tenant.py detail-north --unpublish
```

New tenants start with `published: false`, so their public URLs return 404 until checked and published. The `sample` tenant is intentionally published as a demo.


## Public HTTPS deployment with Docker + Caddy

For a VPS with Docker Compose, point the domain's DNS A/AAAA records to the server, open ports 80 and 443, copy `.env.example` to `.env`, set `DOMAIN` to the real domain and replace `AUTOSTUDIO_SECRET` with a long random value. Then run:

```powershell
copy .env.example .env
# Edit .env before continuing
docker compose up --build -d
docker compose exec autostudio python scripts/create_tenant.py detail-north --name "Detail North" --email owner@detail-north.ru
```

Edit the tenant config in `tenants/detail-north/config.json` on the server or via the owner cabinet, then check and publish it:

```powershell
docker compose exec autostudio python scripts/check_tenant.py detail-north
docker compose exec autostudio python scripts/publish_tenant.py detail-north
docker compose exec autostudio python scripts/check_link.py detail-north --base-url https://your-domain.example
```

Caddy obtains and renews HTTPS certificates automatically when DNS and ports are configured correctly. Replace `your-domain.example` with the domain set in `.env`. Do not expose the demo `sample` owner account publicly; use `create_tenant.py` to create a studio-specific owner.

## What is implemented

- Responsive public studio page with hero photo, services/prices/durations, portfolio gallery, three editable info cards, address, map link, schedule, phone and booking entry points.
- Mobile glass-effect bottom navigation, photo-attached glass booking button, reveal-on-scroll animation respecting `prefers-reduced-motion`.
- Service/date/time selection; slots are generated from the tenant's working hours, closures, active boxes, service duration, prep buffer, and overlapping bookings. Multi-day services block the box for their full interval.
- Server-side atomic booking transaction (`BEGIN IMMEDIATE`), interval conflict check and tenant-scoped idempotency key. A conflicting concurrent booking gets HTTP 409. The frontend keeps an idempotency key for the selected booking attempt and reuses it on retry.
- Customer booking detail saved locally on the device, cancellation rules enforced server-side, and downloadable `.ics` calendar event. Browser notification reminders can be scheduled while the page remains open; for dependable reminders after closing the page, add the event to the device calendar.
- Owner login with password hash and signed expiring token; tenant-scoped server authorization; daily/weekly appointment dashboard; status updates; manual booking creation; payment/refund ledger; service/schedule/box/contact/card editing; photo upload/replacement and individual gallery captions.
- Client assistant reads tenant-specific prices/address/live availability through server functions. Owner assistant answers basic questions from the tenant's booking/payment database. Both have simple in-memory rate limits and do not have free-form database access.
- Tenant-specific manifest, generated PNG/SVG app icons, PWA shell and service worker.

## Tests

Install the test extras with `backend\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt`, run `scripts\init_sample.py`, then execute `backend\.venv\Scripts\python.exe -m unittest discover -s backend/tests -v`. The tests cover public configuration, availability, idempotent booking, overlap rejection, and owner tenant isolation.

## Important implementation notes / production checklist

- SQLite is suitable for the MVP and local experiment. For a larger deployment, move to PostgreSQL and use a transactional exclusion constraint/locking strategy for interval overlap. Keep all tenant ownership checks on the server.
- The assistant works without a model key using verified rule-based answers. For local model testing, copy `.env.example` to `.env` and set `OPENAI_API_KEY`; `python-dotenv` loads it on the backend only. An optional server-side OpenAI-compatible chat completion can be enabled with `OPENAI_API_KEY`, `OPENAI_MODEL`, and `OPENAI_MAX_REQUESTS_PER_DAY`; the key is never sent to the browser. Before calling the model, the backend prepares a limited set of authorized facts; the request is capped at 280 output tokens and a configurable daily request limit. The owner assistant has read-only facts and no mutation tools. The in-memory daily counter resets if the process restarts; use a shared persistent limiter for a multi-worker production deployment.
- The rate limiter is process-local. For multiple worker processes, use a shared limiter (e.g. Redis). Set `AUTOSTUDIO_SECRET` to a strong random secret in the environment. Do not commit secrets or real client data.
- Photo upload validates MIME type and limits each file to 8 MB. For production, also inspect file signatures, resize images, and store them in object storage/CDN.
- To serve publicly, deploy backend and frontend behind one HTTPS domain with a reverse proxy; route `/api/*` and `/tenants/*` to FastAPI and serve the Vite build for the rest, preserving SPA fallback for `/s/*` and `/owner/*`. Update proxy settings if frontend and backend use different hosts.
- The owner interface uses prompt-based dialogs for manual booking and payment amounts in this MVP. The server endpoints are structured so these can be replaced with richer forms without changing booking logic.
- PWA installation and standalone mode require HTTPS outside localhost. Browser support and install prompts vary by device/browser.

## Data layout

```text
autostudio/
  backend/app/          FastAPI routes, SQLite, password/token helpers
  frontend/src/         React UI and responsive styling
  frontend/public/sw.js PWA service worker
  tenants/sample/
    config.json        sample tenant configuration
    media/             uploaded tenant photos
  data/autostudio.db   owners, bookings, payment/refund ledger
  scripts/              create, validate, publish, seed commands
```

The database contains bookings, owners and payment records. Business identity/content settings remain in each tenant's single `config.json`.
