/**
 * Runs before every request. Resolves the logged-in user once from the session
 * cookie so pages can read `Astro.locals.user` without each re-fetching, and
 * enforces route access centrally so a page never renders for the wrong viewer.
 */

import { defineMiddleware } from 'astro:middleware';
import { readToken, clearToken } from './lib/session';
import { fetchCurrentUser, BackendError } from './lib/backend';

// Pages that require a logged-in user; anonymous visitors go to /login.
const protectedPaths : string[] = ['/dashboard', '/profile', '/admin'];

// Pages only a superuser may see.
const adminPaths : string[] = ['/admin'];

function matches(pathname : string, paths : string[]) : boolean
{
    return paths.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export const onRequest = defineMiddleware(async (context, next) =>
{
    const { cookies, url, locals } = context;
    locals.user = null;

    const token = readToken(cookies);

    if (token)
    {
        try
        {
            locals.user = await fetchCurrentUser(token);
        }
        catch (error)
        {
            // A token the backend rejects is a stale session: drop the cookie
            // and carry on as anonymous rather than failing the whole request.
            if (error instanceof BackendError && error.status === 401)
            {
                clearToken(cookies);
            }
            else
            {
                throw error;
            }
        }
    }

    const path : string = url.pathname;

    if (matches(path, protectedPaths) && !locals.user)
    {
        return context.redirect('/login');
    }

    if (matches(path, adminPaths) && !locals.user?.isSuperuser)
    {
        return context.redirect('/dashboard');
    }

    return next();
});
