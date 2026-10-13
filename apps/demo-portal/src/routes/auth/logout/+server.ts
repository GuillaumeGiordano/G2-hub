import { redirect } from '@sveltejs/kit';
import { deleteSession, SESSION_COOKIE } from '$lib/server/sessions';
import type { RequestHandler } from './$types';

// Sign out of the PORTAL (its own session). The hub keeps no session for portal users: the next
// « Se connecter » asks for the password again.
export const POST: RequestHandler = ({ cookies }) => {
	deleteSession(cookies.get(SESSION_COOKIE));
	cookies.delete(SESSION_COOKIE, { path: '/' });
	redirect(303, '/');
};
