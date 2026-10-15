<script lang="ts">
	import { orgPath } from '$lib/utils/orgPath';
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import {
		Badge,
		Breadcrumb,
		Button,
		ButtonAction,
		ButtonActionItem,
		EmptyState,
		Input,
		Modal,
		Pagination,
		SearchFilters,
		Select,
		Table
	} from '@guillaumeg/ui';
	import { EllipsisVertical, KeyRound, LogOut, Pencil, Send, Trash2, UserCheck, UserPlus, Users, UserX } from '@lucide/svelte';
	import PageTabs from '$lib/components/PageTabs.svelte';
	import SuperTitle from '$lib/components/SuperTitle.svelte';
	import { PER_PAGE_OPTIONS } from '$lib/constants';
	import {
		appUserRoleLabel,
		appUserRoleOptions,
		appUserRoleVariant,
		appUserStatusLabel,
		appUserStatusVariant,
		DEFAULT_APP_USER_ROLE,
		INVITATION_VALID_DAYS
	} from '$lib/records/appUsers';
	import { applicationTabs } from '$lib/records/navigation';
	import { formatBytes } from '$lib/records/organization';
	import { appUserInviteSchema, appUserUpdateSchema } from '$lib/schemas/appUser';
	import { FieldErrors } from '$lib/utils/fieldErrors.svelte';
	import { timeAgo } from '$lib/utils/timeAgo';
	import { toastEnhance } from '$lib/utils/toastEnhance';
	import type { AppUserListItem } from '$lib/viewmodels/appUser';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const tabs = $derived(applicationTabs(page.params.org!, data.application.id, data.canManageKeys));
	const crumbs = $derived([
		{ label: 'Applications', href: orgPath(page.params.org!, '/applications') },
		{ label: data.application.name, href: orgPath(page.params.org!, `/applications/${data.application.id}`) },
		{ label: 'Utilisateurs' }
	]);
	const pageCount = $derived(Math.max(1, Math.ceil(data.total / data.perPage)));
	const searching = $derived(!!page.url.searchParams.get('q'));
	const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

	const INVITE_MODAL_ID = 'app-user-invite';
	const EDIT_MODAL_ID = 'app-user-edit';
	const DELETE_MODAL_ID = 'app-user-delete';

	let busy = $state(false);
	const setBusy = (v: boolean) => (busy = v);

	const inviteErrors = new FieldErrors(['name', 'email', 'role'], appUserInviteSchema);
	let inviteRole = $state<string>(DEFAULT_APP_USER_ROLE);
	let target = $state<AppUserListItem | null>(null);
	let editRole = $state<string>(DEFAULT_APP_USER_ROLE);
	const editErrors = new FieldErrors(['name', 'email', 'role'], appUserUpdateSchema);

	// The one-click actions (resend, disable, revoke, reset) submit one hidden form each.
	let resendForm: HTMLFormElement | undefined = $state();
	let disableForm: HTMLFormElement | undefined = $state();
	let revokeForm: HTMLFormElement | undefined = $state();
	let resetForm: HTMLFormElement | undefined = $state();
	let disableValue = $state(false);

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

	function openInvite() {
		inviteRole = DEFAULT_APP_USER_ROLE;
		inviteErrors.clear();
		modal(INVITE_MODAL_ID)?.showModal();
	}

	function openEdit(user: AppUserListItem) {
		target = user;
		editRole = user.role;
		editErrors.clear();
		modal(EDIT_MODAL_ID)?.showModal();
	}

	function openDelete(user: AppUserListItem) {
		target = user;
		modal(DELETE_MODAL_ID)?.showModal();
	}

	/** Submit one of the hidden forms for `user`. */
	async function submitFor(user: AppUserListItem, form: HTMLFormElement | undefined) {
		target = user;
		await tick();
		form?.requestSubmit();
	}

	async function setDisabled(user: AppUserListItem, disabled: boolean) {
		target = user;
		disableValue = disabled;
		await tick();
		disableForm?.requestSubmit();
	}
</script>

