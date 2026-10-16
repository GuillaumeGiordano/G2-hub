<script lang="ts">
	import { orgPath } from '$lib/utils/orgPath';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import {
		Alert,
		Badge,
		Breadcrumb,
		Button,
		ButtonAction,
		ButtonActionItem,
		CopyButton,
		EmptyState,
		Input,
		Modal,
		Progress,
		RadioGroup,
		Table,
		toast
	} from '@guillaumeg/ui';
	import {
		EllipsisVertical,
		ExternalLink,
		Lock,
		FileText,
		Folder,
		FolderOpen,
		FolderPlus,
		Image,
		Link,
		Pencil,
		Trash2
	} from '@lucide/svelte';
	import MediaViewer from '$lib/components/media/MediaViewer.svelte';
	import PageTabs from '$lib/components/PageTabs.svelte';
	import SuperTitle from '$lib/components/SuperTitle.svelte';
	import { applicationTabs } from '$lib/records/navigation';
	import Uploader from '$lib/components/files/Uploader.svelte';
	import { fileKindLabel, fileStatusLabel, fileStatusVariant } from '$lib/records/files';
	import { formatBytes, usageLevel, usageLevelColor, usagePercent } from '$lib/records/organization';
	import {
		folderLockHint,
		folderLockLabel,
		folderLockOptions,
		folderLockVariant,
		visibilityHint,
		visibilityLabel,
		visibilityOptions,
		visibilityVariant
	} from '$lib/records/storage';
	import { folderCreateSchema, folderRenameSchema } from '$lib/schemas/folder';
	import { FieldErrors } from '$lib/utils/fieldErrors.svelte';
	import { toastEnhance } from '$lib/utils/toastEnhance';
	import type { FileListItem } from '$lib/viewmodels/file';
	import type { FolderListItem } from '$lib/viewmodels/folder';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const b = $derived(data.browser);
	const base = $derived(orgPath(page.params.org!, `/applications/${b.application.id}`));
	const folderHref = (id: string) => `${base}?dossier=${id}`;
	const tabs = $derived(applicationTabs(page.params.org!, b.application.id, data.canManageKeys, page.data.organization?.authEnabled ?? false));

	const crumbs = $derived([
		{ label: 'Applications', href: orgPath(page.params.org!, '/applications') },
		{ label: b.application.name, href: b.folder ? base : undefined },
		...b.crumbs.map((c) => ({ label: c.name, href: folderHref(c.id) })),
		...(b.folder ? [{ label: b.folder.name }] : [])
	]);

	/** The current URL with `media` set (or removed when null): the viewer of one file. */
	function withMedia(id: string | null): string {
		const params = new URLSearchParams(page.url.searchParams);
		if (id) params.set('media', id);
		else params.delete('media');
		const qs = params.toString();
		return qs ? `?${qs}` : page.url.pathname;
	}

	// The viewer moves between the READY files of the current folder.
	const viewable = $derived(data.files.filter((f) => f.status === 'READY'));
	const viewIndex = $derived(data.media ? viewable.findIndex((f) => f.id === data.media!.id) : -1);
	const prevHref = $derived(viewIndex > 0 ? withMedia(viewable[viewIndex - 1].id) : null);
	const nextHref = $derived(
		viewIndex >= 0 && viewIndex < viewable.length - 1 ? withMedia(viewable[viewIndex + 1].id) : null
	);

	// While a video is being transcoded in the background, refresh the list until it is ready.
	const processing = $derived(data.files.some((f) => f.status === 'PROCESSING'));
	$effect(() => {
		if (!processing) return;
		const timer = setInterval(() => invalidateAll(), 5000);
		return () => clearInterval(timer);
	});

	const usedPercent = $derived(usagePercent(data.usage.usedBytes, data.usage.quotaBytes));
	const usageColor = $derived(usageLevelColor[usageLevel(data.usage.usedBytes, data.usage.quotaBytes)]);
	const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' });

	const CREATE_MODAL_ID = 'folder-create';
	const DELETE_FILE_MODAL_ID = 'file-delete';
	let fileToDelete = $state<FileListItem | null>(null);
	const RENAME_MODAL_ID = 'folder-rename';
	const LOCK_MODAL_ID = 'folder-lock';
	let lockValue = $state('NONE');
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

	function openLock(folder: FolderListItem) {
		target = folder;
		lockValue = folder.lock;
		modal(LOCK_MODAL_ID)?.showModal();
	}

	/** An Admin may rename / delete a folder the site does not rely on (§37); the superadmin, any. */
	const editableFolder = (folder: FolderListItem) => b.canManageLocks || folder.lock === 'NONE';

	function openDelete(folder: FolderListItem) {
		target = folder;
		modal(DELETE_MODAL_ID)?.showModal();
	}

	function openDeleteFile(file: FileListItem) {
		fileToDelete = file;
		modal(DELETE_FILE_MODAL_ID)?.showModal();
	}

	async function copyPublicUrl(file: FileListItem) {
		if (!file.publicUrl) return;
		await navigator.clipboard.writeText(file.publicUrl);
		toast.success('Lien public copié.');
	}
