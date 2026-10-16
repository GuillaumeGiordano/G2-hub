import * as platformRepo from '$lib/server/repositories/platformRepository';
import type { OrgContext } from '$lib/server/context';
import { forbidden, notFound } from '$lib/server/errors';
import { ORGANIZATION_PARAM } from '$lib/records/sso';
import type { PlatformAccess } from '$lib/records/platform';
import type { LauncherItem, OrganizationToolItem, PlatformSettings } from '$lib/viewmodels/platform';

// Applications of the platform (DECISIONS.md §38): the client portal (every Admin) and the tools
// (enabled per organization). The superadmin sets them; an Admin only opens them, from the
// « Outils » launcher of the organization open — a tool is always opened FOR that organization.

function assertSuperadmin(ctx: OrgContext): void {
	if (!ctx.isSuperadmin) throw forbidden();
}

/** The launcher's link: a tool learns which organization it is opened for (`?organization=`) and
 *  passes it on to « Se connecter avec G2 Hub », which checks it. */
function launchUrl(homeUrl: string, organizationId: string | null): string {
	const url = new URL(homeUrl);
	if (organizationId) url.searchParams.set(ORGANIZATION_PARAM, organizationId);
	return url.toString();
}

// ─── An application of the open organization (superadmin) ───────────────────

export async function getPlatformSettings(ctx: OrgContext, applicationId: string): Promise<PlatformSettings> {
	assertSuperadmin(ctx);
	const app = await platformRepo.findPlatformSettings(ctx.organization.id, applicationId);
	if (!app) throw notFound('Application introuvable.');
	return { platformAccess: app.platformAccess, homeUrl: app.homeUrl };
}

export async function updatePlatformSettings(
	ctx: OrgContext,
	applicationId: string,
	input: { platformAccess: PlatformAccess; homeUrl?: string }
): Promise<void> {
	assertSuperadmin(ctx);
	const data = { platformAccess: input.platformAccess, homeUrl: input.homeUrl ?? null };
	if (!(await platformRepo.updatePlatformSettings(ctx.organization.id, applicationId, data))) {
		throw notFound('Application introuvable.');
	}
}

// ─── The tools of the open organization ──────────────────────────────────────

/** Every tool of the instance, enabled or not for this organization (superadmin). */
export async function listOrganizationTools(ctx: OrgContext): Promise<OrganizationToolItem[]> {
	assertSuperadmin(ctx);
	const tools = await platformRepo.listTools(ctx.organization.id);
	return tools.map((t) => {
		const owned = t.organizationId === ctx.organization.id;
		return {
			id: t.id,
			name: t.name,
			ownerName: t.organization.name,
			enabled: owned || t.enabledFor.length > 0,
			owned,
			url: t.homeUrl ? launchUrl(t.homeUrl, ctx.organization.id) : null
		};
	});
}

/** Enable a tool for an organization — the single entry point, which the management tool will
 *  call through the internal API once orders / contracts decide it. Returns the tool's name. */
export async function enableTool(organizationId: string, applicationId: string): Promise<string> {
	const tool = await platformRepo.findTool(applicationId);
	if (!tool) throw notFound('Outil introuvable.');
	await platformRepo.enableTool(organizationId, tool.id);
	return tool.name;
}

/** Disable it: the connections already open for this organization stop at their next check
 *  (oidcService re-reads the grant at every use of a code or token). */
export async function disableTool(organizationId: string, applicationId: string): Promise<string> {
	const tool = await platformRepo.findTool(applicationId);
	if (!tool) throw notFound('Outil introuvable.');
	await platformRepo.disableTool(organizationId, tool.id);
	return tool.name;
}

export async function setToolEnabled(ctx: OrgContext, applicationId: string, enabled: boolean): Promise<string> {
	assertSuperadmin(ctx);
	return enabled ? enableTool(ctx.organization.id, applicationId) : disableTool(ctx.organization.id, applicationId);
}

/** The « Outils » launcher of the open organization: the client portal and its tools (every tool
 *  for the superadmin). */
export async function launcher(ctx: OrgContext): Promise<LauncherItem[]> {
	const apps = await platformRepo.listLauncherApplications(ctx.organization.id, ctx.isSuperadmin);
	return apps.map((a) => {
		const tool = a.platformAccess === 'PER_ORGANIZATION';
		return {
			id: a.id,
			name: a.name,
			kind: tool ? 'tool' : 'portal',
			url: launchUrl(a.homeUrl!, tool ? ctx.organization.id : null)
		};
	});
}
