import { error, fail } from '@sveltejs/kit';
import { HubError } from './errors';

// Turn a service error into the right SvelteKit answer. Anything that is not a HubError is
// unexpected: rethrown, so it surfaces as a 500 and is logged — never shown raw to the user.

/** In a form action: field error under its input, a message toast, or 403 / 404. */
export function actionFailure(err: unknown) {
	if (!(err instanceof HubError)) throw err;
	if (err.field) return fail(err.status, { errors: { [err.field]: err.message } });
	return fail(err.status, { message: err.message });
}

/** In a load: the HubError's status page. */
export function loadFailure(err: unknown): never {
	if (err instanceof HubError) error(err.status, err.message);
	throw err;
}
