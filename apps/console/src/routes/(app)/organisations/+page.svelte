<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import {
		Alert,
		Badge,
		Button,
		ButtonAction,
		ButtonActionItem,
		Input,
		Modal,
		Pagination,
		SearchFilters,
		Select,
		Switch,
		Table
	} from '@guillaumeg/ui';
	import { EllipsisVertical, LogIn, Pencil, Plus, Trash2 } from '@lucide/svelte';
	import SuperTitle from '$lib/components/SuperTitle.svelte';
	import TemporaryPassword from '$lib/components/TemporaryPassword.svelte';
	import { PER_PAGE_OPTIONS } from '$lib/constants';
	import {
		DEFAULT_QUOTA_BYTES,
		formatBytes,
		offerLabel,
		orgRoleLabel,
		quotaOptions,
		usageBadgeVariant,
		usageLevel,
		usagePercent
	} from '$lib/records/organization';
	import { organizationCreateSchema, organizationUpdateSchema } from '$lib/schemas/organization';
	import { FieldErrors } from '$lib/utils/fieldErrors.svelte';
	import { toastEnhance } from '$lib/utils/toastEnhance';
	import type { CreatedOrganization, OrganizationListItem } from '$lib/viewmodels/organization';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const isSuperadmin = $derived(page.data.isSuperadmin as boolean);
	const activeOrgId = $derived((page.data.organization as { id: string } | null)?.id ?? null);
	const pageCount = $derived(Math.max(1, Math.ceil(data.total / data.perPage)));

	const FORM_MODAL_ID = 'organization-form';
	const DELETE_MODAL_ID = 'organization-delete';
	const PASSWORD_MODAL_ID = 'organization-owner-password';

	let busy = $state(false);
	const setBusy = (v: boolean) => (busy = v);

	// Create / edit share one modal; `editing` null = creation.
	let editing = $state<OrganizationListItem | null>(null);
	let fName = $state('');
	let fQuota = $state(String(DEFAULT_QUOTA_BYTES));
	let fStorage = $state(true);
	const formErrors = new FieldErrors(
		['name', 'quotaBytes', 'ownerName', 'ownerEmail'],
		() => (editing ? organizationUpdateSchema : organizationCreateSchema)
	);

	let toDelete = $state<OrganizationListItem | null>(null);
	let created = $state<CreatedOrganization | null>(null);

	// « Ouvrir » submits one hidden form with the chosen id.
	let openForm: HTMLFormElement | undefined = $state();
	let openId = $state('');

	function modal(id: string) {
		return document.getElementById(id) as HTMLDialogElement | null;
	}

	function goToPage(p: number) {
		const params = new URLSearchParams(page.url.searchParams);
		params.set('page', String(p));
		goto(`?${params.toString()}`);
	}

	function setPerPage(pp: number) {
		const params = new URLSearchParams(page.url.searchParams);
		params.set('perPage', String(pp));
		params.set('page', '1');
		goto(`?${params.toString()}`);
	}

	function openCreate() {
		editing = null;
		fName = '';
		fQuota = String(DEFAULT_QUOTA_BYTES);
		fStorage = true;
		formErrors.clear();
		modal(FORM_MODAL_ID)?.showModal();
	}

	function openEdit(org: OrganizationListItem) {
		editing = org;
		fName = org.name;
		fQuota = String(org.quotaBytes);
		fStorage = org.storageEnabled;
		formErrors.clear();
		modal(FORM_MODAL_ID)?.showModal();
	}

	function openDelete(org: OrganizationListItem) {
		toDelete = org;
		modal(DELETE_MODAL_ID)?.showModal();
	}

	async function switchTo(org: OrganizationListItem) {
		openId = org.id;
		await tick();
		openForm?.requestSubmit();
	}

	/** After a creation: show the owner's one-time password, if an account was created. */
	async function onSaved(d: Record<string, unknown>) {
		modal(FORM_MODAL_ID)?.close();
		const result = d.created as CreatedOrganization | undefined;
		if (result?.temporaryPassword) {
			created = result;
			await tick();
			modal(PASSWORD_MODAL_ID)?.showModal();
		}
	}
