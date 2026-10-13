import { randomBytes } from 'node:crypto';

// The portal's OWN sessions (after « Se connecter avec G2 Hub », the portal keeps the user signed in
// itself). In memory, for the demo only: a real portal uses its database or a signed cookie.

export type PortalUser = { sub: string; name: string; email: string; signedInAt: Date };

const sessions = new Map<string, PortalUser>();

export const SESSION_COOKIE = 'portal_session';

export function createSession(user: PortalUser): string {
	const id = randomBytes(32).toString('base64url');
	sessions.set(id, user);
	return id;
}

export const findSession = (id: string | undefined) => (id ? (sessions.get(id) ?? null) : null);

export function deleteSession(id: string | undefined): void {
	if (id) sessions.delete(id);
}
