import type { APIRoute } from 'astro';
import { loginUser, BackendError } from '../../../lib/backend';
import { setToken } from '../../../lib/session';

// Handles the login form: trades credentials for a JWT and stores it in the
// session cookie, then lands the user on their dashboard.
export const POST : APIRoute = async (context) =>
{
    const form = await context.request.formData();
    const email : string = String(form.get('email') ?? '').trim();
    const password : string = String(form.get('password') ?? '');

    try
    {
        const token : string = await loginUser(email, password);
        setToken(context.cookies, token);
    }
    catch (error)
    {
        // The backend answers 400 for both bad credentials and inactive
        // accounts; a single message avoids leaking which one it was.
        const message : string = error instanceof BackendError && error.status === 400
            ? 'Incorrect email or password.'
            : 'Login failed. Please try again.';
        return context.redirect(`/login?error=${encodeURIComponent(message)}`);
    }

    return context.redirect('/dashboard');
};
