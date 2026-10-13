import type { SubmitFunction } from '@sveltejs/kit';
import { toast } from '@guillaumeg/ui';
import type { FieldErrors } from './fieldErrors.svelte';

type ActionData = Record<string, unknown>;

export type ToastEnhanceOptions = {
	/** Success toast: a fixed string, or derived from the action's returned data. */
	success: string | ((data: ActionData) => string);
	/** Called after a successful submit (close a modal, reset local state…). */
	onSuccess?: (data: ActionData) => void;
	/** Fallback text for a validation failure — the action's own `message` wins when present. */
	failure?: string;
	/** Toggle a loading flag around the request, e.g. `(v) => (saving = v)`. */
	setBusy?: (busy: boolean) => void;
	/** Reset the form fields on success (default: keep the submitted values). */
	resetOnSuccess?: boolean;
	/** Show the action's field errors under the inputs instead of toasting the first one. With a
	 *  schema, the form is also validated in the browser and not posted while invalid. */
	fields?: FieldErrors;
};

/**
 * Shared `use:enhance` handler: toasts success/failure/server-error consistently and
 * toggles a busy flag. Replaces the near-identical `submit()` copied across form pages.
 *
 * ```svelte
 * <form use:enhance={toastEnhance({ success: 'Enregistré.', setBusy: (v) => (saving = v) })}>
 * ```
 */
export function toastEnhance(options: ToastEnhanceOptions): SubmitFunction {
	const {
		success,
		onSuccess,
		failure = 'Enregistrement impossible.',
		setBusy,
		resetOnSuccess = false,
		fields
	} = options;

	return ({ formData, cancel }) => {
		// Browser-side validation (when `fields` has a schema): an invalid form is not posted.
		if (fields && !fields.validate(formData)) {
			cancel();
			return;
		}
		setBusy?.(true);
		return async ({ result, update }) => {
			setBusy?.(false);
			if (result.type === 'success') {
				fields?.clear();
				const data = (result.data ?? {}) as ActionData;
				toast.success(typeof success === 'function' ? success(data) : success);
				onSuccess?.(data);
			} else if (result.type === 'failure') {
				const d = (result.data ?? {}) as { message?: unknown; errors?: Record<string, unknown> };
				if (fields) {
					// Field errors go under their inputs; a form-level message, or an error on a field
					// the form does not display, is toasted.
					const others = fields.set(d.errors);
					if (typeof d.message === 'string') toast.error(d.message);
					else if (others.length) toast.error(others[0]);
					else if (!fields.has()) toast.error(failure);
				} else {
					// Prefer the action's own message, then the first field error, then the fallback.
					const firstError = d.errors ? Object.values(d.errors)[0] : undefined;
					toast.error(
						typeof d.message === 'string' ? d.message : firstError != null ? String(firstError) : failure
					);
				}
			} else if (result.type === 'error') {
				toast.error('Une erreur serveur est survenue. Réessayez.');
			}
			// Apply the action result (and re-run load) except on a hard error.
			if (result.type !== 'error') await update({ reset: resetOnSuccess });
		};
	};
}
