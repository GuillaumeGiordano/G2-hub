import { tick } from 'svelte';
import type { z } from 'zod';
import { zodErrors } from '$lib/validation';

/**
 * Per-form field errors returned by a server action as `fail(400, { errors: { field: message } })`
 * (see `parseForm`). One instance per form — not the page-wide `form` prop — so the errors of a
 * create modal never show in an edit modal, and are cleared when a modal is reopened.
 *
 * It is given the fields the form DISPLAYS: an error on any other key (a hidden `id`…) has no
 * input to show under, so `set()` hands it back to be toasted instead of silently dropping it.
 *
 * Given the action's Zod `schema` (shared from `$lib/schemas/`), it also validates in the browser:
 * a field is checked when it loses focus after being edited, a field in error is re-checked on
 * every keystroke, and `toastEnhance` cancels the submit while the form is invalid. The server
 * still validates everything — this only saves a round trip. A form whose fields depend on its
 * mode (create vs edit) passes a function: `() => (editing ? updateSchema : createSchema)`.
 *
 * A cell without `name` (a composer line, posted as JSON in a hidden input) declares its error key
 * on itself or a wrapper: `<div data-field="lines.{i}.unitPrice">` — checked like a named field.
 *
 * ```svelte
 * const fields = new FieldErrors(['name'], jobSchema);
 * <form novalidate use:enhance={toastEnhance({ success: 'Enregistré.', fields })}
 *       oninput={fields.oninput} onfocusout={fields.onfocusout}>
 *   <Input name="name" error={fields.get('name')} />
 * ```
 */
export class FieldErrors {
	errors = $state<Record<string, string>>({});

	/** `shown`: names of the fields rendered with `error={fields.get(name)}`. A name ending in `.*`
	 *  covers a nested group (`lines.*` → `lines.0.label`, `lines.3.unitPrice`…). */
	private readonly shown: string[];
	private readonly schema: FormSchema | undefined;
	/** Fields edited since the form was (re)opened: only those are checked on focus loss, so
	 *  tabbing through an empty form does not light it up in red. A plain Set: never rendered,
	 *  so it needs no reactivity. */
	private readonly dirty = new Set<string>();

	constructor(shown: string[], schema?: FormSchema) {
		this.shown = shown;
		this.schema = schema;
	}

	/** The schema of the form's current mode (undefined: the server validates alone). */
	private currentSchema(): z.ZodType | undefined {
		return typeof this.schema === 'function' ? this.schema() : this.schema;
	}

	private isShown(key: string): boolean {
		return this.shown.some((s) => (s.endsWith('.*') ? key.startsWith(s.slice(0, -1)) : key === s));
	}

	/** The field's message, or '' (the empty `error` prop of the UI inputs). */
	get(name: string): string {
		return this.errors[name] ?? '';
	}

	has(): boolean {
		return Object.keys(this.errors).length > 0;
	}

	/** Keep the errors of the shown fields; return the messages of the others (to toast). */
	set(errors: unknown): string[] {
		const kept: Record<string, string> = {};
		const others: string[] = [];
		if (isStringRecord(errors)) {
			for (const [key, message] of Object.entries(errors)) {
				if (this.isShown(key)) kept[key] = message;
				else others.push(message);
			}
		}
		this.errors = kept;
		return others;
	}

	/** Clear one field (when edited) or all of them (when the form is reopened or succeeds). */
	clear(name?: string): void {
		if (name === undefined) {
			this.errors = {};
			this.dirty.clear();
		} else if (name in this.errors) delete this.errors[name];
	}

	/** Clear every error under a prefix, e.g. `lines.2.` when that line is edited (its cells have no
	 *  `name`: the lines are posted as JSON), or `lines.` when a line is removed (indexes shift). */
	clearGroup(prefix: string): void {
		for (const key of Object.keys(this.errors)) {
			if (key.startsWith(prefix)) delete this.errors[key];
		}
	}

	/** The schema's errors on the shown fields ({} without a schema or when valid). Errors on
	 *  hidden fields are ignored: the user cannot fix them, the server will answer. */
	private check(formData: FormData): Record<string, string> {
		const schema = this.currentSchema();
		if (!schema) return {};
		const result = schema.safeParse(Object.fromEntries(formData));
		if (result.success) return {};
		const errors: Record<string, string> = {};
		for (const [key, message] of Object.entries(zodErrors(result.error))) {
			if (this.isShown(key)) errors[key] = message;
		}
		return errors;
	}

	/** Re-check one field against the schema: show its message, or clear it when valid. Waits for
	 *  the DOM update first, so a JSON hidden input derived from the edited state is current. */
	private async checkField(form: HTMLFormElement, name: string): Promise<void> {
		await tick();
		const message = this.check(new FormData(form))[name];
		if (message) this.errors[name] = message;
		else this.clear(name);
	}

	/** Validate the whole form before it is posted; show every error and return false when invalid.
	 *  Without a schema it always returns true (the server validates alone). */
	validate(formData: FormData): boolean {
		if (!this.currentSchema()) return true;
		const errors = this.check(formData);
		this.errors = errors;
		return Object.keys(errors).length === 0;
	}

	/** Form-level `oninput` / `onchange` handler. Without a schema, editing a field clears its error;
	 *  with one, a field already in error is re-checked (cleared as soon as it is fixed). Input
	 *  events bubble, so one listener on the `<form>` covers every field. */
	oninput = (event: Event): void => {
		const name = fieldName(event);
		if (!name) return;
		this.dirty.add(name);
		const form = (event.currentTarget as HTMLFormElement | null) ?? null;
		if (this.currentSchema() && form && name in this.errors) this.checkField(form, name);
		else this.clear(name);
	};

	/** Form-level `onfocusout` handler: check an edited field when the user leaves it ("reward
	 *  early, punish late": no error while still typing). `focusout` bubbles, unlike `blur`. */
	onfocusout = (event: FocusEvent): void => {
		const name = fieldName(event);
		const form = event.currentTarget as HTMLFormElement | null;
		if (!this.currentSchema() || !form || !name || !this.dirty.has(name)) return;
		this.checkField(form, name);
	};
}

/** A Zod schema, or a function giving the one of the form's current mode (none: no live check). */
type FormSchema = z.ZodType | (() => z.ZodType | undefined);

/** The edited field's error key: its `name`, else the `data-field` of the cell wrapping it. */
function fieldName(event: Event): string | undefined {
	const target = event.target as (Element & { name?: unknown }) | null;
	if (typeof target?.name === 'string' && target.name) return target.name;
	return target?.closest?.('[data-field]')?.getAttribute('data-field') || undefined;
}

function isStringRecord(value: unknown): value is Record<string, string> {
	return (
		typeof value === 'object' &&
		value !== null &&
		Object.values(value).every((v) => typeof v === 'string')
	);
}
