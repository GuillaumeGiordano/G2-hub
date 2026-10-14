<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { Badge, Button, ButtonAction, ButtonActionItem, Input, Modal, Table } from '@guillaumeg/ui';
	import { EllipsisVertical, Plus, UserMinus } from '@lucide/svelte';
	import SuperTitle from '$lib/components/SuperTitle.svelte';
	import TemporaryPassword from '$lib/components/TemporaryPassword.svelte';
	import { memberAddSchema } from '$lib/schemas/member';
	import { FieldErrors } from '$lib/utils/fieldErrors.svelte';
	import { toastEnhance } from '$lib/utils/toastEnhance';
	import type { AddedMember, MemberListItem } from '$lib/viewmodels/member';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const organizationName = $derived((page.data.organization as { name: string }).name);

	const ADD_MODAL_ID = 'member-add';
	const REMOVE_MODAL_ID = 'member-remove';
	const PASSWORD_MODAL_ID = 'member-password';

	let busy = $state(false);
	const setBusy = (v: boolean) => (busy = v);

	const addErrors = new FieldErrors(['name', 'email'], memberAddSchema);
	let added = $state<AddedMember | null>(null);

	let target = $state<MemberListItem | null>(null);

	function modal(id: string) {
		return document.getElementById(id) as HTMLDialogElement | null;
	}

	function openAdd() {
		addErrors.clear();
		modal(ADD_MODAL_ID)?.showModal();
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

{#snippet twoFactorCell(member: MemberListItem)}
	{#if member.twoFactorEnabled}
		<Badge label="Activée" variant="success" />
	{:else}
		<Badge label="Requise" variant="warning" />
	{/if}
{/snippet}

{#snippet actionsCell(member: MemberListItem)}
	<div class="actions">
		<ButtonAction label="Actions" icon={EllipsisVertical} variant="ghost" size="sm">
			{#snippet items(close)}
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
		slogan={`Les admins de ${organizationName} : ils gèrent la console et se connectent aux back-offices de ses applications.`}
	>
		<Badge label={`${data.members.length} membre${data.members.length > 1 ? 's' : ''}`} variant="default" />
		<Button icon={Plus} onclick={openAdd}>Ajouter un membre</Button>
	</SuperTitle>

	<Table
		rows={data.members}
		emptyLabel="Aucun membre."
		columns={[
			{ key: 'name', label: 'Membre', cell: nameCell },
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
		<p class="hint">
			Il devient admin de l'organisation et devra activer la double authentification à sa première
			connexion.
		</p>
		<div class="form-submit">
			<Button type="submit" icon={Plus} loading={busy}>Ajouter</Button>
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
