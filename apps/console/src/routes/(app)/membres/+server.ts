import { redirect } from '@sveltejs/kit';
import { orgPath } from '$lib/utils/orgPath';
import type { RequestHandler } from './$types';

// Former « Membres » address → the members of the last opened organization.
export const GET: RequestHandler = ({ locals }) => {
	redirect(308, locals.organization ? orgPath(locals.organization.id, '/membres') : '/');
};
