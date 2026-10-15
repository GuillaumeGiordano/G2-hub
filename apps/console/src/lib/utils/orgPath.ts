// Console addresses of an organization: /o/<organization id>/… (DECISIONS.md §13). The id in the
// address only says WHICH organization is asked for: the hook checks on every request that the
// account is a member of it (or the superadmin) — otherwise 404.
export const orgPath = (organizationId: string, path = '') => `/o/${organizationId}${path}`;
