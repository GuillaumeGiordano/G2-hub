import { z } from 'zod';

// Form validation for server actions, built on Zod. Framework-agnostic: `parseForm`
// returns a plain result, so callers decide how to react (SvelteKit `fail`, etc.).
// Reusable field builders keep per-feature schemas short and consistent.

/** Trimmed, non-empty text. */
export const requiredString = (msg = 'Ce champ est requis') => z.string().trim().min(1, msg);

/** Trimmed text that may be omitted or empty (normalized to undefined). */
export const optionalString = () =>
	z
		.string()
		.trim()
		.optional()
		.transform((v) => (v ? v : undefined));

/** Email address. */
export const email = (msg = 'Adresse e-mail invalide') => z.email(msg);

/** Optional email (trimmed; empty → undefined); a typed value must be a valid address. */
export const optionalEmail = (msg = 'Adresse e-mail invalide') =>
	optionalString().refine((v) => v === undefined || z.email().safeParse(v).success, msg);

/** URL-friendly slug: lowercase letters, digits and hyphens. */
export const slug = (msg = 'Slug invalide (minuscules, chiffres et tirets)') =>
	z
		.string()
		.trim()
		.min(1)
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, msg);

/** Checkbox / switch: HTML sends "on" when checked, nothing when not. */
export const checkbox = () =>
	z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean());

/** Integer from a text field (e.g. quantity). */
export const intField = (msg = 'Nombre entier requis') => z.coerce.number(msg).int(msg);

/** A field posting JSON (e.g. a tag list serialized into one hidden input), decoded then
 *  validated by `schema`: its errors keep their path under the field (`origins.2`).
 *  Unreadable JSON becomes `undefined`, so it fails with the schema's own type message. */
export const jsonField = <S extends z.ZodType>(schema: S) =>
	z.preprocess((v) => {
		if (typeof v !== 'string') return v;
		try {
			return JSON.parse(v);
		} catch {
			return undefined;
		}
	}, schema);

export type ParseResult<T> =
	| { success: true; data: T }
	| { success: false; errors: Record<string, string> };

/**
 * Validate `FormData` against a schema. On failure returns the first message per field,
 * keyed by its dotted path (`name`, or `lines.2.unitPrice` for a nested field) — ready to
 * render next to inputs.
 */
export function parseForm<S extends z.ZodType>(
	formData: FormData,
	schema: S
): ParseResult<z.infer<S>> {
	const result = schema.safeParse(Object.fromEntries(formData));
	if (result.success) return { success: true, data: result.data };
	return { success: false, errors: zodErrors(result.error) };
}

/** A Zod error → the first message per field, keyed by its dotted path, optionally under a
 *  `prefix` (`lines` → `lines.2.unitPrice` for a JSON-posted array of lines). */
export function zodErrors(error: z.ZodError, prefix?: string): Record<string, string> {
	const errors: Record<string, string> = {};
	for (const issue of error.issues) {
		const path = issue.path.filter((p) => typeof p !== 'symbol');
		const key = (prefix ? [prefix, ...path] : path).join('.');
		if (key && !(key in errors)) errors[key] = issue.message;
	}
	return errors;
}
