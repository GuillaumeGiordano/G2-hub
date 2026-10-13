// See https://svelte.dev/docs/kit/types#app.d.ts
import type { auth } from '$lib/server/auth';
import type { OrgContext } from '$lib/server/context';
import type { ActiveOrganization } from '$lib/viewmodels/organization';

type Session = typeof auth.$Infer.Session;

declare global {
	namespace App {
		interface Locals {
			user: Session['user'] | null;
			session: Session['session'] | null;
			/** The organization the session works in (resolved + checked by the hook), or null. */
			organization: ActiveOrganization | null;
			/** Ready-made context for organization-scoped services (null without an organization). */
			orgContext: OrgContext | null;
			/** Mandatory 2FA applies to this account (superadmin, or owner of an organization). */
			requiresTwoFactor: boolean;
		}
	}
}

export {};
