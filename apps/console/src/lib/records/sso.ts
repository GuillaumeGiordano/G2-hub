// « Se connecter avec G2 Hub » (OIDC provider) — protocol constants. Client-safe. DECISIONS.md §25.

/** Every client secret starts with this prefix: a leaked secret is recognizable at a glance. */
export const SSO_SECRET_PREFIX = 'g2_sso_';

/** Scopes a portal may ask for: `openid` (required) → sub; `email` → email; `profile` → name;
 *  for an application of the platform (§38), `organization` → the organization a tool was entered
 *  for, `organizations` → the organizations the console member is an Admin of. */
export const SSO_SCOPES = ['openid', 'email', 'profile', 'organization', 'organizations'] as const;

/** The `role` claim sent to the portal (DECISIONS.md §26, §38): `admin` = an Admin of the
 *  organization OWNING the application (or the superadmin, on an application of the platform);
 *  `client` = an Admin of another organization on an application of the platform; the others =
 *  the application user's role. */
export const SSO_ROLE_CLAIM = {
	ADMIN: 'admin',
	CLIENT: 'client',
	SUPER_USER: 'superuser',
	USER: 'user',
	GUEST: 'guest'
} as const;

/** `sub` of a console member: prefixed so that it never collides with an application user's id
 *  (those keep their bare id, so the portals already connected do not break). */
export const MEMBER_SUBJECT_PREFIX = 'm_';

/** Authorization parameter: the organization a console member enters a tool for (§38). */
export const ORGANIZATION_PARAM = 'organization';

/** Lifetimes, in seconds. */
export const AUTH_CODE_TTL = 60;
export const ACCESS_TOKEN_TTL = 3600;
export const ID_TOKEN_TTL = 600;

/** Exact URLs a portal may be sent back to (no wildcard). */
export const MAX_REDIRECT_URIS = 10;
