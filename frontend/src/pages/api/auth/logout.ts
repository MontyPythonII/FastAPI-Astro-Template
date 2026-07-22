import type { APIRoute } from 'astro';
import { logoutUser } from '../../../lib/backend';
import { readToken, clearToken } from '../../../lib/session';

// Ends the session. The cookie is always cleared; the backend call is
// best-effort so a backend hiccup can never leave the user unable to log out.
export const POST : APIRoute = async (context) =>
{
    const token : string | undefined = readToken(context.cookies);

    if (token)
    {
        try
        {
            await logoutUser(token);
        }
        catch
        {
            // Ignored: clearing the cookie below is what actually logs out.
        }
    }

    clearToken(context.cookies);
    return context.redirect('/login');
};
