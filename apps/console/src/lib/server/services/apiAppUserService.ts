import * as userRepo from '$lib/server/repositories/appUserRepository';
import { ApiError, requireSecret, type ApiContext } from '$lib/server/api/auth';
import { appUserInviteSchema } from '$lib/schemas/appUser';
import { firstIssue } from '$lib/schemas/apiFile';
import { invite, type InvitedAppUser } from './appUserService';

// Users of the key's application, managed by the client's SERVER (secret key) — e.g. its back-office
// invites a new member (DECISIONS.md §24). Same rules as the console invitation.

/** POST /api/v1/users — invite someone: the account is created and the invitation e-mailed. */
export async function inviteUser(ctx: ApiContext, body: unknown): Promise<InvitedAppUser> {
	requireSecret(ctx);
	if (!ctx.authEnabled) throw new ApiError(403, "L'offre Auth n'est pas activée pour cette organisation.");
	const parsed = appUserInviteSchema.safeParse(body);
	if (!parsed.success) throw new ApiError(400, firstIssue(parsed.error));
	const app = await userRepo.findApplicationName(ctx.applicationId);
	if (!app) throw new ApiError(404, 'Application introuvable.');
	return invite(
		{ organizationId: ctx.organizationId, applicationId: app.id, applicationName: app.name, invitedById: null },
		parsed.data
	);
}
