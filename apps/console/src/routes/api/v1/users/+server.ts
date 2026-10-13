import { apiRoute, jsonBody } from '$lib/server/api/handler';
import { inviteUser } from '$lib/server/services/apiAppUserService';

// POST /api/v1/users (secret key) — invite a user to the key's application.
export const POST = apiRoute(async (ctx, { request }) => inviteUser(ctx, await jsonBody(request)), { status: 201 });