</script>

{#snippet nameCell(org: OrganizationListItem)}
	<div class="name">
		<span class="strong">{org.name}</span>
		{#if org.id === activeOrgId}<Badge label="Active" variant="success" />{/if}
	</div>
	<div class="slug">{org.slug}</div>
{/snippet}

{#snippet offerCell(org: OrganizationListItem)}
	<Badge label={offerLabel(org.storageEnabled)} variant={org.storageEnabled ? 'primary' : 'default'} />
{/snippet}

{#snippet quotaCell(org: OrganizationListItem)}
	{#if org.storageEnabled}
		<div class="usage">
			<span>{formatBytes(org.usedBytes)} / {formatBytes(org.quotaBytes)}</span>
			<Badge
				label={`${usagePercent(org.usedBytes, org.quotaBytes)} %`}
				variant={usageBadgeVariant[usageLevel(org.usedBytes, org.quotaBytes)]}
			/>
		</div>
	{:else}
		—
	{/if}
{/snippet}

{#snippet roleCell(org: OrganizationListItem)}
	{org.myRole ? orgRoleLabel[org.myRole] : '—'}
{/snippet}

{#snippet actionsCell(org: OrganizationListItem)}
	<div class="actions">
		<ButtonAction label="Actions" icon={EllipsisVertical} variant="ghost" size="sm">
			{#snippet items(close)}
				<ButtonActionItem
					label="Travailler dans cette organisation"
					icon={LogIn}
					onclick={() => {
						switchTo(org);
						close();
					}}
				/>
				{#if isSuperadmin}
					<ButtonActionItem
						label="Modifier"
						icon={Pencil}
						onclick={() => {
							openEdit(org);
							close();
						}}
					/>
					<ButtonActionItem
						label="Supprimer"
						icon={Trash2}
						variant="danger"
						onclick={() => {
							openDelete(org);
							close();
						}}
					/>
				{/if}
			{/snippet}
		</ButtonAction>
	</div>
{/snippet}

<div class="page">
	<SuperTitle
		headingLevel="h1"
		title="Organisations"
		slogan={isSuperadmin
			? 'Les clients de cette instance, leur offre et leur forfait de stockage.'
			: 'Les organisations dont vous êtes membre.'}
	>
		<Badge label={`${data.total} organisation${data.total > 1 ? 's' : ''}`} variant="default" />
		{#if isSuperadmin}
			<Button icon={Plus} onclick={openCreate}>Nouvelle organisation</Button>
		{/if}
	</SuperTitle>

	<SearchFilters collapsible columns={1} loading={!!navigating.to} title="Rechercher" urlDriven>
		<Input label="Nom ou identifiant" name="q" placeholder="Rechercher une organisation…" />
	</SearchFilters>

	<Table
		rows={data.items}
		emptyLabel="Aucune organisation trouvée."
		columns={[
			{ key: 'name', label: 'Organisation', cell: nameCell },
			{ key: 'storageEnabled', label: 'Offre', cell: offerCell },
			{ key: 'quotaBytes', label: 'Stockage (utilisé / forfait)', cell: quotaCell },
			{ key: 'memberCount', label: 'Membres', align: 'right' },
			{ key: 'applicationCount', label: 'Applications', align: 'right' },
			{ key: 'myRole', label: 'Mon rôle', cell: roleCell },
			{ key: 'id', label: '', align: 'right', cell: actionsCell }
		]}
	/>

	<div class="pager">
		<span class="count">{data.total} organisation{data.total > 1 ? 's' : ''}</span>
		<Pagination
			page={data.page}
			total={pageCount}
			perPage={data.perPage}
			perPageOptions={PER_PAGE_OPTIONS}
			onchange={goToPage}
			onPerPageChange={setPerPage}
		/>
	</div>
</div>

<form bind:this={openForm} method="POST" action="?/open" use:enhance hidden>
	<input type="hidden" name="id" value={openId} />
</form>

<Modal id={FORM_MODAL_ID} title={editing ? "Modifier l'organisation" : 'Nouvelle organisation'}>
	<form
		method="POST"
		action={editing ? '?/update' : '?/create'}
		class="form"
		novalidate
		oninput={formErrors.oninput}
		onfocusout={formErrors.onfocusout}
		use:enhance={toastEnhance({
			success: () => (editing ? 'Organisation mise à jour.' : 'Organisation créée.'),
			onSuccess: onSaved,
			setBusy,
			fields: formErrors
		})}
	>
		{#if editing}<input type="hidden" name="id" value={editing.id} />{/if}
		<Input bind:value={fName} error={formErrors.get('name')} label="Nom" name="name" required />

		<Switch bind:checked={fStorage} label="Option stockage (offre « Accès + Stockage »)" />
		<input type="hidden" name="storageEnabled" value={fStorage ? 'on' : ''} />
		<Select
			bind:value={fQuota}
			error={formErrors.get('quotaBytes')}
			label="Forfait de stockage"
			name="quotaBytes"
			options={quotaOptions}
			disabled={!fStorage}
		/>
		{#if !fStorage}
			<!-- A disabled select is not posted: keep the current tier. -->
			<input type="hidden" name="quotaBytes" value={fQuota} />
		{/if}

		{#if !editing}
			<div class="section-title">Admin</div>
			<Input error={formErrors.get('ownerName')} label="Nom" name="ownerName" required />
			<Input
				error={formErrors.get('ownerEmail')}
				label="E-mail"
				name="ownerEmail"
				type="email"
				required
				hint="S'il n'a pas encore de compte, un mot de passe temporaire est généré."
			/>
		{/if}

		<div class="form-submit">
			<Button type="submit" icon={editing ? undefined : Plus} loading={busy}>
				{editing ? 'Enregistrer' : "Créer l'organisation"}
			</Button>
		</div>
	</form>
</Modal>

<Modal id={DELETE_MODAL_ID} title="Supprimer l'organisation">
	<p class="confirm-text">
		Supprimer <strong>{toDelete?.name}</strong> ? Ses applications et ses accès sont supprimés. Les
		comptes de ses membres sont conservés. Cette action est <strong>irréversible</strong>.
	</p>
	{#if toDelete?.siteFileCount}
		<div class="warning">
			<Alert variant="warning" title="Fichiers envoyés par ses sites">
				{toDelete.siteFileCount} fichier{toDelete.siteFileCount > 1 ? 's' : ''} envoyé{toDelete.siteFileCount > 1 ? 's' : ''}
				par ses sites {toDelete.siteFileCount > 1 ? 'seront supprimés' : 'sera supprimé'} : les sites ne pourront plus
				{toDelete.siteFileCount > 1 ? 'les afficher' : 'l’afficher'}.
			</Alert>
		</div>
	{/if}
	<form
		method="POST"
		action="?/delete"
		class="confirm-actions"
		use:enhance={toastEnhance({
			success: 'Organisation supprimée.',
			onSuccess: () => modal(DELETE_MODAL_ID)?.close(),
			setBusy
		})}
	>
		<input type="hidden" name="id" value={toDelete?.id} />
		<Button type="button" variant="ghost" onclick={() => modal(DELETE_MODAL_ID)?.close()}>Annuler</Button>
		<Button type="submit" variant="danger" icon={Trash2} loading={busy}>Supprimer définitivement</Button>
	</form>
</Modal>

{#if created?.temporaryPassword}
	<TemporaryPassword id={PASSWORD_MODAL_ID} email={created.ownerEmail} password={created.temporaryPassword} />
{/if}

<style>
	.usage {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.name {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.slug {
		font-size: 12px;
		color: var(--text-subtle);
		font-family: var(--font-mono, monospace);
	}
	.actions {
		display: flex;
		justify-content: flex-end;
	}
	.warning {
		margin-bottom: 16px;
	}
	.section-title {
		margin-top: 6px;
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-subtle);
	}
</style>
