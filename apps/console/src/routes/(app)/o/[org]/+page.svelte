<script lang="ts">
	import { Button, Card, EmptyState } from '@guillaumeg/ui';
	import { AppWindow, Building2, Users } from '@lucide/svelte';
	import SuperTitle from '$lib/components/SuperTitle.svelte';
	import { orgPath } from '$lib/utils/orgPath';
	import StorageOverview from '$lib/components/storage/StorageOverview.svelte';
	import OfferBadges from '$lib/components/OfferBadges.svelte';
	import { formatBytes, orgRoleLabel } from '$lib/records/organization';
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
					<dt>Offres</dt>
					<dd><OfferBadges organization={org} /></dd>
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
				<Button variant="outline" icon={AppWindow} href={orgPath(org.id, '/applications')}>Applications</Button>
				{#if data.isSuperadmin}<Button variant="outline" icon={Users} href={orgPath(org.id, '/membres')}>Membres</Button>{/if}
			</div>
		</Card>

		{#if data.storage}
			<StorageOverview storage={data.storage} />
		{/if}
	{:else}
		<EmptyState
			icon={Building2}
			title="Aucune organisation sélectionnée"
			description={data.isSuperadmin
				? 'Créez une organisation ou choisissez celle dans laquelle travailler.'
				: "Vous n'êtes membre d'aucune organisation pour le moment."}
			cta={data.isSuperadmin
				? { label: 'Voir les organisations', href: '/organisations' }
				: { label: 'Mes organisations', href: '/mes-organisations' }}
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
