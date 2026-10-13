<script lang="ts">
	import { Card, Input, Button, Alert } from '@guillaumeg/ui';
	import { KeyRound } from '@lucide/svelte';
	import { toast } from '@guillaumeg/ui';
	import { authClient } from '$lib/auth-client';

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirm = $state('');
	let error = $state('');
	let busy = $state(false);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		if (newPassword.length < 8) {
			error = 'Le nouveau mot de passe doit contenir au moins 8 caractères.';
			return;
		}
		if (newPassword !== confirm) {
			error = 'La confirmation ne correspond pas.';
			return;
		}
		busy = true;
		const { error: err } = await authClient.changePassword({
			currentPassword,
			newPassword,
			revokeOtherSessions: true
		});
		busy = false;
		if (err) {
			error = 'Mot de passe actuel incorrect.';
			return;
		}
		currentPassword = '';
		newPassword = '';
		confirm = '';
		toast.success('Mot de passe modifié.');
	}
</script>

<Card>
	{#snippet header()}
		<div class="card-title"><KeyRound size={16} /> Mot de passe</div>
	{/snippet}
	<p class="muted">
		Les autres sessions seront déconnectées après la modification.
	</p>
	{#if error}<Alert variant="error">{error}</Alert>{/if}
	<form onsubmit={submit} class="fields">
		<Input label="Mot de passe actuel" type="password" bind:value={currentPassword} required />
		<Input label="Nouveau mot de passe" type="password" bind:value={newPassword} required />
		<Input label="Confirmer le nouveau mot de passe" type="password" bind:value={confirm} required />
		<div class="submit">
			<Button type="submit" loading={busy}>Modifier le mot de passe</Button>
		</div>
	</form>
</Card>

<style>
	.card-title {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.muted {
		font-size: 13px;
		margin: 8px 0;
	}
	.fields {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-top: 8px;
	}
</style>