</script>

{#snippet nameCell(folder: FolderListItem)}
	<a class="folder-link" href={folderHref(folder.id)}>
		<Folder size={18} />
		<span class="strong">{folder.name}</span>
	</a>
	{#if folder.lock !== 'NONE'}
		<span class="lock" title={folderLockHint[folder.lock]}>
			<Badge label={folderLockLabel[folder.lock]} variant={folderLockVariant[folder.lock]} />
		</span>
	{/if}
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
		{#if b.canManageLocks || editableFolder(folder)}
			<ButtonAction label="Actions" icon={EllipsisVertical} variant="ghost" size="sm">
				{#snippet items(close)}
					{#if b.canManageLocks}
						<ButtonActionItem
							label="Verrouillage"
							icon={Lock}
							onclick={() => {
								openLock(folder);
								close();
							}}
						/>
					{/if}
					{#if editableFolder(folder)}
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
					{/if}
				{/snippet}
			</ButtonAction>
		{/if}
	</div>
{/snippet}

{#snippet previewCell(file: FileListItem)}
	{#if file.thumbUrl}
		<img class="thumb" src={file.thumbUrl} alt="" loading="lazy" />
	{:else}
		<span class="thumb thumb-icon">
			{#if file.kind === 'PDF'}<FileText size={20} />{:else}<Image size={20} />{/if}
		</span>
	{/if}
{/snippet}

{#snippet fileNameCell(file: FileListItem)}
	{#if file.status === 'READY'}
		<a class="strong file-name file-link" href={withMedia(file.id)} data-sveltekit-noscroll>{file.name}</a>
	{:else}
		<div class="strong file-name">{file.name}</div>
	{/if}
	<div class="slug">
		{fileKindLabel[file.kind]}{file.width ? ` · ${file.width} × ${file.height}` : ''}
	</div>
	{#if file.source === 'API'}<Badge label="Envoyé par le site" variant="primary" />{/if}
	{#if file.pins.length}<Badge label="Utilisé par le site" variant="warning" />{/if}
	{#if file.error}<div class="file-error">{file.error}</div>{/if}
{/snippet}

{#snippet fileSizeCell(file: FileListItem)}
	{file.status === 'READY' ? formatBytes(file.bytes) : '—'}
{/snippet}

{#snippet fileStatusCell(file: FileListItem)}
	<Badge label={fileStatusLabel[file.status]} variant={fileStatusVariant[file.status]} />
{/snippet}

{#snippet fileDateCell(file: FileListItem)}
	{dateFormat.format(file.createdAt)}
{/snippet}

{#snippet fileActionsCell(file: FileListItem)}
	<div class="actions">
		<ButtonAction label="Actions" icon={EllipsisVertical} variant="ghost" size="sm">
			{#snippet items(close)}
				{#if file.viewUrl}
					<ButtonActionItem
						label="Ouvrir"
						icon={ExternalLink}
						onclick={() => {
							window.open(file.viewUrl!, '_blank', 'noopener');
							close();
						}}
					/>
				{/if}
				{#if file.publicUrl}
					<ButtonActionItem
						label="Copier le lien public"
						icon={Link}
						onclick={() => {
							copyPublicUrl(file);
							close();
						}}
					/>
				{/if}
				{#if b.canEditContent && file.source !== 'API' && !file.pins.length}
					<ButtonActionItem
						label="Supprimer"
						icon={Trash2}
						variant="danger"
						onclick={() => {
							openDeleteFile(file);
							close();
						}}
					/>
				{/if}
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
			{#if b.folder.lock !== 'NONE'}
				<Badge label={folderLockLabel[b.folder.lock]} variant={folderLockVariant[b.folder.lock]} />
			{/if}
		{/if}
		{#if b.canEditContent && b.storageEnabled}
			<Button icon={FolderPlus} onclick={openCreate}>Nouveau dossier</Button>
		{/if}
	</SuperTitle>
	<PageTabs {tabs} />

	{#if b.folder && b.canManageLocks}
		<!-- The id to put in the site's code: it never changes, a path breaks when the folder is renamed (§37). -->
		<p class="folder-id">
			Identifiant du dossier, pour le code du site : <code>{b.folder.id}</code>
			<CopyButton text={b.folder.id} />
		</p>
	{/if}

	{#if b.folder && b.folder.lock !== 'NONE' && !b.canManageLocks}
		<Alert variant="info" title={b.folder.lock === 'READ_ONLY' ? 'Dossier en lecture seule' : 'Dossier utilisé par votre site'}>
			{b.folder.lock === 'READ_ONLY'
				? 'Son contenu est fourni par votre prestataire : vous pouvez le consulter, pas le modifier.'
				: 'Votre site affiche ce dossier : il ne peut être ni renommé ni supprimé. Vous pouvez gérer ses fichiers librement.'}
		</Alert>
	{/if}

	{#if b.storageEnabled}
		<Progress
			value={usedPercent}
			label={`Stockage : ${formatBytes(data.usage.usedBytes)} utilisés sur ${formatBytes(data.usage.quotaBytes)}`}
			showValue
			color={usageColor}
		/>
	{/if}

	{#if b.folder && b.canEditContent && b.storageEnabled}
		<Uploader applicationId={b.application.id} folderId={b.folder.id} />
	{/if}

	{#if !b.storageEnabled}
		<Alert variant="info" title="Option stockage non activée">
			Cette organisation a l'offre « Accès » : la gestion des fichiers fait partie de l'offre « Accès
			+ Stockage ».
		</Alert>
	{:else if b.folders.length === 0 && data.files.length === 0}
		<EmptyState
			icon={FolderOpen}
			title={b.folder ? 'Dossier vide' : 'Aucun dossier'}
			description={b.folder
				? 'Ce dossier ne contient encore rien.'
				: 'Créez un dossier public pour les médias du site, ou privé pour des fichiers personnels.'}
			cta={b.canEditContent ? { label: 'Créer un dossier', onclick: openCreate } : undefined}
		/>
	{:else if b.folders.length}
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

	{#if b.storageEnabled && data.files.length}
		<Table
			rows={data.files}
			columns={[
				{ key: 'thumbUrl', label: '', width: '64px', cell: previewCell },
				{ key: 'name', label: 'Fichier', cell: fileNameCell },
				{ key: 'bytes', label: 'Taille', align: 'right', cell: fileSizeCell },
				{ key: 'status', label: 'État', cell: fileStatusCell },
				{ key: 'createdAt', label: 'Ajouté le', cell: fileDateCell },
				{ key: 'id', label: '', align: 'right', cell: fileActionsCell }
			]}
		/>
	{/if}
</div>

<MediaViewer
	media={data.media}
	applicationId={b.application.id}
	{prevHref}
	{nextHref}
	closeHref={withMedia(null)}
	canWrite={b.canEditContent}
/>

{#if b.canManageLocks}
	<Modal id={LOCK_MODAL_ID} title="Verrouillage du dossier">
		<form
			method="POST"
			action="?/lockFolder"
			class="form"
			use:enhance={toastEnhance({
				success: (d) => `« ${d.locked} » : ${folderLockLabel[d.lock as keyof typeof folderLockLabel].toLowerCase()}.`,
				onSuccess: () => modal(LOCK_MODAL_ID)?.close(),
				setBusy
			})}
		>
			<p class="confirm-text">
				<strong>{target?.name}</strong> — ce que l'admin de l'organisation peut en faire. Vous n'êtes
				jamais limité.
			</p>
			<input type="hidden" name="id" value={target?.id} />
			<RadioGroup legend="Verrouillage" bind:value={lockValue} options={folderLockOptions} />
			<input type="hidden" name="lock" value={lockValue} />
			<div class="form-submit">
				<Button type="submit" icon={Lock} loading={busy}>Enregistrer</Button>
			</div>
		</form>
	</Modal>
{/if}

{#if b.canEditContent}
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
{/if}

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

<Modal id={DELETE_FILE_MODAL_ID} title="Supprimer le fichier">
	<p class="confirm-text">
		Supprimer <strong>{fileToDelete?.name}</strong> ? Il disparaît aussi des sites qui l'affichent, et
		son espace est libéré. Cette action est <strong>irréversible</strong>.
	</p>
	<form
		method="POST"
		action="?/deleteFile"
		class="confirm-actions"
		use:enhance={toastEnhance({
			success: 'Fichier supprimé.',
			onSuccess: () => modal(DELETE_FILE_MODAL_ID)?.close(),
			setBusy
		})}
	>
		<input type="hidden" name="id" value={fileToDelete?.id} />
		<Button type="button" variant="ghost" onclick={() => modal(DELETE_FILE_MODAL_ID)?.close()}>Annuler</Button>
		<Button type="submit" variant="danger" icon={Trash2} loading={busy}>Supprimer définitivement</Button>
	</form>
</Modal>

<style>
	.thumb {
		display: block;
		width: 48px;
		height: 48px;
		border-radius: var(--radius-md);
		object-fit: cover;
		background: var(--bg-muted);
	}
	.thumb-icon {
		display: grid;
		place-items: center;
		color: var(--text-subtle);
	}
	.slug {
		font-size: 12px;
		color: var(--text-subtle);
	}
	.file-name {
		max-width: 320px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.file-link {
		display: block;
		color: var(--text-heading);
		text-decoration: none;
	}
	.file-link:hover {
		color: var(--primary);
		text-decoration: underline;
	}
	.file-error {
		font-size: 12px;
		color: var(--danger);
	}
	.lock {
		margin-left: 8px;
	}
	.folder-id {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
		margin: 0;
		font-size: 13px;
		color: var(--text-muted);
	}
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
