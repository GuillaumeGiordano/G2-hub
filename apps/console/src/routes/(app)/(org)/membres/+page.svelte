<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { Badge, Button, ButtonAction, ButtonActionItem, Input, Modal, Select, Table } from '@guillaumeg/ui';
	import { EllipsisVertical, Plus, UserCog, UserMinus } from '@lucide/svelte';
	import SuperTitle from '$lib/components/SuperTitle.svelte';
	import TemporaryPassword from '$lib/components/TemporaryPassword.svelte';
	import { orgRoleLabel, orgRoleOptions, orgRoleVariant } from '$lib/records/organization';
	import { memberAddSchema, memberRoleSchema } from '$lib/schemas/member';
	import { FieldErrors } from '$lib/utils/fieldErrors.svelte';
	import { toastEnhance } from '$lib/utils/toastEnhance';
	import type { AddedMember, MemberListItem } from '$lib/viewmodels/member';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const organizationName = $derived((page.data.organization as { name: string }).name);

	const ADD_MODAL_ID = 'member-add';
	const ROLE_MODAL_ID = 'member-role';
	const REMOVE_MODAL_ID = 'member-remove';
	const PASSWORD_MODAL_ID = 'member-password';

	let busy = $state(false);
	const setBusy = (v: boolean) => (busy = v);

	let addRole = $state<string>('EDITOR');
	const addErrors = new FieldErrors(['name', 'email', 'role'], memberAddSchema);
	let added = $state<AddedMember | null>(null);

	let target = $state<MemberListItem | null>(null);
	let newRole = $state<string>('EDITOR');
	const roleErrors = new FieldErrors(['role'], memberRoleSchema);

	function modal(id: string) {
		return document.getElementById(id) as HTMLDialogElement | null;
	}

	function openAdd() {
		addRole = 'EDITOR';
		addErrors.clear();
		modal(ADD_MODAL_ID)?.showModal();
	}

	function openRole(member: MemberListItem) {
		target = member;
		newRole = member.role;
		roleErrors.clear();
		modal(ROLE_MODAL_ID)?.showModal();
	}

	function openRemove(member: MemberListItem) {
		target = member;
		modal(REMOVE_MODAL_ID)?.showModal();
	}

	/** After an addition: show the new account's one-time password, if one was created. */
	async function onAdded(d: Record<string, unknown>) {
		modal(ADD_MODAL_ID)?.close();
		const result = d.added as AddedMember | undefined;
		if (result?.temporaryPassword) {
			added = result;
			await tick();
			modal(PASSWORD_MODAL_ID)?.showModal();
		}
	}
</script>

{#snippet nameCell(member: MemberListItem)}
	<div class="name">
		<span class="strong">{member.name}</span>
		{#if member.isMe}<Badge label="Vous" variant="info" />{/if}
	</div>
	<div class="email">{member.email}</div>
{/snippet}

{#snippet roleCell(member: MemberListItem)}
	<Badge label={orgRoleLabel[member.role]} variant={orgRoleVariant[member.role]} />
{/snippet}

{#snippet twoFactorCell(member: MemberListItem)}
	{#if member.twoFactorEnabled}
		<Badge label="Activée" variant="success" />
	{:else}
		<Badge label={member.role === 'OWNER' ? 'Requise' : 'Non'} variant={member.role === 'OWNER' ? 'warning' : 'default'} />
	{/if}
{/snippet}

{#snippet actionsCell(member: MemberListItem)}
	<div class="actions">
		<ButtonAction label="Actions" icon={EllipsisVertical} variant="ghost" size="sm">
			{#snippet items(close)}
				<ButtonActionItem
					label="Changer le rôle"
					icon={UserCog}
					onclick={() => {
						openRole(member);
						close();
					}}
				/>
				<ButtonActionItem
					label="Retirer de l'organisation"
					icon={UserMinus}
					variant="danger"
					onclick={() => {
						openRemove(member);
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
		slogan={`Les personnes qui accèdent à la console pour ${organizationName}, et leur rôle.`}
	>
		<Badge label={`${data.members.length} membre${data.members.length > 1 ? 's' : ''}`} variant="default" />
		<Button icon={Plus} onclick={openAdd}>Ajouter un membre</Button>
	</SuperTitle>

	<Table
		rows={data.members}
		emptyLabel="Aucun membre."
		columns={[
			{ key: 'name', label: 'Membre', cell: nameCell },
			{ key: 'role', label: 'Rôle', cell: roleCell },
			{ key: 'twoFactorEnabled', label: 'Double authentification', cell: twoFactorCell },
			{ key: 'membershipId', label: '', align: 'right', cell: actionsCell }
		]}
	/>
</div>

<Modal id={ADD_MODAL_ID} title="Ajouter un membre">
	<form
		method="POST"
		action="?/add"
		class="form"
		novalidate
		oninput={addErrors.oninput}
		onfocusout={addErrors.onfocusout}
		use:enhance={toastEnhance({
			success: 'Membre ajouté.',
			onSuccess: onAdded,
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
			hint="S'il n'a pas encore de compte, un mot de passe temporaire est généré."
		/>
		<Select bind:value={addRole} error={addErrors.get('role')} label="Rôle" name="role" options={orgRoleOptions} />
		<div class="form-submit">
			<Button type="submit" icon={Plus} loading={busy}>Ajouter</Button>
		</div>
	</form>
</Modal>

<Modal id={ROLE_MODAL_ID} title="Changer le rôle">
	<form
		method="POST"
		action="?/role"
		class="form"
		use:enhance={toastEnhance({
			success: 'Rôle mis à jour.',
			onSuccess: () => modal(ROLE_MODAL_ID)?.close(),
			setBusy,
			fields: roleErrors
		})}
	>
		<p class="confirm-text">{target?.name} — {target?.email}</p>
		<input type="hidden" name="membershipId" value={target?.membershipId} />
		<Select bind:value={newRole} error={roleErrors.get('role')} label="Rôle" name="role" options={orgRoleOptions} />
		{#if newRole === 'OWNER' && target?.role !== 'OWNER'}
			<p class="hint">Un propriétaire doit activer la double authentification à sa prochaine connexion.</p>
		{/if}
		<div class="form-submit">
			<Button type="submit" loading={busy}>Enregistrer</Button>
		</div>
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

{#if added?.temporaryPassword}
	<TemporaryPassword id={PASSWORD_MODAL_ID} email={added.email} password={added.temporaryPassword} />
{/if}

<style>
	.name {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.email {
		font-size: 12px;
		color: var(--text-subtle);
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
