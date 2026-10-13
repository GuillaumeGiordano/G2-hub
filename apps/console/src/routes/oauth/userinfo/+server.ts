import { json } from '@sveltejs/kit';
import { OAuthError, userInfo } from '$lib/server/services/oidcService';
import type { RequestHandler } from './$types';

// UserInfo endpoint (OIDC Core §5.3): the signed-in user's claims, for a valid access token.
const handler: RequestHandler = async ({ request }) => {
	try {
		return json(await userInfo(request), { headers: { 'cache-control': 'no-store' } });
	} catch (err) {
		if (!(err instanceof OAuthError)) throw err;
		return json(
			{ error: err.error, error_description: err.message },
			{
				status: err.status,
				headers: { 'cache-control': 'no-store', 'www-authenticate': `Bearer error="${err.error}"` }
			}
		);
	}
};

export const GET = handler;
export const POST = handler;
