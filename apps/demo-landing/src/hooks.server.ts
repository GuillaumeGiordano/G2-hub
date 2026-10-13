import { timingSafeEqual } from 'node:crypto';
import { error, type Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

// The demo's admin (/admin) stands for a client site's own back-office. Kept minimal on purpose:
// HTTP Basic with one password from .env (a real site would use its own login).
const ADMIN = '/admin';

function authorized(request: Request): boolean {
	const header = request.headers.get('authorization') ?? '';
	if (!header.startsWith('Basic ')) return false;
	const decoded = Buffer.from(header.slice(6), 'base64').toString();
	const given = Buffer.from(decoded.slice(decoded.indexOf(':') + 1));
	const expected = Buffer.from(env.DEMO_ADMIN_PASSWORD ?? '');
	// Constant-time comparison: the answer time does not reveal how many characters matched.
	return expected.length > 0 && given.length === expected.length && timingSafeEqual(given, expected);
}

export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname === ADMIN || event.url.pathname.startsWith(`${ADMIN}/`)) {
		if (!env.DEMO_ADMIN_PASSWORD) error(503, 'Admin désactivé : DEMO_ADMIN_PASSWORD non configuré.');
		if (!authorized(event.request)) {
			return new Response('Authentification requise.', {
				status: 401,
				headers: { 'www-authenticate': 'Basic realm="Admin démo", charset="UTF-8"' }
			});
		}
	}
	return resolve(event);
};
