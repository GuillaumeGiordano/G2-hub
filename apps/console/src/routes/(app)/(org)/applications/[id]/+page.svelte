<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Alert,
		Badge,
		Breadcrumb,
		Button,
		ButtonAction,
		ButtonActionItem,
		EmptyState,
		Input,
		Modal,
		RadioGroup,
		Table
	} from '@guillaumeg/ui';
	import { EllipsisVertical, Folder, FolderOpen, FolderPlus, Pencil, Trash2 } from '@lucide/svelte';
	import SuperTitle from '$lib/components/SuperTitle.svelte';
	import { visibilityHint, visibilityLabel, visibilityOptions, visibilityVariant } from '$lib/records/storage';
	import { folderCreateSchema, folderRenameSchema } from '$lib/schemas/folder';
	import { FieldErrors } from '$lib/utils/fieldErrors.svelte';
	import { toastEnhance } from '$lib/utils/toastEnhance';
	import type { FolderListItem } from '$lib/viewmodels/folder';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const b = $derived(data.browser);
	const base = $derived(`/applications/${b.application.id}`);
	const folderHref = (id: string) => `${base}?dossier=${id}`;

	const crumbs = $derived([
		{ label: 'Applications', href: '/applications' },
		{ label: b.application.name, href: b.folder ? base : undefined },
		...b.crumbs.map((c) => ({ label: c.name, href: folderHref(c.id) })),
		...(b.folder ? [{ label: b.folder.name }] : [])
	]);

	const CREATE_MODAL_ID = 'folder-create';
	const RENAME_MODAL_ID = 'folder-rename';
	const DELETE_MODAL_ID = 'folder-delete';

	let busy = $state(false);
	const setBusy = (v: boolean) => (busy = v);

	let newVisibility = $state('PUBLIC');
	const createErrors = new FieldErrors(['name', 'visibility'], folderCreateSchema);

	let target = $state<FolderListItem | null>(null);
	let renameName = $state('');
	const renameErrors = new FieldErrors(['name'], folderRenameSchema);

	function modal(id: string) {
		return document.getElementById(id) as HTMLDialogElement | null;
	}

	function openCreate() {
		newVisibility = 'PUBLIC';
		createErrors.clear();
		modal(CREATE_MODAL_ID)?.showModal();
	}

	function openRename(folder: FolderListItem) {
		target = folder;
		renameName = folder.name;
		renameErrors.clear();
		modal(RENAME_MODAL_ID)?.showModal();
	}

	function openDelete(folder: FolderListItem) {
		target = folder;
		modal(DELETE_MODAL_ID)?.showModal();
	}
</script>

