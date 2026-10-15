import { json } from '@sveltejs/kit';
import { uploadRequestSchema } from '$lib/schemas/file';
import { jsonFailure } from '$lib/server/http';
import * as fileService from '$lib/server/services/fileService';
import type { RequestHandler } from './$types';

// Step 1 of an upload: ask for a ticket (type, size and quota checked; size reserved) and get the
// presigned URL the browser PUTs the original to. The (org) group guard (hooks.server.ts) also
// covers this endpoint: session, 2FA and active organization are guaranteed.
export const POST: RequestHandler = async ({ request, locals, params }) => {
	const parsed = uploadRequestSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return json({ message: 'Demande d’envoi invalide.' }, { status: 400 });
	try {
		return json(await fileService.requestUpload(locals.orgContext!, params.id, parsed.data));
	} catch (err) {
		return jsonFailure(err);
	}
};
