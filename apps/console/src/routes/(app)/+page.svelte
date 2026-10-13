<script lang="ts">
	import { Card } from '@guillaumeg/ui';
	import SuperTitle from '$lib/components/SuperTitle.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="page">
	<SuperTitle headingLevel="h1" title="Tableau de bord" slogan={`Bienvenue, ${data.user.name}.`} />

	<Card>
		{#snippet header()}
			<div class="card-title">Console en construction</div>
		{/snippet}
		<p class="muted">
			Les organisations, applications, dossiers et fichiers arrivent dans les prochaines étapes
			(voir <code>DECISIONS.md</code>).
		</p>
	</Card>
</div>
