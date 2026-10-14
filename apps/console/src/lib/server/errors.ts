// A business error meant for the user (vs. an unexpected failure). `field` puts the message under
// that form field; `status` lets a route answer 403 / 404 / 409 instead of a 400 validation error
// (409: the request is valid but the current state forbids it, e.g. deleting a pinned file).
export class HubError extends Error {
	readonly field?: string;
	readonly status: 400 | 403 | 404 | 409;

	constructor(message: string, options: { field?: string; status?: 400 | 403 | 404 | 409 } = {}) {
		super(message);
		this.field = options.field;
		this.status = options.status ?? 400;
	}
}

/** Not found — also used for an id that exists in ANOTHER organization, so as not to reveal it
 *  (404 rather than 403, DECISIONS.md §13). */
export const notFound = (what = 'Élément introuvable.') => new HubError(what, { status: 404 });

export const forbidden = (why = "Vous n'avez pas les droits pour cette action.") =>
	new HubError(why, { status: 403 });
