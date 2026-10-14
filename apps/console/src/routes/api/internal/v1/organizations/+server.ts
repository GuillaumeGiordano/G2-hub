import { internalRoute } from '$lib/server/internal/handler';
import { listOrganizations } from '$lib/server/services/internalService';

// GET /api/internal/v1/organizations (instance token) — every organization with its plan and usage,
// for the G2 WebDev portal's billing (DECISIONS.md §27).
export const GET = internalRoute(() => listOrganizations());
