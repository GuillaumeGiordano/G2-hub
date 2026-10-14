import { internalBody, internalRoute } from '$lib/server/internal/handler';
import { getOrganization, updatePlan } from '$lib/server/services/internalService';

// One organization (instance token): read it, or change its plan — tier and / or storage option —
// after the client paid on the G2 WebDev portal (DECISIONS.md §27).
export const GET = internalRoute(({ params }) => getOrganization(params.id!));
export const PATCH = internalRoute(async ({ params, request }) => updatePlan(params.id!, await internalBody(request)));