{#snippet nameCell(user: AppUserListItem)}
	<div class="strong">{user.name}</div>
	<div class="email">{user.email}</div>
{/snippet}

{#snippet roleCell(user: AppUserListItem)}
	<Badge label={appUserRoleLabel[user.role]} variant={appUserRoleVariant[user.role]} />
{/snippet}

{#snippet statusCell(user: AppUserListItem)}
	<div class="badges">
		<Badge label={appUserStatusLabel[user.status]} variant={appUserStatusVariant[user.status]} />
		{#if user.invitationExpired}<Badge label="Lien expiré" variant="warning" />{/if}
	</div>
{/snippet}

{#snippet activityCell(user: AppUserListItem)}
	<div class="activity">
		<span class="dot" class:online={user.signedIn} aria-hidden="true"></span>
		<div>
			<div>{user.signedIn ? 'Connecté au portail' : user.lastLoginAt ? 'Hors ligne' : 'Jamais connecté'}</div>
			{#if user.lastLoginAt}
				<div class="email" title={dateFormat.format(user.lastLoginAt)}>dernière connexion {timeAgo(user.lastLoginAt)}</div>
			{/if}
		</div>
	</div>
{/snippet}

{#snippet spaceCell(user: AppUserListItem)}
	{#if user.personalFiles > 0}
		<div>{formatBytes(user.personalBytes)}</div>
		<div class="email">{user.personalFiles} fichier{user.personalFiles > 1 ? 's' : ''}</div>
	{:else}
		<span class="muted">—</span>
	{/if}
{/snippet}

{#snippet actionsCell(user: AppUserListItem)}
	<div class="actions">
		{#if data.canManage}
			<ButtonAction label="Actions" icon={EllipsisVertical} variant="ghost" size="sm">
				{#snippet items(close)}
					<ButtonActionItem
						label="Modifier le compte"
						icon={Pencil}
						onclick={() => {
							openEdit(user);
							close();
						}}
					/>
					{#if user.status === 'INVITED'}
						<ButtonActionItem
							label="Renvoyer l'invitation"
							icon={Send}
							onclick={() => {
								submitFor(user, resendForm);
								close();
							}}
						/>
					{/if}
					{#if user.status === 'ACTIVE'}
						<ButtonActionItem
							label="Réinitialiser le mot de passe"
							icon={KeyRound}
							onclick={() => {
								submitFor(user, resetForm);
								close();
							}}
						/>
						<ButtonActionItem
							label="Révoquer les sessions"
							icon={LogOut}
							onclick={() => {
								submitFor(user, revokeForm);
								close();
							}}
						/>
					{/if}
					{#if user.status === 'DISABLED'}
						<ButtonActionItem
							label="Réactiver"
							icon={UserCheck}
							onclick={() => {
								setDisabled(user, false);
								close();
							}}
						/>
					{:else}
						<ButtonActionItem
							label="Désactiver"
							icon={UserX}
							onclick={() => {
								setDisabled(user, true);
								close();
							}}
						/>
					{/if}
					<ButtonActionItem
						label="Supprimer"
						icon={Trash2}
						variant="danger"
						onclick={() => {
							openDelete(user);
							close();
						}}
					/>
				{/snippet}
			</ButtonAction>
		{/if}
	</div>
{/snippet}

<div class="page">
	<Breadcrumb items={crumbs} />
	<SuperTitle
		headingLevel="h1"
		title={data.application.name}
		slogan="Les personnes qui se connectent au portail de cette application. Elles n'ont pas accès à la console."
	>
		<Badge label={`${data.total} utilisateur${data.total > 1 ? 's' : ''}`} variant="default" />
		{#if data.canManage}
			<Button icon={UserPlus} onclick={openInvite}>Inviter</Button>
		{/if}
	</SuperTitle>
	<PageTabs {tabs} />

	{#if data.total === 0 && !searching}
		<EmptyState
			icon={Users}
			title="Aucun utilisateur"
			description="Invitez une personne : elle reçoit un e-mail pour choisir son mot de passe."
			cta={data.canManage ? { label: 'Inviter un utilisateur', onclick: openInvite } : undefined}
		/>
	{:else}
		<SearchFilters collapsible columns={1} loading={!!navigating.to} title="Rechercher" urlDriven>
			<Input label="Nom ou e-mail" name="q" placeholder="Rechercher un utilisateur…" />
		</SearchFilters>

		<Table
			rows={data.items}
			emptyLabel="Aucun utilisateur trouvé."
			columns={[
				{ key: 'name', label: 'Utilisateur', cell: nameCell },
				{ key: 'role', label: 'Rôle', cell: roleCell },
				{ key: 'status', label: 'État', cell: statusCell },
				{ key: 'lastLoginAt', label: 'Activité', cell: activityCell },
				{ key: 'personalBytes', label: 'Espace personnel', align: 'right', cell: spaceCell },
				{ key: 'id', label: '', align: 'right', cell: actionsCell }
			]}
		/>

		<div class="pager">
			<span class="count">{data.total} utilisateur{data.total > 1 ? 's' : ''}</span>
			<Pagination
				page={data.page}
				total={pageCount}
				perPage={data.perPage}
				perPageOptions={PER_PAGE_OPTIONS}
				onchange={goToPage}
				onPerPageChange={setPerPage}
			/>
		</div>
	{/if}
</div>

<form
	bind:this={resendForm}
	method="POST"
	action="?/resend"
	hidden
	use:enhance={toastEnhance({ success: (d) => `Invitation renvoyée à ${d.resent}.`, setBusy })}
>
	<input type="hidden" name="id" value={target?.id} />
</form>

<form
	bind:this={revokeForm}
	method="POST"
	action="?/revoke"
	hidden
	use:enhance={toastEnhance({ success: (d) => `Sessions de ${d.revoked} révoquées.`, setBusy })}
>
	<input type="hidden" name="id" value={target?.id} />
</form>

<form
	bind:this={resetForm}
	method="POST"
	action="?/reset"
	hidden
	use:enhance={toastEnhance({ success: (d) => `Lien de réinitialisation envoyé à ${d.reset}.`, setBusy })}
>
	<input type="hidden" name="id" value={target?.id} />
</form>

<form
	bind:this={disableForm}
	method="POST"
	action="?/disable"
	hidden
	use:enhance={toastEnhance({ success: (d) => (d.disabled ? 'Compte désactivé.' : 'Compte réactivé.'), setBusy })}
>
	<input type="hidden" name="id" value={target?.id} />
	<input type="hidden" name="disabled" value={String(disableValue)} />
</form>

<Modal id={INVITE_MODAL_ID} title="Inviter un utilisateur">
	<form
		method="POST"
		action="?/invite"
		class="form"
		novalidate
		oninput={inviteErrors.oninput}
		onfocusout={inviteErrors.onfocusout}
		use:enhance={toastEnhance({
			success: 'Invitation envoyée.',
			onSuccess: () => modal(INVITE_MODAL_ID)?.close(),
			resetOnSuccess: true,
			setBusy,
			fields: inviteErrors
		})}
	>
		<Input error={inviteErrors.get('name')} label="Nom" name="name" required />
		<Input
			error={inviteErrors.get('email')}
			label="E-mail"
			name="email"
			type="email"
			required
			hint={`Un e-mail lui permet de choisir son mot de passe (lien valable ${INVITATION_VALID_DAYS} jours).`}
		/>
		<Select
			bind:value={inviteRole}
			error={inviteErrors.get('role')}
			label="Rôle"
			name="role"
			options={appUserRoleOptions}
			hint="Transmis au portail, qui décide de ce que chaque rôle peut faire."
		/>
		<div class="form-submit">
			<Button type="submit" icon={Send} loading={busy}>Envoyer l'invitation</Button>
		</div>
	</form>
</Modal>

<Modal id={EDIT_MODAL_ID} title="Modifier le compte">
	<form
		method="POST"
		action="?/update"
		class="form"
		novalidate
		oninput={editErrors.oninput}
		onfocusout={editErrors.onfocusout}
		use:enhance={toastEnhance({
			success: (d) =>
				d.invitationRevoked
					? "Compte mis à jour. L'invitation partait à l'ancienne adresse : renvoyez-la."
					: 'Compte mis à jour.',
			onSuccess: () => modal(EDIT_MODAL_ID)?.close(),
			setBusy,
			fields: editErrors
		})}
	>
		{#if target}
			{#key target.id}
				<input type="hidden" name="id" value={target.id} />
				<Input error={editErrors.get('name')} label="Nom" name="name" value={target.name} required />
				<Input error={editErrors.get('email')} label="E-mail" name="email" type="email" value={target.email} required />
				<Select bind:value={editRole} error={editErrors.get('role')} label="Rôle" name="role" options={appUserRoleOptions} />
			{/key}
		{/if}
		<p class="hint">
			Changer l'e-mail ou le rôle déconnecte la personne du portail : elle se reconnecte pour en profiter.
		</p>
		<div class="form-submit">
			<Button type="submit" loading={busy}>Enregistrer</Button>
		</div>
	</form>
</Modal>

<Modal id={DELETE_MODAL_ID} title="Supprimer l'utilisateur">
	<p class="confirm-text">
		Supprimer le compte de <strong>{target?.name}</strong> ({target?.email}) ? Il ne pourra plus se
		connecter au portail, et les fichiers de son espace personnel sont supprimés. Cette action est
		<strong>irréversible</strong> — pour suspendre l'accès seulement, désactivez le compte.
	</p>
	<form
		method="POST"
		action="?/delete"
		class="confirm-actions"
		use:enhance={toastEnhance({
			success: 'Utilisateur supprimé.',
			onSuccess: () => modal(DELETE_MODAL_ID)?.close(),
			setBusy
		})}
	>
		<input type="hidden" name="id" value={target?.id} />
		<Button type="button" variant="ghost" onclick={() => modal(DELETE_MODAL_ID)?.close()}>Annuler</Button>
		<Button type="submit" variant="danger" icon={Trash2} loading={busy}>Supprimer</Button>
	</form>
</Modal>

<style>
	.email {
		font-size: 12px;
		color: var(--text-subtle);
	}
	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
	}
	.activity {
		display: flex;
		align-items: flex-start;
		gap: 8px;
	}
	.dot {
		flex: none;
		width: 8px;
		height: 8px;
		margin-top: 6px;
		border-radius: 50%;
		background: var(--text-subtle);
	}
	.dot.online {
		background: var(--success);
	}
	.hint {
		font-size: 13px;
		color: var(--text-muted);
		margin: 0;
	}
</style>
