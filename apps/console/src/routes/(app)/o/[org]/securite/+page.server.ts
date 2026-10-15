import type { PageServerLoad } from './$types';

// « Mon organisation › Sécurité » (DECISIONS.md §33): the signed-in account's password and 2FA,
// where an Admin finds them (the menu shows « Mon compte › Sécurité » to the superadmin only).
// `mandatory` (superadmin or organization Admin, computed by the hook) locks deactivation.
export const load: PageServerLoad = ({ locals }) => ({
	twoFactorEnabled: !!locals.user!.twoFactorEnabled,
	mandatory: locals.requiresTwoFactor,
	organization: { id: locals.organization!.id, name: locals.organization!.name }
});
