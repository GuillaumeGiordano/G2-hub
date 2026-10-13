import type { Handle } from '@sveltejs/kit';
import { findSession, SESSION_COOKIE } from '$lib/server/sessions';

// Who is signed in to the portal (its own session cookie).
export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = findSession(event.cookies.get(SESSION_COOKIE));
	return resolve(event);
};
