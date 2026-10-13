// Single source of truth for the console navigation. The AppShell filters it for the current user
// and renders the @guillaumeg/ui <Sidebar> (desktop) and the mobile drawer. Add a link HERE only.
import type { Component } from 'svelte';
import { LayoutDashboard, ShieldCheck } from '@lucide/svelte';

export type NavItem = {
	label: string;
	href: string;
	icon: Component;
	/** How the active state is computed from the current path. Default: 'prefix'. */
	match?: 'exact' | 'prefix';
};

export type NavSection = {
	label: string;
	/** Only the superadmin sees this section. */
	superadminOnly?: boolean;
	items: NavItem[];
};

export const NAV: NavSection[] = [
	{
		label: 'Console',
		items: [{ label: 'Tableau de bord', href: '/', icon: LayoutDashboard, match: 'exact' }]
	},
	{
		label: 'Mon compte',
		items: [{ label: 'Sécurité', href: '/securite', icon: ShieldCheck }]
	}
];

/** True when a nav item matches the current path. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
	return item.match === 'exact'
		? pathname === item.href
		: pathname === item.href || pathname.startsWith(item.href + '/');
}
