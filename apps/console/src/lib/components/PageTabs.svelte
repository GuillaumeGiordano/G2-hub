<script lang="ts">
	import { page } from '$app/state';

	// A tab bar of links to sibling routes. The active tab is the one whose href is the longest
	// prefix of the current path (so "/mon-compte" stays inactive on "/mon-compte/securite").
	let { tabs }: { tabs: { label: string; href: string }[] } = $props();

	function matchLen(href: string): number {
		const p = page.url.pathname;
		if (p === href || p.startsWith(href + '/')) return href.length;
		return -1;
	}
	const activeHref = $derived.by(() => {
		let best = '';
		let bestLen = -1;
		for (const t of tabs) {
			const l = matchLen(t.href);
			if (l > bestLen) {
				bestLen = l;
				best = t.href;
			}
		}
		return best;
	});
</script>

<div class="tabs">
	{#each tabs as t (t.href)}
		<a class="tab" class:active={t.href === activeHref} href={t.href}>{t.label}</a>
	{/each}
</div>

<style>
	.tabs {
		display: flex;
		gap: 2px;
		border-bottom: 1px solid var(--border);
		margin-bottom: 22px;
		overflow-x: auto;
		overflow-y: hidden;
		scrollbar-width: thin;
	}
	.tab {
		padding: 10px 16px;
		font-size: 14px;
		font-weight: 500;
		color: var(--text-muted);
		text-decoration: none;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		white-space: nowrap;
	}
	.tab:hover {
		color: var(--text-base);
	}
	.tab.active {
		color: var(--primary);
		border-bottom-color: var(--primary);
		font-weight: 600;
	}
</style>
