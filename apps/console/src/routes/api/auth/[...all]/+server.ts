import { auth } from '$lib/server/auth';
import type { RequestHandler } from './$types';

// All Better Auth endpoints (sign-in, sign-out, session, two-factor…).
export const GET: RequestHandler = ({ request }) => auth.handler(request);
export const POST: RequestHandler = ({ request }) => auth.handler(request);
