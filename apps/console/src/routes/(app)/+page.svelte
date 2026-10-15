<script lang="ts">
	import { Badge, Button, Card, EmptyState } from '@guillaumeg/ui';
	import { AppWindow, Building2, Users } from '@lucide/svelte';
	import SuperTitle from '$lib/components/SuperTitle.svelte';
	import { formatBytes, offerLabel, orgRoleLabel } from '$lib/records/organization';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const org = $derived(data.organization);
</script>

<div class="page">
	<SuperTitle headingLevel="h1" title="Tableau de bord" slogan={`Bienvenue, ${data.user.name}.`} />

	{#if org}
		<Card>
			{#snippet header()}
				<div class="card-title">{org.name}</div>
			{/snippet}
			<dl class="facts">
				<div>
					<dt>Offre</dt>
					<dd><Badge label={offerLabel(org.storageEnabled)} variant={org.storageEnabled ? 'primary' : 'default'} /></dd>
				</div>
				<div>
					<dt>Forfait de stockage</dt>
					<dd>{org.storageEnabled ? formatBytes(org.quotaBytes) : '—'}</dd>
				</div>
				<div>
					<dt>Mon rôle</dt>
					<dd>{org.role ? orgRoleLabel[org.role] : 'Super administrateur'}</dd>
				</div>
			</dl>
			<div class="links">
				<Button variant="outline" icon={AppWindow} href="/applications">Applications</Button>
				<Button variant="outline" icon={Users} href="/membres">Membres</Button>
			</div>
		</Card>
	{:else}
		<EmptyState
			icon={Building2}
			title="Aucune organisation sélectionnée"
			description={data.isSuperadmin
				? 'Créez une organisation ou choisissez celle dans laquelle travailler.'
				: "Vous n'êtes membre d'aucune organisation pour le moment."}
			cta={data.isSuperadmin
				? { label: 'Voir les organisations', href: '/organisations' }
				: { label: 'Choisir une organisation', href: '/choisir-organisation' }}
		/>
	{/if}
</div>

<style>
	.facts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 16px;
		margin: 0 0 16px;
	}
	dt {
		font-size: 12px;
		color: var(--text-subtle);
		margin-bottom: 4px;
	}
	dd {
		margin: 0;
		color: var(--text-heading);
		font-weight: 500;
	}
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
</style>
