import type { LayoutServerLoad } from './$types';

// Access (signed in + mandatory 2FA) is enforced centrally in hooks.server.ts for the whole (app)
// group; here the authenticated user is surfaced to the pages (guaranteed non-null by the hook).
export const load: LayoutServerLoad = ({ locals }) => ({ user: locals.user! });
