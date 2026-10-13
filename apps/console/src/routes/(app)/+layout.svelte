<script lang="ts">
	import type { Snippet } from 'svelte';
	import AppShell from '$lib/components/layout/AppShell.svelte';
	import type { LayoutData } from './$types';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();
</script>

<AppShell hubName={data.hubName} organizationName={data.organization?.name ?? null} user={data.user} nav={data.nav}>
	{@render children()}
</AppShell>
