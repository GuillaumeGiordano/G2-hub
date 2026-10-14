<script lang="ts">
	import { goto } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import { Alert, Badge, Breadcrumb, EmptyState, Input, Pagination, SearchFilters, Select } from '@guillaumeg/ui';
	import { FileText, Images, Pin, Play } from '@lucide/svelte';
	import MediaViewer from '$lib/components/media/MediaViewer.svelte';
	import PageTabs from '$lib/components/PageTabs.svelte';
	import SuperTitle from '$lib/components/SuperTitle.svelte';
	import { fileKindLabel, FILE_KINDS } from '$lib/records/files';
	import { applicationTabs } from '$lib/records/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const lib = $derived(data.library);
	const tabs = $derived(applicationTabs(lib.application.id, data.canManageKeys));
	const crumbs = $derived([
		{ label: 'Applications', href: '/applications' },
		{ label: lib.application.name, href: `/applications/${lib.application.id}` },
		{ label: 'Médiathèque' }
	]);
	const pageCount = $derived(Math.max(1, Math.ceil(lib.total / lib.perPage)));

	const typeOptions = [{ value: '', label: 'Tous' }, ...FILE_KINDS.map((k) => ({ value: k, label: fileKindLabel[k] }))];
	const folderOptions = $derived([{ value: '', label: 'Tous les dossiers' }, ...lib.folders]);

	/** The current URL with `media` set (or removed when null). */
	function withMedia(id: string | null): string {
		const params = new URLSearchParams(page.url.searchParams);
		if (id) params.set('media', id);
		else params.delete('media');
		const qs = params.toString();
		return qs ? `?${qs}` : page.url.pathname;
	}

	// The viewer's item: from the current page, or loaded on its own for a shared link.
	const mediaId = $derived(page.url.searchParams.get('media'));
	const index = $derived(mediaId ? lib.items.findIndex((m) => m.id === mediaId) : -1);
	const current = $derived(index >= 0 ? lib.items[index] : mediaId ? data.selected : null);
	const prevHref = $derived(index > 0 ? withMedia(lib.items[index - 1].id) : null);
	const nextHref = $derived(index >= 0 && index < lib.items.length - 1 ? withMedia(lib.items[index + 1].id) : null);

	function goToPage(p: number) {
		const params = new URLSearchParams(page.url.searchParams);
		params.set('page', String(p));
		params.delete('media');
		goto(`?${params.toString()}`);
	}
</script>

<div class="page">
	<Breadcrumb items={crumbs} />
	<SuperTitle headingLevel="h1" title={lib.application.name} slogan="Toutes les photos, vidéos et PDF de l'application, tous dossiers confondus.">
		<Badge label={`${lib.total} média${lib.total > 1 ? 's' : ''}`} variant="default" />
	</SuperTitle>
	<PageTabs {tabs} />

	{#if !lib.storageEnabled}
		<Alert variant="info" title="Option stockage non activée">
			Cette organisation a l'offre « Accès » : les médias font partie de l'offre « Accès + Stockage ».
		</Alert>
	{:else}
		<SearchFilters collapsible columns={3} loading={!!navigating.to} title="Filtrer" urlDriven>
			<Select label="Type" name="type" options={typeOptions} value={page.url.searchParams.get('type') ?? ''} />
			<Select label="Dossier" name="dossier" options={folderOptions} value={page.url.searchParams.get('dossier') ?? ''} />
			<Input label="Nom" name="q" placeholder="Rechercher un média…" value={page.url.searchParams.get('q') ?? ''} />
		</SearchFilters>

		{#if lib.items.length === 0}
			<EmptyState
				icon={Images}
				title="Aucun média"
				description="Les fichiers envoyés dans les dossiers de l'application apparaîtront ici."
			/>
		{:else}
			<ul class="grid">
				{#each lib.items as media (media.id)}
					<li>
						<a class="tile" href={withMedia(media.id)} data-sveltekit-noscroll title={media.name}>
							<span class="thumb">
								{#if media.thumbUrl}
									<img src={media.thumbUrl} alt={media.name} loading="lazy" />
								{:else}
									<FileText size={36} />
								{/if}
								{#if media.kind === 'VIDEO'}<span class="badge-icon"><Play size={16} /></span>{/if}
								{#if media.visibility === 'PRIVATE'}<span class="private">Privé</span>{/if}
								{#if media.source === 'API'}<span class="site">Site</span>{/if}
								{#if media.pins.length}<span class="pinned" title="Utilisé par le site"><Pin size={12} /> Utilisé</span>{/if}
							</span>
							<span class="name">{media.name}</span>
							<span class="folder">{media.folderName}</span>
						</a>
					</li>
				{/each}
			</ul>

			{#if pageCount > 1}
				<div class="pager">
					<span class="count">{lib.total} média{lib.total > 1 ? 's' : ''}</span>
					<Pagination page={lib.page} total={pageCount} perPage={lib.perPage} onchange={goToPage} />
				</div>
			{/if}
		{/if}
	{/if}
</div>

<MediaViewer
	media={current}
	applicationId={lib.application.id}
	{prevHref}
	{nextHref}
	closeHref={withMedia(null)}
	canWrite={lib.canWrite}
/>

<style>
	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 14px;
	}
	.tile {
		display: flex;
		flex-direction: column;
		gap: 4px;
		text-decoration: none;
		color: inherit;
	}
	.thumb {
		position: relative;
		display: grid;
		place-items: center;
		aspect-ratio: 1;
		border-radius: var(--radius-lg);
		overflow: hidden;
		background: var(--bg-muted);
		color: var(--text-subtle);
		border: 1px solid var(--border);
		transition:
			border-color var(--transition-fast),
			box-shadow var(--transition-fast);
	}
	.tile:hover .thumb,
	.tile:focus-visible .thumb {
		border-color: var(--primary);
		box-shadow: var(--shadow-md);
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.badge-icon {
		position: absolute;
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: rgb(0 0 0 / 0.55);
		color: #fff;
	}
	.private {
		position: absolute;
		top: 6px;
		left: 6px;
		padding: 2px 6px;
		border-radius: var(--radius-sm);
		font-size: 11px;
		background: rgb(0 0 0 / 0.55);
		color: #fff;
	}
	.pinned {
		position: absolute;
		bottom: 6px;
		left: 6px;
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 2px 6px;
		border-radius: var(--radius-sm);
		font-size: 11px;
		background: var(--warning-subtle);
		color: var(--warning-subtle-fg);
	}
	.site {
		position: absolute;
		top: 6px;
		right: 6px;
		padding: 2px 6px;
		border-radius: var(--radius-sm);
		font-size: 11px;
		background: var(--primary);
		color: var(--primary-fg);
	}
	.name {
		font-size: 13px;
		font-weight: 500;
		color: var(--text-heading);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.folder {
		font-size: 12px;
		color: var(--text-subtle);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	@media (max-width: 640px) {
		.grid {
			grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
			gap: 10px;
		}
	}
</style>
