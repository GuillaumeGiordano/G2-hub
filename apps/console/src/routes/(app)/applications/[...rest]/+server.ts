import { error, redirect } from '@sveltejs/kit';
import { isSuperadmin } from '$lib/records/roles';
import { membershipsOf, organizationOfApplication } from '$lib/server/services/organizationService';
import { orgPath } from '$lib/utils/orgPath';
import type { RequestHandler } from './$types';

// Former addresses (/applications/<id>/…, before /o/<organization id>/…, DECISIONS.md §13): links
// in e-mails and bookmarks keep working. The application's organization is looked up only if the
// account may open it; the new address is checked by the hook anyway.
export const GET: RequestHandler = async ({ locals, params, url }) => {
	const [applicationId, ...rest] = params.rest.split('/').filter(Boolean);
	if (!applicationId) redirect(308, locals.organization ? orgPath(locals.organization.id, '/applications') : '/');
	const actor = { id: locals.user!.id, isSuperadmin: isSuperadmin(locals.user!.role) };
	const organizationId = await organizationOfApplication(actor, await membershipsOf(actor.id), applicationId);
	if (!organizationId) error(404, 'Application introuvable.');
	const tail = rest.length ? `/${rest.join('/')}` : '';
	redirect(308, orgPath(organizationId, `/applications/${applicationId}${tail}${url.search}`));
};
