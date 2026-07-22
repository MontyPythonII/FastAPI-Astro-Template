# Backend — FastAPI

The API half of the template: authentication, JWT sessions, and user management
built on [fastapi-users](https://fastapi-users.github.io/fastapi-users/), with
async SQLAlchemy over SQLite.

It is designed to sit behind the Astro frontend on a private network — in
`docker-compose.yml` it is `expose`d, never published to the host. Nothing here
depends on that, though; the service is a perfectly ordinary FastAPI app if you
want to point something else at it.

## Running it

```bash
uv sync
uv run main.py          # http://localhost:7070 — autoreload on
```

Interactive docs are at `/docs`, generated from the routers below. In
production the container skips `main.py` entirely and runs uvicorn directly with
no reloader:

```bash
uvicorn app.app:app --host 0.0.0.0 --port 7070
```

## Endpoints

All of these come from fastapi-users routers assembled in `app/api/router.py`.

| Method | Path | Auth | Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | — | Create an account |
| `POST` | `/auth/jwt/login` | — | Exchange credentials for a JWT (form-encoded, email field is named `username`) |
| `POST` | `/auth/jwt/logout` | bearer | Invalidate the session |
| `POST` | `/auth/forgot-password` | — | Issue a reset token |
| `POST` | `/auth/reset-password` | — | Consume a reset token |
| `POST` | `/auth/request-verify-token` | — | Issue a verification token |
| `POST` | `/auth/verify` | — | Consume a verification token |
| `GET` `PATCH` | `/users/me` | bearer | Read or update the current user |
| `GET` `PATCH` `DELETE` | `/users/{id}` | superuser | Manage another account |
| `GET` | `/health` | — | Liveness probe for the container healthcheck |

The reset and verify routes mint tokens but send nothing — see
[Sending email](#sending-email).

## Layout

```text
main.py                 # dev entrypoint: uvicorn with reload
app/
├── app.py              # FastAPI instance, lifespan, /health
├── api/
│   ├── router.py       # mounts every fastapi-users router
│   ├── users.py        # UserManager, JWT strategy, auth dependencies
│   ├── schemas.py      # UserRead / UserCreate / UserUpdate
│   └── bootstrap.py    # seeds the first superuser at startup
└── core/
    ├── db.py           # async engine, session factory, table creation
    ├── models.py       # SQLAlchemy Base and User
    └── cache.py        # small TTL cache helper (unused — yours to use)
```

## How startup works

`app.py` defines a lifespan that runs two things in order, both idempotent:

1. **`createDbAndTables()`** — `Base.metadata.create_all`, so a fresh volume
   gets its schema on first boot.
2. **`createFirstSuperuser()`** — seeds the admin account from
   `FIRST_SUPERUSER` / `FIRST_SUPERUSER_PASSWORD`.

The seeder is deliberately conservative. A missing account is created; an
existing one is promoted to superuser but its **password is never rewritten** —
silently rotating it on every restart would be a nasty surprise. Leave both
variables blank and seeding is skipped entirely, which is what local development
does.

Because table creation happens at startup there is no migration tool here. Once
your schema starts changing under real data, add Alembic.

## Environment

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `AUTH_SECRET` | `SECRET` | Signs JWTs and reset/verify tokens. **Always override.** |
| `AUTH_DB_PATH` | `./test.db` | SQLite file path. Compose points this at the `db-data` volume. |
| `SERVER_PORT` | `7070` | Port for `main.py` only; the container always binds 7070. |
| `FIRST_SUPERUSER` | blank | Admin email, ensured on every boot |
| `FIRST_SUPERUSER_PASSWORD` | blank | Admin password, used only on creation |

The `AUTH_DB_PATH` fallback means running locally drops a `test.db` next to the
source. It is gitignored, but it does contain password hashes — delete it rather
than copying it around.

## Extending

### Adding fields to the user

`User` inherits everything from `SQLAlchemyBaseUserTableUUID` (id, email,
hashed_password, is_active, is_superuser, is_verified). Add your own columns in
`core/models.py` and expose them through the schemas:

```python
class User(SQLAlchemyBaseUserTableUUID, Base) :
    displayName : Mapped[str] = mapped_column(String(64), default="")
```

```python
class UserRead(schemas.BaseUser[uuid.UUID]) :
    displayName : str

class UserUpdate(schemas.BaseUserUpdate) :
    displayName : str | None = None
```

### Adding your own routes

Create a module under `app/api/`, then include it in `router.py`. The auth
dependencies are already built in `api/users.py`:

```python
from fastapi import APIRouter, Depends
from app.api.users import currentActiveUser, currentSuperuser
from app.core.models import User

router = APIRouter()

@router.get("/things")
async def listThings(user : User = Depends(currentActiveUser)) -> list[dict] :
    ...

@router.delete("/things/{thingId}", dependencies=[Depends(currentSuperuser)])
async def deleteThing(thingId : str) -> None :
    ...
```

Use `Depends(getAsyncSession)` from `core/db.py` for database access — it yields
a session scoped to the request.

### Closing registration

`/auth/register` is open by default. To make accounts invitation-only, uncomment
the superuser dependency on the register router in `router.py`.

### Sending email

`UserManager` in `api/users.py` currently only prints on registration.
Override `on_after_forgot_password` and `on_after_request_verify` to actually
deliver the tokens before advertising those flows to users.

### Swapping the database

`core/db.py` builds one `DATABASE_URL`. Point it at
`postgresql+asyncpg://...`, add `asyncpg` to `pyproject.toml`, and everything
above it keeps working — the models and routers make no SQLite-specific
assumptions.

## Container

Built from `python:3.13-slim-bookworm` with a pinned `uv` binary, dependencies
resolved from the committed `uv.lock` (`uv sync --frozen --no-dev`), and the
process running as an unprivileged `appuser`. `/data` is created and chowned in
the image so the mounted volume inherits that ownership — without it SQLite
fails at startup with *unable to open database file*.
