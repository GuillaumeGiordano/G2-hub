<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Alert, Badge, Button, Card, EmptyState, FileInput, Input, Modal, Select, Textarea } from '@guillaumeg/ui';
	import { ArrowLeft, FileText, Images, Pencil, Pin, Trash2, Upload } from '@lucide/svelte';
	import type { GalleryItem } from './+page.server';
	import type { ActionData, PageData } from './$types';

	// « Gérer la galerie » — what a client's back-office does with G2 Hub (DECISIONS.md §29): list a
	// folder, add a photo, edit its texts, delete it. The landing page (port 5190) shows the gallery
	// folder: every change here is visible there on reload.
	let { data, form }: { data: PageData; form: ActionData } = $props();

	const EDIT_MODAL_ID = 'gallery-edit';
	const DELETE_MODAL_ID = 'gallery-delete';

	let busy = $state<string | null>(null);
	// The library FileInput keeps its own selection: re-mount it to clear it after a send.
	let round = $state(0);
	let target = $state<GalleryItem | null>(null);

	const label = (f: { path: string; visibility: string }) => (f.visibility === 'PRIVATE' ? `${f.path} (privé)` : f.path);
	const folderOptions = $derived(data.folders.map((f) => ({ value: f.path, label: label(f) })));
	// Where a new photo goes: the managed folder by default, another one sometimes.
	let destination = $derived(data.current);
	let browsed = $derived(data.current);

	function modal(id: string) {
		return document.getElementById(id) as HTMLDialogElement | null;
	}

	function open(id: string, item: GalleryItem) {
		target = item;
		modal(id)?.showModal();
	}

	/** The library Select exposes no callback: its native `change` bubbles up to this wrapper. */
	function onbrowse() {
		goto(browsed === data.gallery ? '?' : `?dossier=${encodeURIComponent(browsed)}`, { noScroll: true });
	}

	const submit =
		(name: string, closeId?: string): SubmitFunction =>
		() => {
			busy = name;
			return async ({ result, update }) => {
				await update();
				busy = null;
				if (result.type === 'success') {
					round++;
					if (closeId) modal(closeId)?.close();
				}
			};
		};
</script>

