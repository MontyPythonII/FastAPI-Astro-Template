import type { APIRoute } from 'astro';
import { updateUserById, deleteUserById, BackendError } from '../../../lib/backend';
import { readToken } from '../../../lib/session';

// Superuser actions on a single account, dispatched by a hidden `action` field:
// "update" toggles the account flags, "delete" removes the account. The backend
// enforces the superuser requirement; here we only translate the outcome.
export const POST : APIRoute = async (context) =>
{
    const token : string | undefined = readToken(context.cookies);

    if (!token)
    {
        return context.redirect('/login');
    }

    const form = await context.request.formData();
    const action : string = String(form.get('action') ?? '');
    const id : string = String(form.get('id') ?? '').trim();

    if (!id)
    {
        return context.redirect(`/admin?error=${encodeURIComponent('A user id is required.')}`);
    }

    try
    {
        if (action === 'delete')
        {
            await deleteUserById(token, id);
            return context.redirect('/admin?deleted=1');
        }

        if (action === 'update')
        {
            // Unchecked checkboxes are simply absent from the form data.
            await updateUserById(token, id, {
                isActive: form.get('isActive') === 'on',
                isSuperuser: form.get('isSuperuser') === 'on',
                isVerified: form.get('isVerified') === 'on',
            });
            return context.redirect(`/admin?id=${encodeURIComponent(id)}&updated=1`);
        }

        return context.redirect(`/admin?error=${encodeURIComponent('Unknown action.')}`);
    }
    catch (error)
    {
        const message : string = error instanceof BackendError
            ? adminErrorMessage(error)
            : 'The request failed. Please try again.';
        return context.redirect(`/admin?id=${encodeURIComponent(id)}&error=${encodeURIComponent(message)}`);
    }
};

function adminErrorMessage(error : BackendError) : string
{
    if (error.status === 404)
    {
        return 'No user found with that id.';
    }
    if (error.status === 403)
    {
        return 'You do not have permission to do that.';
    }
    if (error.status === 422)
    {
        return 'That id is not a valid user id.';
    }
    return 'The request failed. Please try again.';
}
