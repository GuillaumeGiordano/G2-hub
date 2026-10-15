// Single source of truth for the console navigation. The AppShell filters it for the current user
// and renders the @guillaumeg/ui <Sidebar> (desktop) and the mobile drawer. Add a link HERE only.
import type { Component } from 'svelte';
import { AppWindow, Building2, HardDrive, LayoutDashboard, ShieldCheck, Users } from '@lucide/svelte';

/** What the current user can reach — decides which links show. */
export type NavContext = {
	/** An organization is active in the session. */
	hasOrganization: boolean;
	/** May manage the members of the active organization (owner or superadmin). */
	canManageMembers: boolean;
	/** The active organization subscribed to the storage option (« Accès + Stockage », §12). */
	storageEnabled: boolean;
};

export type NavItem = {
	label: string;
	href: string;
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
			{ label: 'Organisations', href: '/organisations', icon: Building2 }
		]
	},
	{
		label: 'Organisation',
		visible: (ctx) => ctx.hasOrganization,
		items: [
			{ label: 'Applications', href: '/applications', icon: AppWindow },
			{ label: 'Stockage', href: '/stockage', icon: HardDrive, visible: (ctx) => ctx.storageEnabled },
			{ label: 'Membres', href: '/membres', icon: Users, visible: (ctx) => ctx.canManageMembers }
		]
	},
	{
		label: 'Mon compte',
		items: [{ label: 'Sécurité', href: '/securite', icon: ShieldCheck }]
	}
];

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

/** True when a nav item matches the current path. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
	return item.match === 'exact'
		? pathname === item.href
		: pathname === item.href || pathname.startsWith(item.href + '/');
}
