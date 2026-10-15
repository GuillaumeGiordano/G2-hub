import { redirect } from '@sveltejs/kit';
import { orgPath } from '$lib/utils/orgPath';
import type { RequestHandler } from './$types';

// « Stockage » moved to the organization's dashboard (DECISIONS.md §33).
export const GET: RequestHandler = ({ locals }) => {
	redirect(308, locals.organization ? orgPath(locals.organization.id) : '/');
};
