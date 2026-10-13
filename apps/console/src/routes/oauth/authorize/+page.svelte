<script lang="ts">
	import { page } from '$app/state';
	import { Alert, Button, Input } from '@guillaumeg/ui';
	import { LogIn } from '@lucide/svelte';
	import type { ActionData, PageData } from './$types';

	// Sign-in to a client's portal with the account of THAT application. A plain form post (no
	// enhance): on success the answer redirects to the portal — another site — which the browser
	// follows natively.
	let { data, form }: { data: PageData; form: ActionData } = $props();

	let busy = $state(false);
</script>

<svelte:head>
	<title>{data.application ? `Connexion — ${data.application.name}` : 'Connexion impossible'}</title>
</svelte:head>

<div class="auth-screen">
	<div class="auth-card">
		{#if data.application}
			<div class="auth-brand">
				<span class="auth-logo"><LogIn size={22} /></span>
				<div>
					<div class="auth-title">{data.application.name}</div>
					<div class="auth-sub">Connexion à votre espace</div>
				</div>
			</div>

			{#if form?.message}<Alert variant="error">{form.message}</Alert>{/if}

			<form method="POST" class="form" onsubmit={() => (busy = true)}>
				<Input
					label="E-mail"
					name="email"
					type="email"
					autocomplete="username"
					value={form?.email ?? data.loginHint ?? ''}
					required
				/>
				<Input label="Mot de passe" name="password" type="password" autocomplete="current-password" required />
				<Button addClass="w-full" loading={busy} size="lg" type="submit">Se connecter</Button>
			</form>
			<a class="forgot" href={`/mot-de-passe-oublie?app=${data.application.id}`}>Mot de passe oublié ?</a>
		{:else}
			<Alert variant="error" title="Connexion impossible">{data.fatal}</Alert>
		{/if}

		<p class="auth-note">Comptes sécurisés par {page.data.hubName}</p>
	</div>
</div>

<style>
	.forgot {
		font-size: 13px;
		text-align: center;
		color: var(--primary);
	}
</style>
