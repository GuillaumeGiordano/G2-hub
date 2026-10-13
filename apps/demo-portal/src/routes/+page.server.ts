import { env } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';

// The portal's home: signed in (its own session) or not, and whether the hub sign-in is configured.
export const load: PageServerLoad = ({ locals, url }) => ({
	user: locals.user,
	configured: !!env.DEMO_PORTAL_CLIENT_ID && !!env.DEMO_PORTAL_CLIENT_SECRET,
	error: url.searchParams.get('erreur')
});
