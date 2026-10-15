// Single source of truth for the console navigation. The AppShell filters it for the current user
// and renders the @guillaumeg/ui <Sidebar> (desktop) and the mobile drawer. Add a link HERE only.
import type { Component } from 'svelte';
import { AppWindow, Building, Building2, LayoutDashboard, ShieldCheck, Users } from '@lucide/svelte';

/** What the current user can reach — decides which links show. */
export type NavContext = {
	/** The instance operator: the only one who sees the list of organizations (§31). */
	isSuperadmin: boolean;
	/** An organization is active in the session. */
	hasOrganization: boolean;
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
			{ label: 'Tableau de bord', href: '/', icon: LayoutDashboard, match: 'exact' },
			{ label: 'Organisations', href: '/organisations', icon: Building2, visible: (ctx) => ctx.isSuperadmin }
		]
	},
	{
		label: 'Organisation',
		visible: (ctx) => ctx.hasOrganization,
		items: [
			{ label: 'Mon organisation', href: '/mon-organisation', icon: Building },
			{ label: applicationsLabel, href: applicationsHref, icon: AppWindow },
			// Console accounts are the superadmin's (§32).
			{ label: 'Membres', href: '/membres', icon: Users, visible: (ctx) => ctx.isSuperadmin }
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
	return !ctx.isSuperadmin && ctx.singleApplicationId ? `/applications/${ctx.singleApplicationId}` : '/applications';
}

/** A nav item with its label and href computed for `ctx`. */
export function resolveNavItem(item: NavItem, ctx: NavContext): { label: string; href: string } {
	return {
		label: typeof item.label === 'function' ? item.label(ctx) : item.label,
		href: typeof item.href === 'function' ? item.href(ctx) : item.href
	};
}

/** Tabs of one application's pages (« Fichiers » and « Utilisateurs » for every member; « Clés
 *  API » and « Connexion » only for those who manage applications). */
export function applicationTabs(applicationId: string, canManage: boolean) {
	const base = `/applications/${applicationId}`;
	return [
		{ label: 'Fichiers', href: base },
		{ label: 'Utilisateurs', href: `${base}/utilisateurs` },
		...(canManage
			? [
					{ label: 'Clés API', href: `${base}/cles` },
					{ label: 'Connexion', href: `${base}/connexion` }
				]
			: [])
	];
}

/** True when a nav item (resolved href) matches the current path. */
export function isNavItemActive(item: { href: string; match?: NavItem['match'] }, pathname: string): boolean {
	return item.match === 'exact'
		? pathname === item.href
		: pathname === item.href || pathname.startsWith(item.href + '/');
}

/** Tabs of « Mon organisation » (§33). */
export const organizationTabs = [
	{ label: 'Informations', href: '/mon-organisation' },
	{ label: 'Sécurité', href: '/mon-organisation/securite' }
];
