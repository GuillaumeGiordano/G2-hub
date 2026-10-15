<script lang="ts">
	import type { Snippet } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { LogOut, Menu, Network } from '@lucide/svelte';
	import { Button, Modal, Sidebar, StandardLayout, ThemeToggle } from '@guillaumeg/ui';
	import { isNavItemActive, NAV, resolveNavItem, type NavContext } from '$lib/records/navigation';
	import { labelForRole } from '$lib/records/roles';
	import { authClient } from '$lib/auth-client';

	let {
		hubName,
		organizationName,
		user,
		nav,
		children
	}: {
		hubName: string;
		/** The active organization, shown under the hub name (null: none selected). */
		organizationName: string | null;
		user: { name: string; role?: string | null };
		nav: NavContext;
		children: Snippet;
	} = $props();

	const groups = $derived(
		NAV.filter((section) => section.visible?.(nav) ?? true).map((section) => ({
			label: section.label,
			items: section.items
				.filter((item) => item.visible?.(nav) ?? true)
				.map((item) => {
					const { label, href } = resolveNavItem(item, nav);
					return { label, href, icon: item.icon, active: isNavItemActive({ href, match: item.match }, page.url.pathname) };
				})
		}))
	);

	async function logout() {
		await authClient.signOut();
		window.location.href = '/login';
	}

	// Mobile / tablet (< 1024px): the sidebar is hidden and the same navigation opens in a
	// full-screen drawer from the top bar's burger. It closes after every navigation.
	const MOBILE_NAV_ID = 'mobile-nav';
	function mobileNav() {
		return document.getElementById(MOBILE_NAV_ID) as HTMLDialogElement | null;
	}
	afterNavigate(() => mobileNav()?.close());
</script>

{#snippet brand()}
	<div class="brand">
		<span class="brand-logo"><Network size={20} /></span>
		<div class="brand-text">
			<div class="brand-name">{hubName}</div>
			<div class="brand-sub">{organizationName ?? 'Aucune organisation'}</div>
		</div>
	</div>
{/snippet}

{#snippet userFooter()}
	<div class="foot">
		<div class="user">
			<span class="user-name">{user.name}</span>
			<span class="user-role">{labelForRole(user.role)}</span>
		</div>
		<div class="foot-actions">
			<Button variant="ghost" size="sm" icon={LogOut} onclick={logout}>Déconnexion</Button>
			<ThemeToggle />
		</div>
	</div>
{/snippet}

<div class="shell">
	<header class="topbar">
		{@render brand()}
		<Button
			variant="ghost"
			icon={Menu}
			aria-label="Ouvrir le menu"
			aria-haspopup="dialog"
			onclick={() => mobileNav()?.showModal()}
		/>
	</header>

	<StandardLayout hasSidebar={true}>
		{#snippet sidebar()}
			<Sidebar {groups} activeHref={page.url.pathname} fill collapsible={false}>
				{#snippet header()}
					{@render brand()}
				{/snippet}
				{#snippet footer()}
					{@render userFooter()}
				{/snippet}
			</Sidebar>
		{/snippet}

		{#snippet main()}
			{@render children()}
		{/snippet}
	</StandardLayout>
</div>

<Modal id={MOBILE_NAV_ID} title="Menu" variant="drawer" overlayClose>
	<div class="drawer-nav">
		<Sidebar {groups} activeHref={page.url.pathname} collapsible={false}>
			{#snippet footer()}
				{@render userFooter()}
			{/snippet}
		</Sidebar>
	</div>
</Modal>

<style>
	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px 12px;
	}
	.brand-logo {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-md);
		background: var(--primary-subtle);
		color: var(--primary);
		flex-shrink: 0;
	}
	.brand-text {
		min-width: 0;
	}
	.brand-name {
		font-size: 15px;
		font-weight: 700;
		color: var(--text-heading);
		white-space: nowrap;
	}
	.brand-sub {
		font-size: 11px;
		color: var(--text-subtle);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.foot {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px;
	}
	.user {
		display: flex;
		flex-direction: column;
		padding: 2px 4px;
	}
	.user-name {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-base);
		white-space: nowrap;
	}
	.user-role {
		font-size: 11px;
		color: var(--text-subtle);
		white-space: nowrap;
	}
	.foot-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	/* Mobile top bar — only below the desktop breakpoint. */
	.topbar {
		display: none;
	}

	/* The mobile menu takes the whole screen (the drawer variant caps its panel at 440px). The id
	   outranks the library's scoped `.drawer .panel` rule. */
	:global(#mobile-nav .panel) {
		width: 100dvw;
		border: none;
		border-radius: 0;
	}
	:global(#mobile-nav .panel-body) {
		overscroll-behavior: contain;
	}

	/* A modal <dialog> makes the page inert but does not stop it scrolling: lock it while open. */
	:global(html:has(#mobile-nav[open])) {
		overflow: hidden;
	}

	/* The drawer hosts the same <Sidebar>, stretched to the panel (its own padding removed). */
	.drawer-nav {
		display: flex;
		height: calc(100% + 40px);
		margin: -20px;
	}
	.drawer-nav :global(.sidebar) {
		width: 100%;
		border-right: none;
		background: transparent;
	}

	/* A flex child does not shrink below its content by default: without this, a wide table
	   widens the whole page instead of scrolling inside its wrapper. */
	.shell :global(.layout-main) {
		min-width: 0;
	}

	@media (max-width: 1023px) {
		.topbar {
			position: sticky;
			top: 0;
			z-index: 40;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;
			padding-right: 8px;
			background: var(--bg-subtle);
			border-bottom: 1px solid var(--border);
		}
		.topbar .brand {
			padding: 10px 12px;
		}
		.shell :global(.layout-sidebar) {
			display: none;
		}
		.shell :global(.layout-main) {
			padding: 16px;
		}
	}
</style>
