<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { theme, Toaster } from '@guillaumeg/ui';
	import type { LayoutData } from './$types';
	import '../app.css';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();

	onMount(() => theme.init());
</script>

<svelte:head>
	<title>{data.hubName}</title>
</svelte:head>

{@render children()}

<Toaster />
