import type { APIRoute } from 'astro';
import { updateCurrentUser, BackendError, type ProfilePatch } from '../../lib/backend';
import { readToken } from '../../lib/session';

// Handles the profile form: patches the current user's email and/or password.
// Only non-empty fields are sent, so a blank password leaves it unchanged.
export const POST : APIRoute = async (context) =>
{
    const token : string | undefined = readToken(context.cookies);

    if (!token)
    {
        return context.redirect('/login');
    }

    const form = await context.request.formData();
    const email : string = String(form.get('email') ?? '').trim();
    const password : string = String(form.get('password') ?? '');

    const patch : ProfilePatch = {};
    if (email) { patch.email = email; }
    if (password) { patch.password = password; }

    if (patch.email === undefined && patch.password === undefined)
    {
        return context.redirect(`/profile?error=${encodeURIComponent('Nothing to update.')}`);
    }

    try
    {
        await updateCurrentUser(token, patch);
    }
    catch (error)
    {
        return context.redirect(`/profile?error=${encodeURIComponent(updateErrorMessage(error))}`);
    }

    return context.redirect('/profile?updated=1');
};

function updateErrorMessage(error : unknown) : string
{
    if (error instanceof BackendError)
    {
        if (error.detail === 'UPDATE_USER_EMAIL_ALREADY_EXISTS')
        {
            return 'That email is already in use.';
        }

        const detail = error.detail as { reason? : string } | undefined;
        if (detail?.reason)
        {
            return detail.reason;
        }
    }

    return 'Update failed. Please try again.';
}
