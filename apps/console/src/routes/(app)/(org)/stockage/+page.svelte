<script lang="ts">
	import { page } from '$app/state';
	import { Alert, Badge, Button, Card, Progress, Table } from '@guillaumeg/ui';
	import { ArrowUpCircle } from '@lucide/svelte';
	import SuperTitle from '$lib/components/SuperTitle.svelte';
	import { fileKindLabel } from '$lib/records/files';
	import { formatBytes, usageLevelColor } from '$lib/records/organization';
	import type { StorageOverview } from '$lib/viewmodels/storage';
	import type { PageData } from './$types';

	// The organization's « disk space »: how full the quota is, and what fills it — to clean up or
	// to ask for the next tier (the request itself happens on the G2 WebDev portal).
	let { data }: { data: PageData } = $props();

	const s = $derived(data.storage);
	const organizationName = $derived((page.data.organization as { name: string }).name);
	const filesLabel = (n: number) => `${n} fichier${n > 1 ? 's' : ''}`;

	type AppRow = StorageOverview['byApplication'][number];
	type KindRow = StorageOverview['byKind'][number];
</script>

{#snippet appNameCell(row: AppRow)}
	<a class="strong" href={`/applications/${row.id}`}>{row.name}</a>
{/snippet}

{#snippet kindNameCell(row: KindRow)}
	<span class="strong">{fileKindLabel[row.kind]}</span>
{/snippet}

{#snippet bytesCell(row: AppRow | KindRow)}
	{formatBytes(row.bytes)}
{/snippet}

{#snippet filesCell(row: AppRow | KindRow)}
	<span class="muted">{filesLabel(row.files)}</span>
{/snippet}

{#snippet shareCell(row: AppRow | KindRow)}
	<span class="muted">{s.usedBytes > 0 ? `${row.percent} %` : '—'}</span>
{/snippet}

<div class="page">
	<SuperTitle headingLevel="h1" title="Stockage" slogan={`L'espace de ${organizationName}, toutes applications confondues.`}>
		<Badge label={`Forfait ${formatBytes(s.quotaBytes)}`} variant="default" />
		{#if s.upgradeUrl && s.nextQuotaBytes}
			<Button href={s.upgradeUrl} icon={ArrowUpCircle}>Demander plus d'espace</Button>
		{/if}
	</SuperTitle>

	<Card>
		<div class="gauge">
			<Progress
				value={s.percent}
				label={`${formatBytes(s.usedBytes)} utilisés sur ${formatBytes(s.quotaBytes)}`}
				showValue
				size="lg"
				color={usageLevelColor[s.level]}
			/>
			<p class="muted">
				Libre : {formatBytes(Math.max(0, s.quotaBytes - s.usedBytes))}.
				{#if s.nextQuotaBytes}Palier suivant : {formatBytes(s.nextQuotaBytes)}.{:else}Vous êtes au palier le plus élevé.{/if}
			</p>
		</div>
	</Card>

	{#if s.level === 'FULL'}
		<Alert variant="error" title="Espace plein">
			Les nouveaux envois sont refusés, depuis la console comme depuis vos sites. Supprimez des
			fichiers{s.nextQuotaBytes ? ' ou passez au palier supérieur' : ''}.
		</Alert>
	{:else if s.level === 'WARNING'}
		<Alert variant="warning" title="Bientôt plein">
			Au-delà de votre forfait, les envois seront refusés. Faites du tri{s.nextQuotaBytes
				? ' ou passez au palier supérieur'
				: ''}.
		</Alert>
	{/if}

	<h2>Par application</h2>
	<Table
		rows={s.byApplication}
		emptyLabel="Aucune application."
		columns={[
			{ key: 'name', label: 'Application', cell: appNameCell },
			{ key: 'files', label: 'Fichiers', cell: filesCell },
			{ key: 'bytes', label: 'Espace', align: 'right', cell: bytesCell },
			{ key: 'percent', label: 'Part', align: 'right', cell: shareCell }
		]}
	/>

	<h2>Par type de fichier</h2>
	<Table
		rows={s.byKind}
		columns={[
			{ key: 'kind', label: 'Type', cell: kindNameCell },
			{ key: 'files', label: 'Fichiers', cell: filesCell },
			{ key: 'bytes', label: 'Espace', align: 'right', cell: bytesCell },
			{ key: 'percent', label: 'Part', align: 'right', cell: shareCell }
		]}
	/>

	<p class="muted small">
		Seules les versions traitées comptent (images en WebP, vidéos transcodées) ; un envoi en cours
		réserve sa taille annoncée. Supprimer un fichier libère son espace immédiatement.
	</p>
</div>

<style>
	.gauge {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	h2 {
		margin: 8px 0 0;
		font-size: 16px;
		font-weight: 600;
		color: var(--text-heading);
	}
	.muted {
		margin: 0;
		color: var(--text-muted);
		font-size: 14px;
	}
	.small {
		font-size: 12px;
	}
	a.strong {
		color: var(--text-heading);
	}
</style>
