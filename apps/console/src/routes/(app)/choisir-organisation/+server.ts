import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Former « Choisir une organisation » → « Mes organisations » (DECISIONS.md §36).
export const GET: RequestHandler = () => redirect(308, '/mes-organisations');
