import { internalBody, internalRoute } from '$lib/server/internal/handler';
import { createOrganization, listOrganizations } from '$lib/server/services/internalService';

// GET /api/internal/v1/organizations (instance token) — every organization with its plan and usage,
// for the G2 WebDev portal's billing (DECISIONS.md §27).
export const GET = internalRoute(() => listOrganizations());

// POST — g2-erp creates a won client's organization and its first Admin (§43): 201, or 200 when
// the same `externalRef` was already created.
export const POST = internalRoute(
	async ({ request }) => {
		const result = await createOrganization(await internalBody(request));
		return { status: result.created ? 201 : 200, body: result };
	},
	{ withStatus: true }
);
