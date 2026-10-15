<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import {
		Badge,
		Button,
		ButtonAction,
		ButtonActionItem,
		EmptyState,
		Input,
		Modal,
		Pagination,
		SearchFilters,
		SelectSearchMulti,
		Table
	} from '@guillaumeg/ui';
	import {
		Building2,
		EllipsisVertical,
		KeyRound,
		LogOut,
		Pencil,
		Plus,
		Send,
		ShieldOff,
		Trash2,
		UserCheck,
		Users,
		UserX
	} from '@lucide/svelte';
	import SuperTitle from '$lib/components/SuperTitle.svelte';
	import { CONSOLE_INVITATION_VALID_DAYS, PER_PAGE_OPTIONS } from '$lib/constants';
	import { accountUpdateSchema } from '$lib/schemas/member';
	import { FieldErrors } from '$lib/utils/fieldErrors.svelte';
	import { orgPath } from '$lib/utils/orgPath';
	import { timeAgo } from '$lib/utils/timeAgo';
	import { toastEnhance } from '$lib/utils/toastEnhance';
	import type { ConsoleAccountListItem } from '$lib/viewmodels/member';
	import type { PageData } from './$types';

	// The console's « Membres » (§35): every console account (the Admins of the organizations) and the
	// organizations it is an Admin of. The superadmin adds an account to one or several organizations,
	// and changes them later.
	let { data }: { data: PageData } = $props();

	const pageCount = $derived(Math.max(1, Math.ceil(data.total / data.perPage)));
	const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

	const ADD_MODAL_ID = 'account-add';
	const ORGS_MODAL_ID = 'account-organizations';
	const EDIT_MODAL_ID = 'account-edit';
	const TWO_FACTOR_MODAL_ID = 'account-two-factor';
	const DELETE_MODAL_ID = 'account-delete';

	let busy = $state(false);
	const setBusy = (v: boolean) => (busy = v);

	// The organization ids are posted as one field each: validated on the server only.
	const addErrors = new FieldErrors(['name', 'email', 'organizationIds']);
	const orgsErrors = new FieldErrors(['organizationIds']);
	const editErrors = new FieldErrors(['name', 'email'], accountUpdateSchema);

	let target = $state<ConsoleAccountListItem | null>(null);
	let addOrganizations = $state<string[]>([]);
	let editOrganizations = $state<string[]>([]);

	// The one-click actions (resend, reset, revoke, disable) submit one hidden form each.
	let resendForm: HTMLFormElement | undefined = $state();
	let resetForm: HTMLFormElement | undefined = $state();
	let revokeForm: HTMLFormElement | undefined = $state();
	let disableForm: HTMLFormElement | undefined = $state();
	let disableValue = $state(false);

	function modal(id: string) {
		return document.getElementById(id) as HTMLDialogElement | null;
	}

	function openAdd() {
		addErrors.clear();
		addOrganizations = [];
		modal(ADD_MODAL_ID)?.showModal();
	}

	function open(id: string, account: ConsoleAccountListItem) {
		target = account;
		editErrors.clear();
		orgsErrors.clear();
		editOrganizations = account.organizations.map((o) => o.id);
		modal(id)?.showModal();
	}

	async function submitFor(account: ConsoleAccountListItem, form: HTMLFormElement | undefined, disabled = false) {
		target = account;
		disableValue = disabled;
		await tick();
		form?.requestSubmit();
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
</script>

{#snippet nameCell(account: ConsoleAccountListItem)}
	<div class="name">
		<span class="strong">{account.name}</span>
		{#if account.invited}<Badge label="Invité" variant="warning" />{/if}
		{#if account.disabled}<Badge label="Désactivé" variant="danger" />{/if}
	</div>
	<div class="email">{account.email}</div>
{/snippet}

{#snippet organizationsCell(account: ConsoleAccountListItem)}
	<div class="orgs">
		{#each account.organizations as org (org.id)}
			<a class="org" href={orgPath(org.id, '/membres')}>{org.name}</a>
		{:else}
			<span class="muted">—</span>
		{/each}
	</div>
{/snippet}

{#snippet twoFactorCell(account: ConsoleAccountListItem)}
	{#if account.twoFactorEnabled}
		<Badge label="Activée" variant="success" />
	{:else}
		<Badge label="Requise" variant="warning" />
	{/if}
{/snippet}

{#snippet activityCell(account: ConsoleAccountListItem)}
	<div class="activity">
		<span class="dot" class:online={account.signedIn} aria-hidden="true"></span>
		<div>
			<div>{account.signedIn ? 'Session ouverte' : account.lastActiveAt ? 'Déconnecté' : 'Aucune session'}</div>
			{#if account.lastActiveAt}
				<div class="email" title={dateFormat.format(account.lastActiveAt)}>actif {timeAgo(account.lastActiveAt)}</div>
			{/if}
		</div>
	</div>
{/snippet}

{#snippet actionsCell(account: ConsoleAccountListItem)}
	<div class="actions">
		<ButtonAction label="Actions" icon={EllipsisVertical} variant="ghost" size="sm">
			{#snippet items(close)}
				<ButtonActionItem
					label="Organisations"
					icon={Building2}
					onclick={() => {
						open(ORGS_MODAL_ID, account);
						close();
					}}
				/>
				<ButtonActionItem
					label="Modifier le compte"
					icon={Pencil}
					onclick={() => {
						open(EDIT_MODAL_ID, account);
						close();
					}}
				/>
				{#if account.invited && !account.disabled}
					<ButtonActionItem
						label="Renvoyer l'invitation"
						icon={Send}
						onclick={() => {
							submitFor(account, resendForm);
							close();
						}}
					/>
				{/if}
				{#if !account.invited && !account.disabled}
					<ButtonActionItem
						label="Réinitialiser le mot de passe"
						icon={KeyRound}
						onclick={() => {
							submitFor(account, resetForm);
							close();
						}}
					/>
					<ButtonActionItem
						label="Révoquer les sessions"
						icon={LogOut}
						onclick={() => {
							submitFor(account, revokeForm);
							close();
						}}
					/>
				{/if}
				{#if account.twoFactorEnabled}
					<ButtonActionItem
						label="Réinitialiser la double authentification"
						icon={ShieldOff}
						onclick={() => {
							open(TWO_FACTOR_MODAL_ID, account);
							close();
						}}
					/>
				{/if}
				{#if account.disabled}
					<ButtonActionItem
						label="Réactiver"
						icon={UserCheck}
						onclick={() => {
							submitFor(account, disableForm, false);
							close();
						}}
					/>
				{:else}
					<ButtonActionItem
						label="Désactiver"
						icon={UserX}
						onclick={() => {
							submitFor(account, disableForm, true);
							close();
						}}
					/>
				{/if}
				<ButtonActionItem
					label="Supprimer le compte"
					icon={Trash2}
					variant="danger"
					onclick={() => {
						open(DELETE_MODAL_ID, account);
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
		title="Membres"
		slogan="Les comptes de la console : les admins des organisations, et les organisations de chacun."
	>
		<Badge label={`${data.total} compte${data.total > 1 ? 's' : ''}`} variant="default" />
		<Button icon={Plus} onclick={openAdd}>Ajouter un membre</Button>
	</SuperTitle>

	{#if data.total === 0 && !data.searching}
		<EmptyState
			icon={Users}
			title="Aucun membre"
			description="Ajoutez l'admin d'une organisation : il reçoit un e-mail pour choisir son mot de passe."
			cta={{ label: 'Ajouter un membre', onclick: openAdd }}
		/>
	{:else}
		<SearchFilters collapsible columns={1} loading={!!navigating.to} title="Rechercher" urlDriven>
			<Input label="Nom, e-mail ou organisation" name="q" placeholder="Rechercher un membre…" />
		</SearchFilters>

		<Table
			rows={data.items}
			emptyLabel="Aucun membre trouvé."
			columns={[
				{ key: 'name', label: 'Membre', cell: nameCell },
				{ key: 'organizations', label: 'Organisations', cell: organizationsCell },
				{ key: 'twoFactorEnabled', label: 'Double authentification', cell: twoFactorCell },
				{ key: 'lastActiveAt', label: 'Activité', cell: activityCell },
				{ key: 'userId', label: '', align: 'right', cell: actionsCell }
			]}
		/>

		<div class="pager">
			<span class="count">{data.total} compte{data.total > 1 ? 's' : ''}</span>
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

<form bind:this={resendForm} method="POST" action="?/resend" hidden use:enhance={toastEnhance({ success: (d) => `Invitation renvoyée à ${d.resent}.`, setBusy })}>
	<input type="hidden" name="userId" value={target?.userId} />
</form>
<form bind:this={resetForm} method="POST" action="?/reset" hidden use:enhance={toastEnhance({ success: (d) => `Lien de réinitialisation envoyé à ${d.reset}.`, setBusy })}>
	<input type="hidden" name="userId" value={target?.userId} />
</form>
<form bind:this={revokeForm} method="POST" action="?/revoke" hidden use:enhance={toastEnhance({ success: (d) => `Sessions de ${d.revoked} révoquées.`, setBusy })}>
	<input type="hidden" name="userId" value={target?.userId} />
</form>
<form
	bind:this={disableForm}
	method="POST"
	action="?/disable"
	hidden
	use:enhance={toastEnhance({ success: (d) => (d.disabled ? 'Compte désactivé.' : 'Compte réactivé.'), setBusy })}
>
	<input type="hidden" name="userId" value={target?.userId} />
	<input type="hidden" name="disabled" value={String(disableValue)} />
</form>

<Modal id={ADD_MODAL_ID} title="Ajouter un membre">
	<form
		method="POST"
		action="?/create"
		class="form"
		novalidate
		use:enhance={toastEnhance({
			success: (d) => {
				const added = d.added as { email: string; invited: boolean };
				return added.invited ? `Invitation envoyée à ${added.email}.` : `${added.email} a accès aux organisations choisies.`;
			},
			onSuccess: () => modal(ADD_MODAL_ID)?.close(),
			resetOnSuccess: true,
			setBusy,
			fields: addErrors
		})}
	>
		<Input error={addErrors.get('name')} label="Nom" name="name" required />
		<Input
			error={addErrors.get('email')}
			label="E-mail"
			name="email"
			type="email"
			required
			hint={`S'il n'a pas encore de compte, il reçoit un e-mail pour choisir son mot de passe (lien valable ${CONSOLE_INVITATION_VALID_DAYS} jours).`}
		/>
		<SelectSearchMulti
			bind:value={addOrganizations}
			error={addErrors.get('organizationIds')}
			label="Organisations"
			name="organizationIds"
			options={data.organizations}
			placeholder="Choisir les organisations…"
			hint="Il en devient admin. Une seule suffit dans la plupart des cas."
			required
		/>
		<div class="form-submit">
			<Button type="submit" icon={Plus} loading={busy}>Ajouter</Button>
		</div>
	</form>
</Modal>

<Modal id={ORGS_MODAL_ID} title="Organisations du membre">
	<form
		method="POST"
		action="?/organizations"
		class="form"
		novalidate
		use:enhance={toastEnhance({
			success: 'Organisations mises à jour.',
			onSuccess: () => modal(ORGS_MODAL_ID)?.close(),
			setBusy,
			fields: orgsErrors
		})}
	>
		<p class="confirm-text">{target?.name} — {target?.email}</p>
		<input type="hidden" name="userId" value={target?.userId} />
		<SelectSearchMulti
			bind:value={editOrganizations}
			error={orgsErrors.get('organizationIds')}
			label="Organisations"
			name="organizationIds"
			options={data.organizations}
			hint="Pour lui retirer toutes ses organisations, supprimez le compte."
			required
		/>
		<div class="form-submit">
			<Button type="submit" loading={busy}>Enregistrer</Button>
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
		use:enhance={toastEnhance({ success: 'Compte mis à jour.', onSuccess: () => modal(EDIT_MODAL_ID)?.close(), setBusy, fields: editErrors })}
	>
		{#if target}
			{#key target.userId}
				<input type="hidden" name="userId" value={target.userId} />
				<Input error={editErrors.get('name')} label="Nom" name="name" value={target.name} required />
				<Input error={editErrors.get('email')} label="E-mail" name="email" type="email" value={target.email} required hint="C'est son identifiant de connexion." />
			{/key}
		{/if}
		<div class="form-submit">
			<Button type="submit" loading={busy}>Enregistrer</Button>
		</div>
	</form>
</Modal>

<Modal id={TWO_FACTOR_MODAL_ID} title="Réinitialiser la double authentification">
	<p class="confirm-text">
		Supprimer la double authentification de <strong>{target?.name}</strong> ? Utile s'il a perdu son
		téléphone. Il est déconnecté partout et devra la configurer à nouveau à sa prochaine connexion.
	</p>
	<form
		method="POST"
		action="?/twoFactor"
		class="confirm-actions"
		use:enhance={toastEnhance({ success: 'Double authentification réinitialisée.', onSuccess: () => modal(TWO_FACTOR_MODAL_ID)?.close(), setBusy })}
	>
		<input type="hidden" name="userId" value={target?.userId} />
		<Button type="button" variant="ghost" onclick={() => modal(TWO_FACTOR_MODAL_ID)?.close()}>Annuler</Button>
		<Button type="submit" variant="danger" icon={ShieldOff} loading={busy}>Réinitialiser</Button>
	</form>
</Modal>

<Modal id={DELETE_MODAL_ID} title="Supprimer le compte">
	<p class="confirm-text">
		Supprimer le compte de <strong>{target?.name}</strong> ({target?.email}) ? Il perd l'accès à
		{target && target.organizations.length > 1 ? `ses ${target.organizations.length} organisations` : 'son organisation'}.
		Cette action est <strong>irréversible</strong> — pour suspendre l'accès seulement, désactivez le compte.
	</p>
	<form
		method="POST"
		action="?/delete"
		class="confirm-actions"
		use:enhance={toastEnhance({ success: 'Compte supprimé.', onSuccess: () => modal(DELETE_MODAL_ID)?.close(), setBusy })}
	>
		<input type="hidden" name="userId" value={target?.userId} />
		<Button type="button" variant="ghost" onclick={() => modal(DELETE_MODAL_ID)?.close()}>Annuler</Button>
		<Button type="submit" variant="danger" icon={Trash2} loading={busy}>Supprimer</Button>
	</form>
</Modal>

<style>
	.name {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
	}
	.email {
		font-size: 12px;
		color: var(--text-subtle);
	}
	.orgs {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.org {
		padding: 2px 8px;
		border-radius: var(--radius-sm);
		background: var(--bg-muted);
		font-size: 12px;
		color: var(--text-heading);
		text-decoration: none;
	}
	.org:hover {
		color: var(--primary);
	}
	.muted {
		color: var(--text-muted);
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
	.actions {
		display: flex;
		justify-content: flex-end;
	}
</style>
