// Single source of truth for the console navigation. The AppShell filters it for the current user
// and renders the @guillaumeg/ui <Sidebar> (desktop) and the mobile drawer. Add a link HERE only.
import type { Component } from 'svelte';
import { orgPath } from '$lib/utils/orgPath';
import { AppWindow, Building, Building2, LayoutDashboard, LayoutGrid, ShieldCheck, Users } from '@lucide/svelte';

/** What the current user can reach — decides which links show. */
export type NavContext = {
	/** The instance operator: the only one who sees the list of organizations (§31). */
	isSuperadmin: boolean;
	/** An organization is open (the one of the address, or the last one opened). */
	hasOrganization: boolean;
	/** Its id: the organization's pages live under /o/<id>/… */
	organizationId: string | null;
	/** How many organizations the account belongs to (an Admin of several gets « Mes organisations »). */
	membershipCount: number;
	/** How many applications the active organization has. */
	applicationCount: number;
	/** Its only application, when it has exactly one (« Mon application » opens it). */
	singleApplicationId: string | null;
};

export type NavItem = {
	/** Fixed, or computed from the context (« Mon application » / « Mes applications »). */
	label: string | ((ctx: NavContext) => string);
	href: string | ((ctx: NavContext) => string);
	icon: Component;
	/** How the active state is computed from the current path. Default: 'prefix'. */
	match?: 'exact' | 'prefix';
	/** Other paths that light the item up (« Organisations » while an organization is open). */
	alsoActive?: string[];
	visible?: (ctx: NavContext) => boolean;
};

export type NavSection = {
	label: string;
	visible?: (ctx: NavContext) => boolean;
	items: NavItem[];
};

export const NAV: NavSection[] = [
	{
		label: 'Console',
		items: [
			// An Admin's dashboard is its organization's; the superadmin's is the console's.
			{ label: 'Tableau de bord', href: dashboardHref, icon: LayoutDashboard, match: 'exact' },
			// The rare Admin of several organizations switches here (§36), with or without one open.
			{
				label: 'Mes organisations',
				href: '/mes-organisations',
				icon: Building2,
				visible: (ctx) => !ctx.isSuperadmin && ctx.membershipCount > 1
			},
			{
				label: 'Organisations',
				href: '/organisations',
				icon: Building2,
				visible: (ctx) => ctx.isSuperadmin,
				alsoActive: ['/o']
			},
			// Every console account, with its organizations (§35).
			{ label: 'Membres', href: '/membres', icon: Users, visible: (ctx) => ctx.isSuperadmin }
		]
	},
	{
		// An Admin's organization. The superadmin reaches an organization's pages through its tabs (§34).
		label: 'Organisation',
		visible: (ctx) => ctx.hasOrganization && !ctx.isSuperadmin,
		items: [
			{ label: 'Mon organisation', href: (ctx) => orgPath(ctx.organizationId!, '/informations'), icon: Building },
			{ label: applicationsLabel, href: applicationsHref, icon: AppWindow },
			// The client portal and the tools of the platform enabled for this organization (§38).
			{ label: 'Outils', href: (ctx) => orgPath(ctx.organizationId!, '/outils'), icon: LayoutGrid },
			// Console accounts are the superadmin's (§32).
		]
	},
	{
		// An Admin finds its password and 2FA in « Mon organisation › Sécurité » (§33).
		label: 'Mon compte',
		visible: (ctx) => ctx.isSuperadmin,
		items: [{ label: 'Sécurité', href: '/securite', icon: ShieldCheck }]
	}
];

/** The superadmin manages « Applications »; an Admin sees « Mon application » (straight to it) when
 *  it has only one, « Mes applications » otherwise. */
function applicationsLabel(ctx: NavContext): string {
	if (ctx.isSuperadmin) return 'Applications';
	return ctx.singleApplicationId ? 'Mon application' : 'Mes applications';
}

function applicationsHref(ctx: NavContext): string {
	const org = ctx.organizationId!;
	return !ctx.isSuperadmin && ctx.singleApplicationId
		? orgPath(org, `/applications/${ctx.singleApplicationId}`)
		: orgPath(org, '/applications');
}

function dashboardHref(ctx: NavContext): string {
	return !ctx.isSuperadmin && ctx.organizationId ? orgPath(ctx.organizationId) : '/';
}

/** A nav item with its label and href computed for `ctx`. */
export function resolveNavItem(item: NavItem, ctx: NavContext): { label: string; href: string } {
	return {
		label: typeof item.label === 'function' ? item.label(ctx) : item.label,
		href: typeof item.href === 'function' ? item.href(ctx) : item.href
	};
}

/** Tabs of one application's pages (« Fichiers » and « Utilisateurs » — with the Auth offer, §12 —
 *  for every member; « Clés API » and « Connexion » only for those who manage applications). */
export function applicationTabs(organizationId: string, applicationId: string, canManage: boolean, authEnabled: boolean) {
	const base = orgPath(organizationId, `/applications/${applicationId}`);
	return [
		{ label: 'Fichiers', href: base },
		...(authEnabled ? [{ label: 'Utilisateurs', href: `${base}/utilisateurs` }] : []),
		...(canManage
			? [
					{ label: 'Clés API', href: `${base}/cles` },
					{ label: 'Connexion', href: `${base}/connexion` }
				]
			: [])
	];
}

/** True when a nav item (resolved href) matches the current path. */
export function isNavItemActive(
	item: { href: string; match?: NavItem['match']; alsoActive?: string[] },
	pathname: string
): boolean {
	const under = (href: string) => pathname === href || pathname.startsWith(href + '/');
	if (item.alsoActive?.some(under)) return true;
	return item.match === 'exact' ? pathname === item.href : under(item.href);
}

/** Tabs of an organization for the superadmin (§34): its pages, under its header. */
export function superadminOrganizationTabs(organizationId: string) {
	return [
		{ label: 'Informations', href: orgPath(organizationId, '/informations') },
		{ label: 'Membres', href: orgPath(organizationId, '/membres') },
		{ label: 'Applications', href: orgPath(organizationId, '/applications') },
		{ label: 'Outils', href: orgPath(organizationId, '/outils') },
		{ label: 'Stockage', href: orgPath(organizationId) }
	];
}

/** Tabs of « Mon organisation » for an Admin (§33). */
export function organizationTabs(organizationId: string) {
	return [
		{ label: 'Informations', href: orgPath(organizationId, '/informations') },
		{ label: 'Sécurité', href: orgPath(organizationId, '/securite') }
	];
}
