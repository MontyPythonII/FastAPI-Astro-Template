import type { APIRoute } from 'astro';
import { registerUser, BackendError } from '../../../lib/backend';

// Handles the register form. On success the user is sent to login; on failure
// they return to the form with a readable message in the query string.
export const POST : APIRoute = async (context) =>
{
    const form = await context.request.formData();
    const email : string = String(form.get('email') ?? '').trim();
    const password : string = String(form.get('password') ?? '');

    if (!email || !password)
    {
        return backToForm('Email and password are required.');
    }

    try
    {
        await registerUser(email, password);
    }
    catch (error)
    {
        return backToForm(registerErrorMessage(error));
    }

    return context.redirect('/login?registered=1');

    function backToForm(message : string) : Response
    {
        return context.redirect(`/register?error=${encodeURIComponent(message)}`);
    }
};

function registerErrorMessage(error : unknown) : string
{
    if (error instanceof BackendError)
    {
        if (error.detail === 'REGISTER_USER_ALREADY_EXISTS')
        {
            return 'An account with that email already exists.';
        }

        // fastapi-users reports password-policy failures as { code, reason }.
        const detail = error.detail as { reason? : string } | undefined;
        if (detail?.reason)
        {
            return detail.reason;
        }
    }

    return 'Registration failed. Please check your details and try again.';
}
