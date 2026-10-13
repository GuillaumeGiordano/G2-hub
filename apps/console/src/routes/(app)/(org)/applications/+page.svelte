<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import {
		Alert,
		Badge,
		Button,
		ButtonAction,
		ButtonActionItem,
		EmptyState,
		Input,
		Modal,
		Table,
		TagInput
	} from '@guillaumeg/ui';
	import { AppWindow, EllipsisVertical, Pencil, Plus, Trash2 } from '@lucide/svelte';
	import SuperTitle from '$lib/components/SuperTitle.svelte';
	import { applicationSchema, applicationUpdateSchema } from '$lib/schemas/application';
	import { FieldErrors } from '$lib/utils/fieldErrors.svelte';
	import { toastEnhance } from '$lib/utils/toastEnhance';
	import type { ApplicationListItem } from '$lib/viewmodels/application';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const organizationName = $derived((page.data.organization as { name: string }).name);
	const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' });

	const FORM_MODAL_ID = 'application-form';
	const DELETE_MODAL_ID = 'application-delete';

	let busy = $state(false);
	const setBusy = (v: boolean) => (busy = v);

	// Create / edit share one modal; `editing` null = creation.
	let editing = $state<ApplicationListItem | null>(null);
	let fName = $state('');
	let fOrigins = $state<string[]>([]);
	const formErrors = new FieldErrors(['name', 'origins', 'origins.*'], () =>
		editing ? applicationUpdateSchema : applicationSchema
	);
	// One message under the tag field: the list's own error or the first bad origin's.
	const originsError = $derived(
		formErrors.get('origins') ||
			(Object.entries(formErrors.errors).find(([key]) => key.startsWith('origins.'))?.[1] ?? '')
	);

	let toDelete = $state<ApplicationListItem | null>(null);

	function modal(id: string) {
		return document.getElementById(id) as HTMLDialogElement | null;
	}

	function openCreate() {
		editing = null;
		fName = '';
		fOrigins = [];
		formErrors.clear();
		modal(FORM_MODAL_ID)?.showModal();
	}

	function openEdit(app: ApplicationListItem) {
		editing = app;
		fName = app.name;
		fOrigins = [...app.allowedOrigins];
		formErrors.clear();
		modal(FORM_MODAL_ID)?.showModal();
	}

	function openDelete(app: ApplicationListItem) {
		toDelete = app;
		modal(DELETE_MODAL_ID)?.showModal();
	}

	/** The tag field has no `name`: editing it clears its errors (indexes shift on removal). */
	function onOriginsChange() {
		formErrors.clearGroup('origins');
	}
</script>

