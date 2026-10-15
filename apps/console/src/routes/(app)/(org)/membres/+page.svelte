<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { navigating, page } from '$app/state';
	import {
		Badge,
		Button,
		ButtonAction,
		ButtonActionItem,
		Input,
		Modal,
		SearchFilters,
		Table
	} from '@guillaumeg/ui';
	import {
		EllipsisVertical,
		KeyRound,
		LogOut,
		Pencil,
		Plus,
		Send,
		ShieldOff,
		UserCheck,
		UserMinus,
		UserX
	} from '@lucide/svelte';
	import SuperTitle from '$lib/components/SuperTitle.svelte';
	import { CONSOLE_INVITATION_VALID_DAYS } from '$lib/constants';
	import { orgRoleLabel, SUPERADMIN_LABEL } from '$lib/records/organization';
	import { memberAddSchema, memberUpdateSchema } from '$lib/schemas/member';
	import { FieldErrors } from '$lib/utils/fieldErrors.svelte';
	import { timeAgo } from '$lib/utils/timeAgo';
	import { toastEnhance } from '$lib/utils/toastEnhance';
	import type { MemberListItem } from '$lib/viewmodels/member';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const organizationName = $derived((page.data.organization as { name: string }).name);
	const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

	const ADD_MODAL_ID = 'member-add';
	const EDIT_MODAL_ID = 'member-edit';
	const REMOVE_MODAL_ID = 'member-remove';
	const TWO_FACTOR_MODAL_ID = 'member-two-factor';

	let busy = $state(false);
	const setBusy = (v: boolean) => (busy = v);

	const addErrors = new FieldErrors(['name', 'email'], memberAddSchema);
	const editErrors = new FieldErrors(['name', 'email'], memberUpdateSchema);

	let target = $state<MemberListItem | null>(null);

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
		modal(ADD_MODAL_ID)?.showModal();
	}

	function open(id: string, member: MemberListItem) {
		target = member;
		editErrors.clear();
		modal(id)?.showModal();
	}

	/** Submit one of the hidden forms for `member`. */
	async function submitFor(member: MemberListItem, form: HTMLFormElement | undefined, disabled = false) {
		target = member;
		disableValue = disabled;
		await tick();
		form?.requestSubmit();
	}

</script>

