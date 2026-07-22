/**
 * The browser session is a single httpOnly cookie holding the backend JWT.
 * Keeping the token out of client JS means no XSS token theft and no CORS —
 * only the SSR server ever reads it. These helpers are the one place the cookie
 * name and its flags are defined.
 */

import type { AstroCookies } from 'astro';

const authCookieName : string = 'authToken';

// Matches the backend JWT lifetime set in app/api/users.py (two days).
const cookieMaxAge : number = 2 * 24 * 60 * 60;

// Compose sets ENVIRONMENT=production for the deployed stack, where traffic is
// HTTPS at the edge; local dev leaves it unset so the cookie works over http.
function isProduction() : boolean
{
    return process.env.ENVIRONMENT === 'production';
}

export function readToken(cookies : AstroCookies) : string | undefined
{
    return cookies.get(authCookieName)?.value;
}

export function setToken(cookies : AstroCookies, token : string) : void
{
    cookies.set(authCookieName, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProduction(),
        path: '/',
        maxAge: cookieMaxAge,
    });
}

export function clearToken(cookies : AstroCookies) : void
{
    cookies.delete(authCookieName, { path: '/' });
}
