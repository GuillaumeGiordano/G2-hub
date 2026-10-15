<script lang="ts">
	import { EmptyState } from '@guillaumeg/ui';
	import { Building2 } from '@lucide/svelte';
	import SuperTitle from '$lib/components/SuperTitle.svelte';
	import type { PageData } from './$types';

	// The superadmin's home (an Admin is sent to its organization). More indicators will join later.
	let { data }: { data: PageData } = $props();
</script>

<div class="page">
	<SuperTitle headingLevel="h1" title="Tableau de bord" slogan={`Bienvenue, ${data.user.name}.`} />

	<EmptyState
		icon={Building2}
		title="Les organisations"
		description="Créez une organisation, ou ouvrez celle d'un client pour gérer sa fiche, ses membres et ses applications."
		cta={{ label: 'Voir les organisations', href: '/organisations' }}
	/>
</div>
