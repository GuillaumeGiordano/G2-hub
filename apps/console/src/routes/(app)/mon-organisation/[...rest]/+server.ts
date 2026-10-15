import { redirect } from '@sveltejs/kit';
import { orgPath } from '$lib/utils/orgPath';
import type { RequestHandler } from './$types';

// Former « Mon organisation » addresses → /o/<last opened organization>/informations or /securite.
export const GET: RequestHandler = ({ locals, params }) => {
	if (!locals.organization) redirect(308, '/');
	redirect(308, orgPath(locals.organization.id, params.rest === 'securite' ? '/securite' : '/informations'));
};
