/**
 * Typed client for the FastAPI backend. This is the only module that knows the
 * wire format and the backend URL — every page and API route calls the backend
 * through the functions here, so a project cut from this template repoints one
 * file. Nothing in here knows about cookies or Astro.
 */

// Compose injects BACKEND_BASE_URL (http://backend:$SERVER_PORT); the fallback
// is for running the SSR server locally against a backend on the host, and
// tracks SERVER_PORT so both halves move together when that one value changes.
const backendPort : string = process.env.SERVER_PORT || '7070';
const backendBaseUrl : string = process.env.BACKEND_BASE_URL ?? `http://localhost:${backendPort}`;

// The user shape the app works with, camelCased from the backend's snake_case.
export interface User
{
    id : string;
    email : string;
    isActive : boolean;
    isSuperuser : boolean;
    isVerified : boolean;
}

// Fields the current user may change on themselves.
export interface ProfilePatch
{
    email? : string;
    password? : string;
}

// Flags a superuser may toggle on another account.
export interface AdminPatch
{
    isActive? : boolean;
    isSuperuser? : boolean;
    isVerified? : boolean;
}

// The raw UserRead payload as the backend serialises it.
interface RawUser
{
    id : string;
    email : string;
    is_active : boolean;
    is_superuser : boolean;
    is_verified : boolean;
}

/**
 * Raised for any non-2xx backend response. Carries the HTTP status and the
 * backend's `detail` so callers can branch on known fastapi-users error codes
 * (e.g. "LOGIN_BAD_CREDENTIALS") without re-parsing the response.
 */
export class BackendError extends Error
{
    status : number;
    detail : unknown;

    constructor(status : number, detail : unknown)
    {
        super(typeof detail === 'string' ? detail : `Backend error ${status}`);
        this.name = 'BackendError';
        this.status = status;
        this.detail = detail;
    }
}

function toUser(raw : RawUser) : User
{
    return {
        id: raw.id,
        email: raw.email,
        isActive: raw.is_active,
        isSuperuser: raw.is_superuser,
        isVerified: raw.is_verified,
    };
}

// Pulls the most useful error payload out of a failed response: fastapi-users
// returns either a plain string code or a { code, reason } object in `detail`.
async function readDetail(response : Response) : Promise<unknown>
{
    try
    {
        const body = await response.json();
        return body?.detail ?? body;
    }
    catch
    {
        return response.statusText;
    }
}

function authHeader(token : string) : Record<string, string>
{
    return { Authorization: `Bearer ${token}` };
}

/**
 * Registers a new account. Backend enforces the email/password policy and
 * returns the created user, or 400 REGISTER_USER_ALREADY_EXISTS on a clash.
 */
export async function registerUser(email : string, password : string) : Promise<User>
{
    const response = await fetch(`${backendBaseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });

    if (!response.ok)
    {
        throw new BackendError(response.status, await readDetail(response));
    }

    return toUser(await response.json());
}

/**
 * Exchanges credentials for a JWT. The backend's login route is form-encoded
 * and names the email field "username", a fastapi-users convention.
 */
export async function loginUser(email : string, password : string) : Promise<string>
{
    const form = new URLSearchParams({ username: email, password });

    const response = await fetch(`${backendBaseUrl}/auth/jwt/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
    });

    if (!response.ok)
    {
        throw new BackendError(response.status, await readDetail(response));
    }

    const body = await response.json();
    return body.access_token as string;
}

// Best-effort server-side logout. The cookie is cleared regardless; this just
// lets the backend invalidate its side of the session.
export async function logoutUser(token : string) : Promise<void>
{
    const response = await fetch(`${backendBaseUrl}/auth/jwt/logout`, {
        method: 'POST',
        headers: authHeader(token),
    });

    // 401 means the token was already invalid — nothing left to log out.
    if (!response.ok && response.status !== 401)
    {
        throw new BackendError(response.status, await readDetail(response));
    }
}

export async function fetchCurrentUser(token : string) : Promise<User>
{
    const response = await fetch(`${backendBaseUrl}/users/me`, {
        headers: authHeader(token),
    });

    if (!response.ok)
    {
        throw new BackendError(response.status, await readDetail(response));
    }

    return toUser(await response.json());
}

export async function updateCurrentUser(token : string, patch : ProfilePatch) : Promise<User>
{
    const response = await fetch(`${backendBaseUrl}/users/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify(patch),
    });

    if (!response.ok)
    {
        throw new BackendError(response.status, await readDetail(response));
    }

    return toUser(await response.json());
}

export async function fetchUserById(token : string, id : string) : Promise<User>
{
    const response = await fetch(`${backendBaseUrl}/users/${encodeURIComponent(id)}`, {
        headers: authHeader(token),
    });

    if (!response.ok)
    {
        throw new BackendError(response.status, await readDetail(response));
    }

    return toUser(await response.json());
}

export async function updateUserById(token : string, id : string, patch : AdminPatch) : Promise<User>
{
    // The admin flags are the app's camelCase; the backend expects snake_case.
    const payload : Record<string, boolean> = {};
    if (patch.isActive !== undefined) { payload.is_active = patch.isActive; }
    if (patch.isSuperuser !== undefined) { payload.is_superuser = patch.isSuperuser; }
    if (patch.isVerified !== undefined) { payload.is_verified = patch.isVerified; }

    const response = await fetch(`${backendBaseUrl}/users/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify(payload),
    });

    if (!response.ok)
    {
        throw new BackendError(response.status, await readDetail(response));
    }

    return toUser(await response.json());
}

export async function deleteUserById(token : string, id : string) : Promise<void>
{
    const response = await fetch(`${backendBaseUrl}/users/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: authHeader(token),
    });

    if (!response.ok)
    {
        throw new BackendError(response.status, await readDetail(response));
    }
}
