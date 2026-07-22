# Frontend — Astro SSR

A minimal Astro frontend that exercises the FastAPI backend's auth and user
endpoints: register, log in, view the current user, edit your profile, and
(as a superuser) manage another account.

## How it talks to the backend

The backend is never published to the browser — in `docker-compose.yml` it is
only `expose`d on the internal network. So this app runs as a **server-side
backend-for-frontend**: the browser only ever talks to this Astro server, and
Astro calls the backend from Node.

```
browser --form POST--> Astro API route --fetch--> BACKEND_BASE_URL
                            |
                    sets httpOnly cookie (JWT)
browser --GET page--> Astro SSR reads cookie --GET /users/me--> renders
```

The JWT lives in an **httpOnly, sameSite-lax cookie** (`authToken`) — never in
client JavaScript, so there is no token to steal via XSS and no CORS to
configure. `secure` is enabled when `ENVIRONMENT=production`.

## Environment

| Variable           | Purpose                                    | Default (dev)             |
| :----------------- | :----------------------------------------- | :------------------------ |
| `BACKEND_BASE_URL` | Base URL of the FastAPI backend            | `http://localhost:7070`   |
| `ENVIRONMENT`      | `production` sets the cookie `Secure` flag | unset                     |
| `HOST` / `PORT`    | Bind address for the standalone server     | `0.0.0.0` / `7071`        |

Compose sets `BACKEND_BASE_URL=http://backend:7070` and `ENVIRONMENT`
automatically.

## Structure

```text
src/
├── lib/
│   ├── backend.ts      # typed backend client — the only place that fetches the API
│   └── session.ts      # session-cookie read/set/clear helpers
├── middleware.ts       # resolves Astro.locals.user; guards protected/admin routes
├── layouts/Layout.astro
├── components/Nav.astro
├── pages/
│   ├── index.astro     # redirects to /dashboard or /login
│   ├── register.astro  login.astro  dashboard.astro  profile.astro  admin.astro
│   └── api/
│       ├── auth/register.ts  login.ts  logout.ts
│       ├── profile.ts        # PATCH /users/me
│       └── admin/user.ts     # superuser update/delete by id
└── styles/global.css   # design tokens + base styles (plain CSS, no framework)
```

To point this at a different API, edit `src/lib/backend.ts` — nothing else
knows the wire format.

## Backend endpoints used

`POST /auth/register`, `POST /auth/jwt/login`, `POST /auth/jwt/logout`,
`GET`/`PATCH /users/me`, and (superuser) `GET`/`PATCH`/`DELETE /users/{id}`.

## Extending

- **Admin is manage-by-id, not a list.** fastapi-users ships no "list all
  users" route, so the admin page looks a user up by UUID. Add a
  `GET /users` route on the backend (behind the superuser dependency) and a
  `listUsers()` in `backend.ts` to turn it into a real table.
- **Password reset / email verification** endpoints exist on the backend
  (`/auth/forgot-password`, `/auth/reset-password`, `/auth/verify`) but are not
  wired into the UI, to keep the template small.

## Commands

| Command           | Action                                       |
| :---------------- | :------------------------------------------- |
| `npm install`     | Install dependencies                         |
| `npm run dev`     | Dev server at `localhost:7071`               |
| `npm run build`   | Build the standalone server to `./dist/`     |
| `npm run preview` | Preview the production build                 |
| `npm run astro check` | Type-check the project                   |

For the full stack (backend + frontend), use `docker compose up --build` from
the repository root.
