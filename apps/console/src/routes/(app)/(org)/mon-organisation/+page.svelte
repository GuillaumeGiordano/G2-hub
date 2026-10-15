<script lang="ts">
	import { Badge, Button, Card, Progress } from '@guillaumeg/ui';
	import { AppWindow, ArrowLeftRight, HardDrive, Users } from '@lucide/svelte';
	import SuperTitle from '$lib/components/SuperTitle.svelte';
	import {
		formatBytes,
		offerLabel,
		orgRoleLabel,
		usageLevel,
		usageLevelColor,
		usagePercent,
		SUPERADMIN_LABEL
	} from '$lib/records/organization';
	import type { PageData } from './$types';

	// « Mon organisation »: everything a member needs to know about the active organization.
	let { data }: { data: PageData } = $props();

	const org = $derived(data.org);
	const percent = $derived(usagePercent(org.usedBytes, org.quotaBytes));
</script>

<div class="page">
	<SuperTitle headingLevel="h1" title={org.name} slogan="Votre organisation : son offre, ses applications et ses membres.">
		<Badge label={org.role ? orgRoleLabel[org.role] : SUPERADMIN_LABEL} variant="info" />
		{#if org.canSwitch}
			<Button variant="outline" icon={ArrowLeftRight} href="/choisir-organisation">Changer d'organisation</Button>
		{/if}
	</SuperTitle>

	<Card>
		{#snippet header()}
			<div class="card-title">Offre</div>
		{/snippet}
		<dl class="facts">
			<div>
				<dt>Offre</dt>
				<dd><Badge label={offerLabel(org.storageEnabled)} variant={org.storageEnabled ? 'primary' : 'default'} /></dd>
			</div>
			{#if org.storageEnabled}
				<div>
					<dt>Stockage</dt>
					<dd>{formatBytes(org.usedBytes)} utilisés sur {formatBytes(org.quotaBytes)}</dd>
				</div>
			{/if}
			<div>
				<dt>Applications</dt>
				<dd>{org.applicationCount}</dd>
			</div>
			<div>
				<dt>Membres</dt>
				<dd>{org.memberCount}</dd>
			</div>
		</dl>
		{#if org.storageEnabled}
			<Progress value={percent} color={usageLevelColor[usageLevel(org.usedBytes, org.quotaBytes)]} />
		{/if}
		<div class="links">
			<Button variant="outline" icon={AppWindow} href="/applications">Applications</Button>
			{#if org.storageEnabled}<Button variant="outline" icon={HardDrive} href="/stockage">Stockage</Button>{/if}
			<Button variant="outline" icon={Users} href="/membres">Membres</Button>
		</div>
	</Card>
</div>

<style>
	.facts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 16px;
		margin: 0 0 16px;
	}
	.facts dt {
		font-size: 12px;
		color: var(--text-muted);
		margin-bottom: 4px;
	}
	.facts dd {
		margin: 0;
	}
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 16px;
	}
</style>
