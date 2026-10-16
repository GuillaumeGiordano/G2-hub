import { randomBytes } from 'node:crypto';

// The portal's OWN sessions (after « Se connecter avec G2 Hub », the portal keeps the user signed in
// itself). In memory, for the demo only: a real portal uses its database or a signed cookie.

import type { PortalRole } from '$lib/roles';

type Organization = { id: string; name: string };

export type PortalUser = {
	sub: string;
	name: string;
	email: string;
	role: PortalRole;
	/** As a tool: the organization the user entered for. As the client portal: all of theirs (§38). */
	organization: Organization | null;
	organizations: Organization[] | null;
	signedInAt: Date;
};

/** The hub's access token of the user: with the secret key, it opens THEIR personal space
 *  (DECISIONS.md §28). Server-side only — never sent to the browser. Valid one hour. */
export type HubToken = { accessToken: string; expiresAt: Date };

type Session = { user: PortalUser; hubToken: HubToken };

const sessions = new Map<string, Session>();

export const SESSION_COOKIE = 'portal_session';

export function createSession(session: Session): string {
	const id = randomBytes(32).toString('base64url');
	sessions.set(id, session);
	return id;
}

export const findSession = (id: string | undefined) => (id ? (sessions.get(id) ?? null) : null);

export function deleteSession(id: string | undefined): void {
	if (id) sessions.delete(id);
}
