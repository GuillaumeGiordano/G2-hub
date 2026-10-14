<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Alert, Button, Input, ThemeToggle } from '@guillaumeg/ui';
	import { ShieldCheck } from '@lucide/svelte';
	import { authClient } from '$lib/auth-client';
	import { safeRedirect } from '$lib/utils/redirect';

	let code = $state('');
	let error = $state('');
	let loading = $state(false);
	let useBackup = $state(false);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		loading = true;
		const { error: err } = useBackup
			? await authClient.twoFactor.verifyBackupCode({ code })
			: await authClient.twoFactor.verifyTotp({ code });
		loading = false;
		if (err) {
			error = useBackup ? 'Code de secours invalide.' : 'Code invalide. Réessayez.';
			return;
		}
		goto(safeRedirect(page.url.searchParams.get('redirectTo')));
	}

	function toggleBackup() {
		useBackup = !useBackup;
		code = '';
		error = '';
	}
</script>

<div class="auth-screen">
	<div class="corner">
		<ThemeToggle />
	</div>
	<form class="auth-card" onsubmit={submit}>
		<div class="brand">
			<span class="logo"><ShieldCheck size={22} /></span>
			<div>
				<div class="title">Vérification en deux étapes</div>
				<div class="sub">
					{useBackup ? 'Saisissez un de vos codes de secours' : 'Saisissez le code de votre application'}
				</div>
			</div>
		</div>

		{#if error}
			<Alert variant="error">{error}</Alert>
		{/if}

		<Input bind:value={code} label={useBackup ? 'Code de secours' : 'Code à 6 chiffres'} required />

		<Button addClass="w-full" {loading} size="lg" type="submit">Valider</Button>

		<Button variant="ghost" size="sm" type="button" onclick={toggleBackup}>
			{useBackup ? "Utiliser mon application d'authentification" : 'Utiliser un code de secours'}
		</Button>
	</form>
</div>

<style>
	.corner {
		position: fixed;
		top: 16px;
		right: 16px;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 4px;
	}
	.logo {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: var(--radius-lg);
		background: var(--primary-subtle);
		color: var(--primary);
	}
	.title {
		font-size: 15px;
		font-weight: 700;
		color: var(--text-heading);
	}
	.sub {
		font-size: 13px;
		color: var(--text-muted);
	}
</style>
