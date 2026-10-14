import type { PageServerLoad } from './$types';

// The account's 2FA state; `mandatory` (superadmin or organization Admin, computed by the hook)
// locks deactivation.
export const load: PageServerLoad = ({ locals }) => ({
	twoFactorEnabled: !!locals.user!.twoFactorEnabled,
	mandatory: locals.requiresTwoFactor
});
