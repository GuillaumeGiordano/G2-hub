<script lang="ts">
	import { page } from '$app/state';
	import { orgPath } from '$lib/utils/orgPath';
	import { Alert, Badge, Button, Card, Progress, Table } from '@guillaumeg/ui';
	import { ArrowUpCircle } from '@lucide/svelte';
	import { fileKindLabel } from '$lib/records/files';
	import { formatBytes, usageLevelColor } from '$lib/records/organization';
	import type { StorageOverview } from '$lib/viewmodels/storage';

	// The organization's « disk space », shown on the dashboard (§33): how full the quota is, and
	// what fills it — to clean up or to ask for the next tier (the request itself happens on the
	// G2 WebDev portal).
	let { storage }: { storage: StorageOverview } = $props();

	const s = $derived(storage);
	const filesLabel = (n: number) => `${n} fichier${n > 1 ? 's' : ''}`;

	type AppRow = StorageOverview['byApplication'][number];
	type KindRow = StorageOverview['byKind'][number];
</script>

{#snippet appNameCell(row: AppRow)}
	<a class="strong" href={orgPath(page.params.org!, `/applications/${row.id}`)}>{row.name}</a>
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

<section class="storage">
	<div class="head">
		<h2>Stockage</h2>
		<div class="head-actions">
			<Badge label={`Forfait ${formatBytes(s.quotaBytes)}`} variant="default" />
			{#if s.upgradeUrl && s.nextQuotaBytes}
				<Button href={s.upgradeUrl} size="sm" icon={ArrowUpCircle}>Demander plus d'espace</Button>
			{/if}
		</div>
	</div>

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

	<h3>Par application</h3>
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
	{#if s.personal.files > 0}
		<p class="muted small">
			Dont {formatBytes(s.personal.bytes)} ({filesLabel(s.personal.files)}) dans les espaces personnels des
			utilisateurs des portails.
		</p>
	{/if}

	<h3>Par type de fichier</h3>
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
</section>

<style>
	.gauge {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.storage {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		flex-wrap: wrap;
	}
	.head-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	h2 {
		margin: 0;
		font-size: 18px;
		font-weight: 700;
		color: var(--text-heading);
	}
	h3 {
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
