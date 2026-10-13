<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { theme } from '@guillaumeg/ui';
	import '../app.css';

	let { children }: { children: Snippet } = $props();

	onMount(() => theme.init());
</script>

<svelte:head>
	<title>Boulangerie Côté Sud — démo G2 Hub</title>
	<meta name="description" content="Site de démonstration : la galerie est gérée dans G2 Hub." />
</svelte:head>

{@render children()}
