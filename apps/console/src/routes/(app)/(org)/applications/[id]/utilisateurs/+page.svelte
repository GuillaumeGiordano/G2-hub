<script lang="ts">
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
		Table
	} from '@guillaumeg/ui';
	import { EllipsisVertical, Send, Trash2, UserCheck, UserPlus, Users, UserX } from '@lucide/svelte';
	import PageTabs from '$lib/components/PageTabs.svelte';
	import SuperTitle from '$lib/components/SuperTitle.svelte';
	import { PER_PAGE_OPTIONS } from '$lib/constants';
	import { appUserStatusLabel, appUserStatusVariant, INVITATION_VALID_DAYS } from '$lib/records/appUsers';
	import { applicationTabs } from '$lib/records/navigation';
	import { appUserInviteSchema } from '$lib/schemas/appUser';
	import { FieldErrors } from '$lib/utils/fieldErrors.svelte';
	import { toastEnhance } from '$lib/utils/toastEnhance';
	import type { AppUserListItem } from '$lib/viewmodels/appUser';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const tabs = $derived(applicationTabs(data.application.id, data.canManageKeys));
	const crumbs = $derived([
		{ label: 'Applications', href: '/applications' },
		{ label: data.application.name, href: `/applications/${data.application.id}` },
		{ label: 'Utilisateurs' }
	]);
	const pageCount = $derived(Math.max(1, Math.ceil(data.total / data.perPage)));
	const searching = $derived(!!page.url.searchParams.get('q'));
	const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

	const INVITE_MODAL_ID = 'app-user-invite';
	const DELETE_MODAL_ID = 'app-user-delete';

	let busy = $state(false);
	const setBusy = (v: boolean) => (busy = v);

	const inviteErrors = new FieldErrors(['name', 'email'], appUserInviteSchema);
	let target = $state<AppUserListItem | null>(null);

	// « Renvoyer l'invitation » and « Désactiver / Réactiver » submit one hidden form each.
	let resendForm: HTMLFormElement | undefined = $state();
	let disableForm: HTMLFormElement | undefined = $state();
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
		inviteErrors.clear();
		modal(INVITE_MODAL_ID)?.showModal();
	}

	function openDelete(user: AppUserListItem) {
		target = user;
		modal(DELETE_MODAL_ID)?.showModal();
	}

	async function resend(user: AppUserListItem) {
		target = user;
		await tick();
		resendForm?.requestSubmit();
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

{#snippet statusCell(user: AppUserListItem)}
	<div class="badges">
		<Badge label={appUserStatusLabel[user.status]} variant={appUserStatusVariant[user.status]} />
		{#if user.invitationExpired}<Badge label="Lien expiré" variant="warning" />{/if}
	</div>
{/snippet}

{#snippet lastLoginCell(user: AppUserListItem)}
	<span class="muted">{user.lastLoginAt ? dateFormat.format(user.lastLoginAt) : 'Jamais'}</span>
{/snippet}

{#snippet actionsCell(user: AppUserListItem)}
	<div class="actions">
		{#if data.canManage}
			<ButtonAction label="Actions" icon={EllipsisVertical} variant="ghost" size="sm">
				{#snippet items(close)}
					{#if user.status === 'INVITED'}
						<ButtonActionItem
							label="Renvoyer l'invitation"
							icon={Send}
							onclick={() => {
								resend(user);
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
				{ key: 'status', label: 'État', cell: statusCell },
				{ key: 'lastLoginAt', label: 'Dernière connexion', cell: lastLoginCell },
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
		<div class="form-submit">
			<Button type="submit" icon={Send} loading={busy}>Envoyer l'invitation</Button>
		</div>
	</form>
</Modal>

<Modal id={DELETE_MODAL_ID} title="Supprimer l'utilisateur">
	<p class="confirm-text">
		Supprimer le compte de <strong>{target?.name}</strong> ({target?.email}) ? Il ne pourra plus se
		connecter au portail. Cette action est <strong>irréversible</strong> — pour suspendre l'accès
		seulement, désactivez le compte.
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
</style>
