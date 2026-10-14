import { createHash, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';

// The INTERNAL API (/api/internal/v1) — for the G2 WebDev portal only, server to server: it bills
// the organizations and changes their plan (DECISIONS.md §27). Authenticated by ONE instance token
// (`INTERNAL_API_TOKEN` in .env), never by an API key or a session. Without a token the API does not
// exist (404): a copy delivered to a client has no portal to talk to.

export class InternalApiError extends Error {
	constructor(
		readonly status: 401 | 404,
		message: string
	) {
		super(message);
	}
}

const sha256 = (value: string) => createHash('sha256').update(value).digest();

/** Throws unless the request carries `Authorization: Bearer <INTERNAL_API_TOKEN>`. */
export function authenticateInternal(request: Request): void {
	const expected = env.INTERNAL_API_TOKEN;
	if (!expected) throw new InternalApiError(404, 'Not found.');
	const header = request.headers.get('authorization') ?? '';
	const given = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
	// Hashing first gives two equal-length buffers: the comparison time reveals nothing.
	if (!given || !timingSafeEqual(sha256(given), sha256(expected))) {
		throw new InternalApiError(401, 'Invalid internal token.');
	}
}
