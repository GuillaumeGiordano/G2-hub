import { can, type OrgPermission } from '$lib/records/organization';
import type { ActiveOrganization } from '$lib/viewmodels/organization';
import { forbidden } from './errors';

/** Who is acting, and in which organization. Built by the hook from the SESSION (never from the
 *  browser) and handed to every organization-scoped service (DECISIONS.md §13). */
export type OrgContext = {
	userId: string;
	isSuperadmin: boolean;
	organization: ActiveOrganization;
};

/** Throw 403 unless the actor holds `permission` in the active organization. */
export function assertCan(ctx: OrgContext, permission: OrgPermission): void {
	if (!can(ctx.organization.role, ctx.isSuperadmin, permission)) throw forbidden();
}