<main class="portal">
	<a class="back" href="/"><ArrowLeft size={16} /> Retour</a>

	<header class="head">
		<div>
			<h1>Galerie du site</h1>
			<p class="muted">
				Les photos du dossier « {data.gallery} » s'affichent sur la <a href="http://localhost:5190" target="_blank" rel="noopener">page d'accueil</a>.
			</p>
		</div>
		<Badge label="Réservé aux admins" variant="primary" />
	</header>

	{#if !data.configured}
		<Alert variant="warning" title="Galerie non configurée">Renseignez DEMO_HUB_SECRET_KEY dans le .env.</Alert>
	{:else}
		{#if data.error}<Alert variant="error" title="G2 Hub">{data.error}</Alert>{/if}
		{#if form?.message}
			<Alert variant="error" title="Action impossible">{form.message}</Alert>
		{:else if form?.saved}
			<Alert variant="success" title={form.saved} />
		{/if}

		{#if folderOptions.length > 1}
			<div onchange={onbrowse} role="presentation">
				<Select label="Dossier affiché" bind:value={browsed} options={folderOptions} placeholder="" />
			</div>
		{/if}

		<Card>
			{#snippet header()}
				<span class="title"><Upload size={16} /> Ajouter une photo</span>
			{/snippet}
			<form method="POST" action="?/upload" enctype="multipart/form-data" class="form" use:enhance={submit('upload')}>
				{#key round}
					<FileInput label="Photo" name="file" accept="image/jpeg,image/png,image/webp" hint="JPEG, PNG ou WebP — 10 Mo max." required />
				{/key}
				{#if folderOptions.length > 1}
					<Select
						label="Dossier de destination"
						name="folder"
						bind:value={destination}
						options={folderOptions}
						placeholder=""
						hint="La page d'accueil n'affiche que la galerie : une photo rangée ailleurs n'y apparaît pas."
					/>
				{:else}
					<input type="hidden" name="folder" value={data.current} />
				{/if}
				<Input label="Texte alternatif" name="alt" placeholder="Croissant doré sur une planche en bois" />
				<Textarea label="Légende" name="caption" rows={2} placeholder="Feuilleté au beurre AOP, cuit chaque matin." />
				<div class="actions">
					<Button type="submit" icon={Upload} loading={busy === 'upload'}>Ajouter</Button>
				</div>
			</form>
		</Card>

		<h2>{data.current} ({data.items.length})</h2>
		{#if data.items.length === 0}
			<EmptyState icon={Images} title="Aucune photo" description="Ajoutez une première photo ci-dessus." />
		{:else}
			<ul class="grid">
				{#each data.items as item (item.id)}
					<li class="tile">
						<a class="thumb" href={item.url} target="_blank" rel="noopener" title={item.name}>
							{#if item.thumbnailUrl}
								<img src={item.thumbnailUrl} alt={item.alt ?? item.name} loading="lazy" />
							{:else}
								<FileText size={32} />
							{/if}
							{#if item.pinned}<span class="pinned"><Pin size={12} /> Utilisée</span>{/if}
						</a>
						<span class="name">{item.name}</span>
						{#if item.caption}<span class="muted small">{item.caption}</span>{/if}
						<div class="tile-actions">
							<Button variant="ghost" size="sm" icon={Pencil} onclick={() => open(EDIT_MODAL_ID, item)}>Textes</Button>
							<Button
								variant="ghost"
								size="sm"
								icon={Trash2}
								aria-label={`Supprimer ${item.name}`}
								disabled={item.pinned}
								onclick={() => open(DELETE_MODAL_ID, item)}
							/>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</main>

<Modal id={EDIT_MODAL_ID} title="Textes de la photo">
	{#if target}
		{#key target.id}
			<form method="POST" action="?/update" class="form" use:enhance={submit('update', EDIT_MODAL_ID)}>
				<input type="hidden" name="id" value={target.id} />
				<Input label="Texte alternatif" name="alt" value={target.alt ?? ''} hint="Décrit la photo pour les lecteurs d'écran." />
				<Textarea label="Légende" name="caption" rows={3} value={target.caption ?? ''} />
				<div class="actions">
					<Button type="button" variant="ghost" onclick={() => modal(EDIT_MODAL_ID)?.close()}>Annuler</Button>
					<Button type="submit" loading={busy === 'update'}>Enregistrer</Button>
				</div>
			</form>
		{/key}
	{/if}
</Modal>

<Modal id={DELETE_MODAL_ID} title="Supprimer la photo">
	<p>Supprimer <strong>{target?.name}</strong> ? Elle disparaît du site. Cette action est irréversible.</p>
	<form method="POST" action="?/delete" class="actions" use:enhance={submit('delete', DELETE_MODAL_ID)}>
		<input type="hidden" name="id" value={target?.id ?? ''} />
		<Button type="button" variant="ghost" onclick={() => modal(DELETE_MODAL_ID)?.close()}>Annuler</Button>
		<Button type="submit" variant="danger" icon={Trash2} loading={busy === 'delete'}>Supprimer</Button>
	</form>
</Modal>

<style>
	.portal {
		max-width: 880px;
		margin: 0 auto;
		padding: 32px 16px 64px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--text-muted);
		font-size: 14px;
		text-decoration: none;
	}
	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}
	h1 {
		margin: 0;
		font-size: 22px;
		font-weight: 700;
		color: var(--text-heading);
	}
	h2 {
		margin: 0;
		font-size: 17px;
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
	.title {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-weight: 600;
		color: var(--text-heading);
	}
	.form {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}
	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 16px;
	}
	.tile {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
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
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
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
	.name {
		font-size: 13px;
		font-weight: 500;
		color: var(--text-heading);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tile-actions {
		display: flex;
		justify-content: space-between;
	}
	@media (max-width: 640px) {
		.grid {
			grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
			gap: 10px;
		}
	}
</style>