{#snippet nameCell(folder: FolderListItem)}
	<a class="folder-link" href={folderHref(folder.id)}>
		<Folder size={18} />
		<span class="strong">{folder.name}</span>
	</a>
{/snippet}

{#snippet visibilityCell(folder: FolderListItem)}
	<Badge label={visibilityLabel[folder.visibility]} variant={visibilityVariant[folder.visibility]} />
{/snippet}

{#snippet contentCell(folder: FolderListItem)}
	<span class="muted">
		{folder.folderCount ? `${folder.folderCount} dossier${folder.folderCount > 1 ? 's' : ''}` : '—'}
	</span>
{/snippet}

{#snippet actionsCell(folder: FolderListItem)}
	<div class="actions">
		<ButtonAction label="Actions" icon={EllipsisVertical} variant="ghost" size="sm">
			{#snippet items(close)}
				<ButtonActionItem
					label="Renommer"
					icon={Pencil}
					onclick={() => {
						openRename(folder);
						close();
					}}
				/>
				<ButtonActionItem
					label="Supprimer"
					icon={Trash2}
					variant="danger"
					onclick={() => {
						openDelete(folder);
						close();
					}}
				/>
			{/snippet}
		</ButtonAction>
	</div>
{/snippet}

<div class="page">
	<Breadcrumb items={crumbs} />

	<SuperTitle
		headingLevel="h1"
		title={b.folder?.name ?? b.application.name}
		slogan={b.folder ? visibilityHint[b.folder.visibility] : 'Les dossiers de fichiers de cette application.'}
	>
		{#if b.folder}
			<Badge label={visibilityLabel[b.folder.visibility]} variant={visibilityVariant[b.folder.visibility]} />
		{/if}
		{#if b.canWrite && b.storageEnabled}
			<Button icon={FolderPlus} onclick={openCreate}>Nouveau dossier</Button>
		{/if}
	</SuperTitle>

	{#if !b.storageEnabled}
		<Alert variant="info" title="Option stockage non activée">
			Cette organisation a l'offre « Accès » : la gestion des fichiers fait partie de l'offre « Accès
			+ Stockage ».
		</Alert>
	{:else if b.folders.length === 0}
		<EmptyState
			icon={FolderOpen}
			title={b.folder ? 'Dossier vide' : 'Aucun dossier'}
			description={b.folder
				? 'Ce dossier ne contient encore rien.'
				: 'Créez un dossier public pour les médias du site, ou privé pour des fichiers personnels.'}
			cta={b.canWrite ? { label: 'Créer un dossier', onclick: openCreate } : undefined}
		/>
	{:else}
		<Table
			rows={b.folders}
			columns={[
				{ key: 'name', label: 'Dossier', cell: nameCell },
				{ key: 'visibility', label: 'Visibilité', cell: visibilityCell },
				{ key: 'folderCount', label: 'Contenu', cell: contentCell },
				...(b.canWrite ? [{ key: 'id' as const, label: '', align: 'right' as const, cell: actionsCell }] : [])
			]}
		/>
	{/if}
</div>

<Modal id={CREATE_MODAL_ID} title="Nouveau dossier">
	<form
		method="POST"
		action="?/createFolder"
		class="form"
		novalidate
		oninput={createErrors.oninput}
		onfocusout={createErrors.onfocusout}
		use:enhance={toastEnhance({
			success: 'Dossier créé.',
			onSuccess: () => modal(CREATE_MODAL_ID)?.close(),
			resetOnSuccess: true,
			setBusy,
			fields: createErrors
		})}
	>
		{#if b.folder}<input type="hidden" name="parentId" value={b.folder.id} />{/if}
		<Input error={createErrors.get('name')} label="Nom" name="name" required />
		{#if b.folder}
			<p class="hint">
				Visibilité héritée du dossier parent :
				<Badge label={visibilityLabel[b.folder.visibility]} variant={visibilityVariant[b.folder.visibility]} />
			</p>
		{:else}
			<RadioGroup legend="Visibilité" bind:value={newVisibility} options={visibilityOptions} orientation="horizontal" />
			<input type="hidden" name="visibility" value={newVisibility} />
			<p class="hint">{visibilityHint[newVisibility as 'PUBLIC' | 'PRIVATE']}</p>
		{/if}
		<div class="form-submit">
			<Button type="submit" icon={FolderPlus} loading={busy}>Créer</Button>
		</div>
	</form>
</Modal>

<Modal id={RENAME_MODAL_ID} title="Renommer le dossier">
	<form
		method="POST"
		action="?/renameFolder"
		class="form"
		novalidate
		oninput={renameErrors.oninput}
		onfocusout={renameErrors.onfocusout}
		use:enhance={toastEnhance({
			success: 'Dossier renommé.',
			onSuccess: () => modal(RENAME_MODAL_ID)?.close(),
			setBusy,
			fields: renameErrors
		})}
	>
		<input type="hidden" name="id" value={target?.id} />
		<Input bind:value={renameName} error={renameErrors.get('name')} label="Nom" name="name" required />
		<div class="form-submit">
			<Button type="submit" loading={busy}>Enregistrer</Button>
		</div>
	</form>
</Modal>

<Modal id={DELETE_MODAL_ID} title="Supprimer le dossier">
	<p class="confirm-text">
		Supprimer <strong>{target?.name}</strong> et <strong>tout son contenu</strong> (sous-dossiers et
		fichiers) ? Cette action est <strong>irréversible</strong>.
	</p>
	<form
		method="POST"
		action="?/deleteFolder"
		class="confirm-actions"
		use:enhance={toastEnhance({
			success: 'Dossier supprimé.',
			onSuccess: () => modal(DELETE_MODAL_ID)?.close(),
			setBusy
		})}
	>
		<input type="hidden" name="id" value={target?.id} />
		<Button type="button" variant="ghost" onclick={() => modal(DELETE_MODAL_ID)?.close()}>Annuler</Button>
		<Button type="submit" variant="danger" icon={Trash2} loading={busy}>Supprimer définitivement</Button>
	</form>
</Modal>

<style>
	.folder-link {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		color: var(--text-heading);
		text-decoration: none;
	}
	.folder-link:hover .strong {
		color: var(--primary);
		text-decoration: underline;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
	}
	.hint {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		font-size: 13px;
		color: var(--text-muted);
		margin: 0;
	}
</style>
