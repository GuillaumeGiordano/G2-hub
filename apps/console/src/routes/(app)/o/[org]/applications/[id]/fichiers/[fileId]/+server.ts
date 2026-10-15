import { json } from '@sveltejs/kit';
import { jsonFailure } from '$lib/server/http';
import * as fileService from '$lib/server/services/fileService';
import type { RequestHandler } from './$types';

// Step 3 of an upload: the original has been PUT to storage — check it and build the processed
// versions (DECISIONS.md §5).
export const POST: RequestHandler = async ({ locals, params }) => {
	try {
		await fileService.completeUpload(locals.orgContext!, params.id, params.fileId);
		return json({ ok: true });
	} catch (err) {
		return jsonFailure(err);
	}
};
