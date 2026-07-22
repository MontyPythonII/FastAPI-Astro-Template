# FastAPI + Astro Template

A production-shaped starter for a **FastAPI** API behind an **Astro SSR**
frontend, wired together with Docker Compose. Authentication, session handling,
user management, and public access are done — clone it and start building the
part that is actually yours.

The defining choice: **the API is never published to the browser.** Astro runs
server-side as a backend-for-frontend, so the only thing on the public internet
is the Astro server.

---

## What you get

| | |
| :--- | :--- |
| **Auth** | Register, login, logout, JWT sessions (fastapi-users) |
| **Users** | View/edit your own profile; superusers manage any account |
| **Sessions** | httpOnly cookie — no token in client JS, no CORS to configure |
| **Route guards** | Central Astro middleware; protected and superuser-only paths |
| **Admin seeding** | First superuser created from env vars on boot |
| **Containers** | Multi-stage builds, unprivileged users, healthchecks, pinned toolchains |
| **Public access** | Optional Cloudflare tunnel — no router ports opened |

---

## Stack

| Layer | Choice | Notes |
| :--- | :--- | :--- |
| API | FastAPI + uvicorn | Python 3.13, dependencies via [uv](https://docs.astral.sh/uv/) |
| Auth | fastapi-users | JWT bearer, 2-day lifetime |
| Data | SQLAlchemy async + SQLite | `aiosqlite`; swap the URL for Postgres |
| Web | Astro SSR | `@astrojs/node` standalone adapter, Node 22 |
| Styling | Plain CSS | Design tokens in `global.css`, no framework |
| Orchestration | Docker Compose | Plus an optional `cloudflared` profile |

---

## Architecture

```
                    ┌─────────────────────────────────────────┐
   browser ────────►│  frontend  (Astro SSR)      :7071        │
   (only public     │                                          │
    surface)        │  • pages render on the server            │
                    │  • /api/* routes proxy form posts        │
                    │  • sets httpOnly cookie holding the JWT  │
                    └──────────────────┬───────────────────────┘
                                       │  fetch + Bearer token
                                       │  (internal network only)
                    ┌──────────────────▼───────────────────────┐
                    │  backend  (FastAPI)         :7070        │
                    │  • /auth/*  /users/*  /health            │
                    └──────────────────┬───────────────────────┘
                                       │
                              db-data volume (SQLite)
```

The browser never holds a token and never sees the API. A page request carries
the session cookie to Astro; Astro reads the JWT out of it server-side and calls
the backend on the internal Compose network.

---

## Quick start

```bash
cp .env.example .env
openssl rand -hex 32          # paste the result into AUTH_SECRET
docker compose up -d --build
```

Then open **http://localhost:7071** and log in with the `FIRST_SUPERUSER`
credentials from your `.env`.

Compose refuses to start if `AUTH_SECRET` is unset, so the API can never come up
signing tokens with the development fallback.

```bash
docker compose logs -f          # follow both services
docker compose down             # stop (the database volume survives)
docker compose down -v          # stop and delete the database
```

---

## Environment

Everything lives in `.env` (gitignored). `.env.example` is the template.

| Variable | Required | Default | Purpose |
| :--- | :---: | :--- | :--- |
| `AUTH_SECRET` | **yes** | — | Signs every JWT and reset/verify token. Rotate it and all sessions die. |
| `WEB_PORT` | no | `8080` | Host port the site is published on |
| `COMPOSE_PROJECT_NAME` | no | — | Prefixes containers, the volume, and the SQLite filename |
| `ENVIRONMENT` | no | `local` | `production` turns on the cookie `Secure` flag |
| `FIRST_SUPERUSER` | no | blank | Admin email, ensured on every boot |
| `FIRST_SUPERUSER_PASSWORD` | no | blank | Admin password, used only when creating the account |
| `TUNNEL_TOKEN` | no | blank | Cloudflare tunnel token (see below) |

Notes worth knowing:

- **Superuser seeding is idempotent.** Missing account → created. Existing
  account → promoted to superuser, password left alone. Both variables blank →
  seeding is skipped entirely rather than creating a passwordless admin.
- **`ENVIRONMENT=production` is required for HTTPS deployments.** Without it the
  session cookie is sent without `Secure`.
- `SERVER_PORT` only affects `python main.py` during local development; the
  container always binds 7070.

---

## Local development (no Docker)

Two terminals. The Astro dev server falls back to `http://localhost:7070` when
`BACKEND_BASE_URL` is unset, so nothing needs configuring.

```bash
# terminal 1 — API with autoreload, docs at http://localhost:7070/docs
cd backend
uv sync
uv run main.py
```

```bash
# terminal 2 — site at http://localhost:7071
cd frontend
npm install
npm run dev
```

This writes a local `backend/test.db` (gitignored) rather than touching the
Docker volume.

---

## Layout

```text
.
├── docker-compose.yml     # backend + frontend + optional cloudflared
├── .env.example           # copy to .env
├── backend/               # FastAPI service      — see backend/README.md
│   ├── app/
│   │   ├── api/           # routers, auth wiring, schemas, superuser seeding
│   │   ├── core/          # database, models, cache helper
│   │   └── app.py         # app factory, lifespan, /health
│   └── main.py            # dev entrypoint (uvicorn --reload)
└── frontend/              # Astro SSR service    — see frontend/README.md
    └── src/
        ├── lib/           # typed backend client + session cookie helpers
        ├── middleware.ts  # resolves the user, guards routes
        └── pages/         # SSR pages and /api/* form endpoints
```

---

## Going public

`cloudflared` is included behind a Compose profile, so the everyday
`docker compose up` ignores it until you have a token.

1. Create a tunnel in the Cloudflare Zero Trust dashboard and copy its token
   into `TUNNEL_TOKEN` in `.env`.
2. Point the public hostname at `http://frontend:7071`.
3. Set `ENVIRONMENT=production` so the session cookie gets its `Secure` flag.

```bash
docker compose --profile tunnel up -d
```

The API stays unreachable from outside either way — it is `expose`d on the
Compose network, never published to the host.

---

## Making it yours

**Rename the project.** Set `COMPOSE_PROJECT_NAME` in `.env`; container, volume,
and database filenames follow it.

**Add your own API routes.** Drop a module under `backend/app/api/routes/` and
include it in `app/api/router.py`. Guard it with the dependencies already
defined in `app/api/users.py`:

```python
from fastapi import Depends
from app.api.users import currentActiveUser, currentSuperuser

@router.get("/things", dependencies=[Depends(currentActiveUser)])
async def listThings() -> list[dict] :
    ...
```

**Call them from the frontend.** Add a function to `frontend/src/lib/backend.ts`
— it is the only module that knows the wire format or the backend URL.

**Move off SQLite.** Change `DATABASE_URL` in `backend/app/core/db.py` to a
`postgresql+asyncpg://` URL, add the driver to `pyproject.toml`, and add a
Postgres service to Compose. Nothing else in the codebase assumes SQLite.

---

## Security notes

The defaults are deliberate — read these before deploying:

- `AUTH_SECRET` in `.env.example` is the literal string `SECRET`. **Replace it.**
  Anyone holding it can forge a login as any user.
- Change `FIRST_SUPERUSER_PASSWORD` from `changethis` before the first boot; the
  seeder never rewrites an existing account's password.
- `.env` and `*.db` are gitignored. Keep it that way — the database holds
  password hashes.
- Registration is open to anyone. To make accounts invitation-only, uncomment
  the `dependencies=[Depends(currentSuperuser)]` line on the register router in
  `backend/app/api/router.py`.
- Password reset and email verification endpoints exist but send nothing — wire
  up an email provider in `UserManager` before relying on them.
