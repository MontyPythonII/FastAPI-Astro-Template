# Astro Auth Frontend — Design

Date: 2026-07-22

## Goal

Replace the Astro starter template with a working, minimal frontend that
exercises the existing FastAPI backend's auth and user endpoints, so the
repo is a usable full-stack template. Covers register, login, logout, view
current user, edit profile, and superuser-only user management.

## Architecture — SSR backend-for-frontend (BFF)

The backend is `expose`d only (never published to the host) and compose hands
the frontend `BACKEND_BASE_URL=http://backend:7070`. So the browser cannot and
must not reach the API directly. Astro runs as an SSR Node server and acts as
the browser's only backend.

- Add `@astrojs/node` standalone adapter, `output: 'server'`. This makes
  `npm run build` emit `dist/server/entry.mjs`, which the frontend Dockerfile
  already runs.
- Backend base URL: `process.env.BACKEND_BASE_URL`, falling back to
  `http://localhost:7070` for local dev outside compose.
- Auth flow: browser posts a form to an Astro API route; the route calls the
  backend server-side; on login it stores the JWT in an httpOnly, sameSite-lax
  cookie. Token never touches client JS. No CORS, no localStorage.

```
browser --form POST--> Astro API route --fetch--> http://backend:7070
                            |
                    sets httpOnly cookie (JWT)
browser --GET page--> Astro SSR reads cookie --fetch /users/me--> renders
```

## Available backend endpoints (from backend/app/api/router.py)

- `POST /auth/register` — JSON `{email, password}` → UserRead
- `POST /auth/jwt/login` — form-encoded `username`(=email)+`password` →
  `{access_token, token_type}`
- `POST /auth/jwt/logout` — bearer → 204
- `GET /users/me` — bearer → UserRead
- `PATCH /users/me` — bearer, JSON `{email?, password?}` → UserRead
- `GET /users/{id}` — superuser → UserRead
- `PATCH /users/{id}` — superuser, JSON → UserRead
- `DELETE /users/{id}` — superuser → 204

UserRead fields: `id, email, is_active, is_superuser, is_verified`.

Note: fastapi-users ships no "list all users" route, so the admin page manages
one user at a time by UUID rather than listing. Where a real list endpoint
would be added is called out in the README.

## File structure

```
frontend/
  astro.config.mjs          # + node adapter, output: 'server'
  package.json              # + @astrojs/node
  src/
    lib/backend.ts          # typed backend client (all fetch calls live here)
    lib/session.ts          # cookie name + read/set/clear helpers
    middleware.ts           # loads locals.user from cookie; guards routes
    layouts/Layout.astro    # base HTML shell + nav slot
    components/Nav.astro     # auth-aware navigation
    pages/
      index.astro           # redirect: logged in -> /dashboard else /login
      register.astro
      login.astro
      dashboard.astro       # shows current user
      profile.astro         # edit email/password
      admin.astro           # superuser: manage user by UUID
      api/auth/register.ts
      api/auth/login.ts
      api/auth/logout.ts
      api/profile.ts         # PATCH /users/me
      api/admin/user.ts      # POST-dispatched GET/PATCH/DELETE by id
    styles/global.css        # design tokens + base styles (plain CSS)
```

Pages stay thin (SSR data fetch + form markup). Every backend call funnels
through `lib/backend.ts`, so a project cut from this template repoints one file.

## Component responsibilities

- **lib/backend.ts** — one async function per endpoint. Takes primitives and an
  optional token; returns typed results or throws a `BackendError` carrying the
  HTTP status and the backend's error `detail`. Knows nothing about cookies or
  Astro.
- **lib/session.ts** — the cookie name, plus `readToken`, `setToken`,
  `clearToken` over `AstroCookies`. Cookie is httpOnly, sameSite lax,
  secure when `ENVIRONMENT=production`, path `/`.
- **middleware.ts** — on every request: if a token cookie exists, call
  `GET /users/me` and put the result on `locals.user` (clearing a stale/invalid
  cookie). Redirect unauthenticated requests for protected pages to `/login`,
  and non-superusers away from `/admin` to `/dashboard`.
- **API routes** — parse the form, call `lib/backend.ts`, translate the outcome
  into a redirect (success) or a redirect back to the form with an `?error=`
  message (failure). They own the cookie writes.
- **Pages** — read `locals.user` for display; render forms; surface `?error=`.

## Data flow per page

- **register** → `api/auth/register` → `POST /auth/register`; on success redirect
  to `/login?registered=1`; on 400 `REGISTER_USER_ALREADY_EXISTS` / 422 re-show
  the form with a message.
- **login** → `api/auth/login` → `POST /auth/jwt/login`; store token cookie;
  redirect `/dashboard`; on 400 `LOGIN_BAD_CREDENTIALS` re-show with a message.
- **dashboard** → SSR reads `locals.user` (already fetched in middleware); shows
  id/email/active/verified/superuser; logout button posts `api/auth/logout`.
- **profile** → `api/profile` → `PATCH /users/me` with only the filled fields;
  re-show with success/error.
- **admin** → `api/admin/user`: lookup by UUID (`GET /users/{id}`), toggle
  is_active/is_superuser/is_verified (`PATCH`), or delete (`DELETE`).
- **logout** → `POST /auth/jwt/logout` (best-effort) + clear cookie → `/login`.

## Error handling

- `BackendError` from `lib/backend.ts` carries status + detail. API routes map
  known cases to friendly messages and redirect back with `?error=`; unknown
  cases show a generic message and are logged server-side.
- Middleware treats a token that fails `/users/me` (401) as logged-out: clear
  the cookie, continue as anonymous.
- Protected-route guards live in middleware, so pages never render for the
  wrong audience.

## Styling

Plain scoped CSS. A single `global.css` defines design tokens (colors, spacing,
radius, font) and base element styles; components use Astro `<style>` blocks.
No CSS framework dependency, so it is trivial to replace per project.

## Verification

Backend bugs are fixed (User.trips relationship removed; compose `&{`→`${`), so
the stack runs. Verification:

1. Boot the backend locally (uv) with a seeded superuser.
2. `npm run build` in frontend emits `dist/server/entry.mjs` (proves adapter).
3. Run the SSR server against the backend and drive the flows with a browser:
   register → login → dashboard → edit profile → admin manage-by-id → logout,
   plus guard redirects (anon→/login, non-super→/dashboard).

## Out of scope

- Password reset / email verification UI (endpoints exist; not wired to keep the
  template basic — noted in README as an extension point).
- Any "list users" view (no backend endpoint).
- Client-side framework islands; pages are server-rendered HTML + forms.
