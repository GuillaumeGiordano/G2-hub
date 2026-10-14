import type { Handle } from '@sveltejs/kit';
import { findSession, SESSION_COOKIE } from '$lib/server/sessions';

// Who is signed in to the portal (its own session cookie).
export const handle: Handle = async ({ event, resolve }) => {
	const session = findSession(event.cookies.get(SESSION_COOKIE));
	event.locals.user = session?.user ?? null;
	event.locals.hubToken = session?.hubToken ?? null;
	return resolve(event);
};
