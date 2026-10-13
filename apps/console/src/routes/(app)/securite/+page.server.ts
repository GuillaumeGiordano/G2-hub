import { requiresTwoFactor } from '$lib/records/roles';
import type { PageServerLoad } from './$types';

// The account's 2FA state; `mandatory` locks deactivation for the roles that require it.
export const load: PageServerLoad = ({ locals }) => ({
	twoFactorEnabled: !!locals.user!.twoFactorEnabled,
	mandatory: requiresTwoFactor(locals.user!.role)
});
