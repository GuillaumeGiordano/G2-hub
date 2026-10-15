import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// « Stockage » moved to the dashboard (DECISIONS.md §33): an old link lands there.
export const GET: RequestHandler = () => redirect(308, '/');
