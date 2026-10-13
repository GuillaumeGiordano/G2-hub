<script lang="ts">
	import type { Snippet } from 'svelte';
	import AppShell from '$lib/components/layout/AppShell.svelte';
	import type { LayoutData } from './$types';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();
</script>

<AppShell hubName={data.hubName} user={data.user}>
	{@render children()}
</AppShell>