{#snippet nameCell(app: ApplicationListItem)}
	<a class="app-link strong" href={`/applications/${app.id}`}>{app.name}</a>
	<div class="slug">{app.slug}</div>
{/snippet}

{#snippet originsCell(app: ApplicationListItem)}
	{#if app.allowedOrigins.length}
		<div class="origins">
			{#each app.allowedOrigins as origin (origin)}<Badge label={origin} variant="default" />{/each}
		</div>
	{:else}
		<span class="muted">Aucune</span>
	{/if}
{/snippet}

{#snippet dateCell(app: ApplicationListItem)}
	{dateFormat.format(app.createdAt)}
{/snippet}

{#snippet actionsCell(app: ApplicationListItem)}
	<div class="actions">
		<ButtonAction label="Actions" icon={EllipsisVertical} variant="ghost" size="sm">
			{#snippet items(close)}
				<ButtonActionItem
					label="Modifier"
					icon={Pencil}
					onclick={() => {
						openEdit(app);
						close();
					}}
				/>
				<ButtonActionItem
					label="Supprimer"
					icon={Trash2}
					variant="danger"
					onclick={() => {
						openDelete(app);
						close();
					}}
				/>
			{/snippet}
		</ButtonAction>
	</div>
{/snippet}

<div class="page">
	<SuperTitle
		headingLevel="h1"
		title="Applications"
		slogan={`Les sites et portails de ${organizationName} branchés sur le hub.`}
	>
		{#if data.canManage}
			<Button icon={Plus} onclick={openCreate}>Nouvelle application</Button>
		{/if}
	</SuperTitle>

	{#if data.applications.length === 0}
		<EmptyState
			icon={AppWindow}
			title="Aucune application"
			description="Une application représente un site ou un portail qui utilisera le hub."
			cta={data.canManage ? { label: 'Créer une application', onclick: openCreate } : undefined}
		/>
	{:else}
		<Table
			rows={data.applications}
			columns={[
				{ key: 'name', label: 'Application', cell: nameCell },
				{ key: 'allowedOrigins', label: 'Origines autorisées', cell: originsCell },
				{ key: 'createdAt', label: 'Créée le', cell: dateCell },
				...(data.canManage
					? [{ key: 'id' as const, label: '', align: 'right' as const, cell: actionsCell }]
					: [])
			]}
		/>
	{/if}
</div>

<Modal id={FORM_MODAL_ID} title={editing ? "Modifier l'application" : 'Nouvelle application'}>
	<form
		method="POST"
		action={editing ? '?/update' : '?/create'}
		class="form"
		novalidate
		oninput={formErrors.oninput}
		onfocusout={formErrors.onfocusout}
		use:enhance={toastEnhance({
			success: () => (editing ? 'Application mise à jour.' : 'Application créée.'),
			onSuccess: () => modal(FORM_MODAL_ID)?.close(),
			setBusy,
			fields: formErrors
		})}
	>
		{#if editing}<input type="hidden" name="id" value={editing.id} />{/if}
		<Input bind:value={fName} error={formErrors.get('name')} label="Nom" name="name" required />

		<TagInput
			bind:tags={fOrigins}
			label="Origines autorisées"
			placeholder="https://monsite.fr puis Entrée"
			hint="Domaines depuis lesquels un navigateur pourra appeler l'API (CORS). Sans chemin."
			error={originsError}
			onchange={onOriginsChange}
		/>
		<input type="hidden" name="origins" value={JSON.stringify(fOrigins)} />

		<div class="form-submit">
			<Button type="submit" icon={editing ? undefined : Plus} loading={busy}>
				{editing ? 'Enregistrer' : "Créer l'application"}
			</Button>
		</div>
	</form>
</Modal>

<Modal id={DELETE_MODAL_ID} title="Supprimer l'application">
	<p class="confirm-text">
		Supprimer <strong>{toDelete?.name}</strong> ? Le site ou portail qui l'utilise ne pourra plus
		appeler le hub. Cette action est <strong>irréversible</strong>.
	</p>
	{#if toDelete?.siteFileCount}
		<div class="warning">
			<Alert variant="warning" title="Fichiers envoyés par le site">
				{toDelete.siteFileCount} fichier{toDelete.siteFileCount > 1 ? 's' : ''} envoyé{toDelete.siteFileCount > 1 ? 's' : ''}
				par le site {toDelete.siteFileCount > 1 ? 'seront supprimés' : 'sera supprimé'} : le site ne pourra plus
				{toDelete.siteFileCount > 1 ? 'les afficher' : 'l’afficher'}.
			</Alert>
		</div>
	{/if}
	<form
		method="POST"
		action="?/delete"
		class="confirm-actions"
		use:enhance={toastEnhance({
			success: 'Application supprimée.',
			onSuccess: () => modal(DELETE_MODAL_ID)?.close(),
			setBusy
		})}
	>
		<input type="hidden" name="id" value={toDelete?.id} />
		<Button type="button" variant="ghost" onclick={() => modal(DELETE_MODAL_ID)?.close()}>Annuler</Button>
		<Button type="submit" variant="danger" icon={Trash2} loading={busy}>Supprimer définitivement</Button>
	</form>
</Modal>

<style>
	.app-link {
		text-decoration: none;
	}
	.app-link:hover {
		color: var(--primary);
		text-decoration: underline;
	}
	.slug {
		font-size: 12px;
		color: var(--text-subtle);
		font-family: var(--font-mono, monospace);
	}
	.warning {
		margin-bottom: 16px;
	}
	.origins {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
	}
</style>
