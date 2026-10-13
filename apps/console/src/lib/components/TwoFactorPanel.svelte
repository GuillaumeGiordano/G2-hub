<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Card, Input, Button, Alert, Badge, toast } from '@guillaumeg/ui';
	import { ShieldCheck, ShieldAlert } from '@lucide/svelte';
	import { authClient } from '$lib/auth-client';

	let {
		enabled,
		mandatory = false,
		setupRequired = false
	}: { enabled: boolean; mandatory?: boolean; setupRequired?: boolean } = $props();

	let password = $state('');
	let code = $state('');
	let error = $state('');
	let busy = $state(false);

	let qrDataUrl = $state('');
	let backupCodes = $state<string[]>([]);

	async function activate(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		busy = true;
		const { data: res, error: err } = await authClient.twoFactor.enable({ password });
		busy = false;
		if (err || !res) {
			error = 'Mot de passe incorrect.';
			return;
		}
		// The console only offers TOTP (authenticator app); the `otp` (email code) method is unused.
		if (res.method !== 'totp') {
			error = "Méthode de double authentification inattendue.";
			return;
		}
		backupCodes = res.backupCodes;
		password = '';
		const QRCode = (await import('qrcode')).default;
		qrDataUrl = await QRCode.toDataURL(res.totpURI, { margin: 1, width: 200 });
	}

	async function verify(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		busy = true;
		const { error: err } = await authClient.twoFactor.verifyTotp({ code });
		busy = false;
		if (err) {
			error = 'Code invalide. Réessayez.';
			return;
		}
		qrDataUrl = '';
		backupCodes = [];
		code = '';
		toast.success('Double authentification activée.');
		await invalidateAll();
	}

	async function deactivate(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		busy = true;
		const { error: err } = await authClient.twoFactor.disable({ password });
		busy = false;
		if (err) {
			error = 'Mot de passe incorrect.';
			return;
		}
		password = '';
		toast.success('Double authentification désactivée.');
		await invalidateAll();
	}
</script>

{#if enabled}
	<Card>
		<div class="status">
			<ShieldCheck size={20} />
			<strong>Double authentification activée</strong>
			<Badge label="Actif" variant="success" />
		</div>
		<p class="muted">
			Un code de votre application d'authentification vous est demandé à chaque connexion.
		</p>
		{#if mandatory}
			<Alert variant="info">
				La 2FA est obligatoire pour votre rôle — elle ne peut pas être désactivée.
			</Alert>
		{:else}
			{#if error}<Alert variant="error">{error}</Alert>{/if}
			<form onsubmit={deactivate} class="row">
				<Input label="Mot de passe" type="password" bind:value={password} required />
				<Button type="submit" variant="danger" loading={busy}>Désactiver</Button>
			</form>
		{/if}
	</Card>
{:else if qrDataUrl}
	<Card>
		{#snippet header()}
			<div class="card-title"><ShieldAlert size={16} /> Configurer la 2FA</div>
		{/snippet}
		<ol class="steps">
			<li>Scannez ce QR code avec votre application (Google Authenticator, Authy…).</li>
			<li>Saisissez le code à 6 chiffres généré pour confirmer.</li>
		</ol>
		<div class="qr"><img src={qrDataUrl} alt="QR code 2FA" width="200" height="200" /></div>
		<div class="backup">
			<strong>Codes de secours</strong>
			<p class="muted">Conservez-les : ils permettent de vous connecter si vous perdez votre téléphone.</p>
			<ul class="codes">
				{#each backupCodes as c (c)}<li>{c}</li>{/each}
			</ul>
		</div>
		{#if error}<Alert variant="error">{error}</Alert>{/if}
		<form onsubmit={verify} class="row">
			<Input label="Code à 6 chiffres" bind:value={code} required />
			<Button type="submit" loading={busy}>Vérifier et activer</Button>
		</form>
	</Card>
{:else}
	<Card>
		{#snippet header()}
			<div class="card-title"><ShieldAlert size={16} /> Activer la 2FA</div>
		{/snippet}
		{#if setupRequired || mandatory}
			<Alert variant="warning">
				Votre rôle exige la double authentification. Configurez-la pour accéder à la console.
			</Alert>
		{/if}
		<p class="muted">
			Renforcez la sécurité de votre compte : un code temporaire sera demandé à chaque connexion.
		</p>
		{#if error}<Alert variant="error">{error}</Alert>{/if}
		<form onsubmit={activate} class="row">
			<Input label="Confirmez votre mot de passe" type="password" bind:value={password} required />
			<Button type="submit" loading={busy}>Activer</Button>
		</form>
	</Card>
{/if}

<style>
	.card-title {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.status {
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--text-heading);
	}
	.muted {
		font-size: 13px;
		margin: 8px 0;
	}
	.steps {
		margin: 0 0 12px 18px;
		font-size: 14px;
		color: var(--text-base);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.qr {
		display: flex;
		justify-content: center;
		padding: 12px;
		background: #fff;
		border-radius: var(--radius-md);
		width: fit-content;
		margin: 0 auto 12px;
	}
	.backup {
		margin: 8px 0 12px;
	}
	.codes {
		list-style: none;
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 4px 16px;
		margin: 8px 0 0;
		padding: 10px;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--bg-subtle);
		font-family: var(--font-mono, monospace);
		font-size: 13px;
	}
	.row {
		display: flex;
		align-items: flex-end;
		gap: 10px;
		margin-top: 12px;
	}
	.row :global(.field) {
		flex: 1;
	}
</style>
