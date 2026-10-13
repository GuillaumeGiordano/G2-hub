import * as appRepo from '$lib/server/repositories/applicationRepository';
import { assertCan, type OrgContext } from '$lib/server/context';
import { notFound } from '$lib/server/errors';
import { slugify } from '$lib/utils/slug';
import type { ApplicationListItem } from '$lib/viewmodels/application';

// Applications of the ACTIVE organization (ctx comes from the session — DECISIONS.md §13). Every
// member sees them; owners (and the superadmin) create, edit and delete them.

export function listApplications(ctx: OrgContext): Promise<ApplicationListItem[]> {
	assertCan(ctx, 'read');
	return appRepo.listApplications(ctx.organization.id);
}

/** A slug free within the organization: "site", then "site-2", "-3"… */
async function freeSlug(organizationId: string, name: string): Promise<string> {
	const base = slugify(name) || 'application';
	let slug = base;
	for (let n = 2; await appRepo.slugTakenInOrganization(organizationId, slug); n++) slug = `${base}-${n}`;
	return slug;
}

/** Same origin typed twice → kept once. */
const unique = (origins: string[]) => [...new Set(origins)];

export async function createApplication(
	ctx: OrgContext,
	input: { name: string; origins: string[] }
): Promise<string> {
	assertCan(ctx, 'applications.manage');
	const organizationId = ctx.organization.id;
	const app = await appRepo.createApplication({
		organizationId,
		name: input.name,
		slug: await freeSlug(organizationId, input.name),
		allowedOrigins: unique(input.origins)
	});
	return app.name;
}

export async function updateApplication(
	ctx: OrgContext,
	id: string,
	input: { name: string; origins: string[] }
): Promise<string> {
	assertCan(ctx, 'applications.manage');
	const changed = await appRepo.updateApplication(ctx.organization.id, id, {
		name: input.name,
		allowedOrigins: unique(input.origins)
	});
	if (!changed) throw notFound('Application introuvable.');
	return input.name;
}

export async function deleteApplication(ctx: OrgContext, id: string): Promise<void> {
	assertCan(ctx, 'applications.manage');
	if (!(await appRepo.deleteApplication(ctx.organization.id, id))) throw notFound('Application introuvable.');
}
