import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import { checkbox, parseForm, requiredString, zodErrors } from '$lib/validation';
import { accountCreateSchema, accountOrganizationsSchema, accountUpdateSchema } from '$lib/schemas/member';
import { isSuperadmin } from '$lib/records/roles';
import { DEFAULT_PER_PAGE } from '$lib/constants';
import { actionFailure } from '$lib/server/http';
import * as accounts from '$lib/server/services/consoleAccountService';
import type { Actions, PageServerLoad } from './$types';

// The console's « Membres » (DECISIONS.md §35): every console account and its organizations — the
// superadmin's page (the service answers 403 to anyone else; the hook guarantees a signed-in user).
const userSchema = z.object({ userId: requiredString() });
const disableSchema = z.object({ userId: requiredString(), disabled: checkbox() });

const actorOf = (locals: App.Locals) => ({ id: locals.user!.id, isSuperadmin: isSuperadmin(locals.user!.role) });

/** A form whose `organizationIds` are posted as one field each (SelectSearchMulti). */
function withOrganizations(form: FormData): Record<string, unknown> {
	return { ...Object.fromEntries(form), organizationIds: form.getAll('organizationIds').map(String).filter(Boolean) };
}

function parseWithOrganizations<S extends z.ZodType>(form: FormData, schema: S) {
	const result = schema.safeParse(withOrganizations(form));
	return result.success
		? ({ success: true, data: result.data } as const)
		: ({ success: false, errors: zodErrors(result.error) } as const);
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const actor = actorOf(locals);
	if (!actor.isSuperadmin) error(403, 'Réservé au superadmin.');
	const search = url.searchParams.get('q')?.trim() || undefined;
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const perPage = Number(url.searchParams.get('perPage')) || DEFAULT_PER_PAGE;
	const [{ items, total }, organizations] = await Promise.all([
		accounts.listAccounts(actor, { search, page, perPage }),
		accounts.organizationOptions(actor)
	]);
	return { items, total, page, perPage, organizations, searching: !!search };
};

/** Run a one-account action, answering `{ [key]: <its e-mail> }`. */
async function accountAction(request: Request, key: string, run: (userId: string) => Promise<string>) {
	const parsed = parseForm(await request.formData(), userSchema);
	if (!parsed.success) return fail(400, { message: 'Compte introuvable.' });
	try {
		return { [key]: await run(parsed.data.userId) };
	} catch (err) {
		return actionFailure(err);
	}
}

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const parsed = parseWithOrganizations(await request.formData(), accountCreateSchema);
		if (!parsed.success) return fail(400, { errors: parsed.errors });
		try {
			return { added: await accounts.createAccount(actorOf(locals), parsed.data) };
		} catch (err) {
			return actionFailure(err);
		}
	},

	organizations: async ({ request, locals }) => {
		const parsed = parseWithOrganizations(await request.formData(), accountOrganizationsSchema);
		if (!parsed.success) return fail(400, { errors: parsed.errors });
		try {
			const { userId, organizationIds } = parsed.data;
			return { saved: await accounts.setAccountOrganizations(actorOf(locals), userId, organizationIds) };
		} catch (err) {
			return actionFailure(err);
		}
	},

	update: async ({ request, locals }) => {
		const parsed = parseForm(await request.formData(), accountUpdateSchema);
		if (!parsed.success) return fail(400, { errors: parsed.errors });
		try {
			const { userId, ...input } = parsed.data;
			return { updated: await accounts.updateAccount(actorOf(locals), userId, input) };
		} catch (err) {
			return actionFailure(err);
		}
	},

	resend: ({ request, locals }) => accountAction(request, 'resent', (id) => accounts.resendAccountInvitation(actorOf(locals), id)),
	reset: ({ request, locals }) => accountAction(request, 'reset', (id) => accounts.sendAccountPasswordReset(actorOf(locals), id)),
	revoke: ({ request, locals }) => accountAction(request, 'revoked', (id) => accounts.revokeAccountSessions(actorOf(locals), id)),
	twoFactor: ({ request, locals }) => accountAction(request, 'twoFactorReset', (id) => accounts.resetAccountTwoFactor(actorOf(locals), id)),
	delete: ({ request, locals }) => accountAction(request, 'deleted', (id) => accounts.deleteAccount(actorOf(locals), id)),

	disable: async ({ request, locals }) => {
		const parsed = parseForm(await request.formData(), disableSchema);
		if (!parsed.success) return fail(400, { message: 'Compte introuvable.' });
		try {
			const { userId, disabled } = parsed.data;
			await accounts.setAccountDisabled(actorOf(locals), userId, disabled);
			return { disabled };
		} catch (err) {
			return actionFailure(err);
		}
	}
};