{#snippet nameCell(member: MemberListItem)}
	<div class="name">
		<span class="strong">{member.name}</span>
		{#if member.isMe}<Badge label="Vous" variant="info" />{/if}
		{#if member.shared}<Badge label="Compte partagé" variant="default" />{/if}
		{#if member.invited}<Badge label="Invité" variant="warning" />{/if}
		{#if member.disabled}<Badge label="Désactivé" variant="danger" />{/if}
	</div>
	<div class="email">{member.email}</div>
{/snippet}

{#snippet roleCell(member: MemberListItem)}
	{#if member.isSuperadmin}
		<Badge label={SUPERADMIN_LABEL} variant="primary" />
	{:else}
		<Badge label={orgRoleLabel[member.role]} variant="info" />
	{/if}
{/snippet}

{#snippet twoFactorCell(member: MemberListItem)}
	{#if member.twoFactorEnabled}
		<Badge label="Activée" variant="success" />
	{:else}
		<Badge label="Requise" variant="warning" />
	{/if}
{/snippet}

{#snippet activityCell(member: MemberListItem)}
	<div class="activity">
		<span class="dot" class:online={member.signedIn} aria-hidden="true"></span>
		<div>
			<div>{member.signedIn ? 'Session ouverte' : member.lastActiveAt ? 'Déconnecté' : 'Aucune session'}</div>
			{#if member.lastActiveAt}
				<div class="email" title={dateFormat.format(member.lastActiveAt)}>actif {timeAgo(member.lastActiveAt)}</div>
			{/if}
		</div>
	</div>
{/snippet}

{#snippet actionsCell(member: MemberListItem)}
	<div class="actions">
		<ButtonAction label="Actions" icon={EllipsisVertical} variant="ghost" size="sm">
			{#snippet items(close)}
				{#if member.editable}
					<ButtonActionItem
						label="Modifier le compte"
						icon={Pencil}
						onclick={() => {
							open(EDIT_MODAL_ID, member);
							close();
						}}
					/>
					{#if member.invited && !member.disabled}
						<ButtonActionItem
							label="Renvoyer l'invitation"
							icon={Send}
							onclick={() => {
								submitFor(member, resendForm);
								close();
							}}
						/>
					{/if}
					{#if !member.disabled && !member.invited}
						<ButtonActionItem
							label="Réinitialiser le mot de passe"
							icon={KeyRound}
							onclick={() => {
								submitFor(member, resetForm);
								close();
							}}
						/>
						<ButtonActionItem
							label="Révoquer les sessions"
							icon={LogOut}
							onclick={() => {
								submitFor(member, revokeForm);
								close();
							}}
						/>
					{/if}
					{#if member.twoFactorEnabled && !member.isMe}
						<ButtonActionItem
							label="Réinitialiser la double authentification"
							icon={ShieldOff}
							onclick={() => {
								open(TWO_FACTOR_MODAL_ID, member);
								close();
							}}
						/>
					{/if}
					{#if member.disabled}
						<ButtonActionItem
							label="Réactiver"
							icon={UserCheck}
							onclick={() => {
								submitFor(member, disableForm, false);
								close();
							}}
						/>
					{:else if !member.isMe}
						<ButtonActionItem
							label="Désactiver"
							icon={UserX}
							onclick={() => {
								submitFor(member, disableForm, true);
								close();
							}}
						/>
					{/if}
				{/if}
				<ButtonActionItem
					label="Retirer de l'organisation"
					icon={UserMinus}
					variant="danger"
					onclick={() => {
						open(REMOVE_MODAL_ID, member);
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
		slogan={`Les admins de ${organizationName} : ils gèrent la console et se connectent aux back-offices de ses applications.`}
	>
		<Badge label={`${data.members.length} membre${data.members.length > 1 ? 's' : ''}`} variant="default" />
		<Button icon={Plus} onclick={openAdd}>Ajouter un membre</Button>
	</SuperTitle>

	<SearchFilters collapsible columns={1} loading={!!navigating.to} title="Rechercher" urlDriven>
		<Input label="Nom ou e-mail" name="q" placeholder="Rechercher un membre…" />
	</SearchFilters>

	<Table
		rows={data.members}
		emptyLabel={data.searching ? 'Aucun membre trouvé.' : 'Aucun membre.'}
		columns={[
			{ key: 'name', label: 'Membre', cell: nameCell },
			{ key: 'role', label: 'Rôle', cell: roleCell },
			{ key: 'twoFactorEnabled', label: 'Double authentification', cell: twoFactorCell },
			{ key: 'lastActiveAt', label: 'Activité', cell: activityCell },
			{ key: 'membershipId', label: '', align: 'right', cell: actionsCell }
		]}
	/>
	<p class="hint">
		Un compte partagé avec une autre organisation ne peut être modifié que par le superadmin : vos
		changements s'appliqueraient aussi là-bas.
	</p>
</div>

<form
	bind:this={resendForm}
	method="POST"
	action="?/resend"
	hidden
	use:enhance={toastEnhance({ success: (d) => `Invitation renvoyée à ${d.resent}.`, setBusy })}
>
	<input type="hidden" name="membershipId" value={target?.membershipId} />
</form>

<form
	bind:this={resetForm}
	method="POST"
	action="?/reset"
	hidden
	use:enhance={toastEnhance({ success: (d) => `Lien de réinitialisation envoyé à ${d.reset}.`, setBusy })}
>
	<input type="hidden" name="membershipId" value={target?.membershipId} />
</form>

<form
	bind:this={revokeForm}
	method="POST"
	action="?/revoke"
	hidden
	use:enhance={toastEnhance({ success: (d) => `Sessions de ${d.revoked} révoquées.`, setBusy })}
>
	<input type="hidden" name="membershipId" value={target?.membershipId} />
</form>

<form
	bind:this={disableForm}
	method="POST"
	action="?/disable"
	hidden
	use:enhance={toastEnhance({ success: (d) => (d.disabled ? 'Compte désactivé.' : 'Compte réactivé.'), setBusy })}
>
	<input type="hidden" name="membershipId" value={target?.membershipId} />
	<input type="hidden" name="disabled" value={String(disableValue)} />
</form>

<Modal id={ADD_MODAL_ID} title="Ajouter un membre">
	<form
		method="POST"
		action="?/add"
		class="form"
		novalidate
		oninput={addErrors.oninput}
		onfocusout={addErrors.onfocusout}
		use:enhance={toastEnhance({
			success: (d) => {
				const added = d.added as { email: string; invited: boolean };
				return added.invited
					? `Invitation envoyée à ${added.email}.`
					: `${added.email} avait déjà un compte : il a accès à l'organisation.`;
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
		<p class="hint">
			Il devient admin de l'organisation et devra activer la double authentification à sa première
			connexion.
		</p>
		<div class="form-submit">
			<Button type="submit" icon={Plus} loading={busy}>Ajouter</Button>
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
			success: 'Compte mis à jour.',
			onSuccess: () => modal(EDIT_MODAL_ID)?.close(),
			setBusy,
			fields: editErrors
		})}
	>
		{#if target}
			{#key target.membershipId}
				<input type="hidden" name="membershipId" value={target.membershipId} />
				<Input error={editErrors.get('name')} label="Nom" name="name" value={target.name} required />
				<Input
					error={editErrors.get('email')}
					label="E-mail"
					name="email"
					type="email"
					value={target.email}
					required
					hint="C'est son identifiant de connexion."
				/>
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
		use:enhance={toastEnhance({
			success: 'Double authentification réinitialisée.',
			onSuccess: () => modal(TWO_FACTOR_MODAL_ID)?.close(),
			setBusy
		})}
	>
		<input type="hidden" name="membershipId" value={target?.membershipId} />
		<Button type="button" variant="ghost" onclick={() => modal(TWO_FACTOR_MODAL_ID)?.close()}>Annuler</Button>
		<Button type="submit" variant="danger" icon={ShieldOff} loading={busy}>Réinitialiser</Button>
	</form>
</Modal>

<Modal id={REMOVE_MODAL_ID} title="Retirer le membre">
	<p class="confirm-text">
		Retirer <strong>{target?.name}</strong> de {organizationName} ? Il perd l'accès à cette
		organisation. Si elle n'appartient à aucune autre, son compte est supprimé.
	</p>
	<form
		method="POST"
		action="?/remove"
		class="confirm-actions"
		use:enhance={toastEnhance({
			success: 'Membre retiré.',
			onSuccess: () => modal(REMOVE_MODAL_ID)?.close(),
			setBusy
		})}
	>
		<input type="hidden" name="membershipId" value={target?.membershipId} />
		<Button type="button" variant="ghost" onclick={() => modal(REMOVE_MODAL_ID)?.close()}>Annuler</Button>
		<Button type="submit" variant="danger" icon={UserMinus} loading={busy}>Retirer</Button>
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
	.hint {
		font-size: 13px;
		color: var(--text-muted);
		margin: 0;
	}
</style>
