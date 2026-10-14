<script lang="ts">
	import { page } from '$app/state';
	import { Alert, Button, Input } from '@guillaumeg/ui';
	import { LogIn, ShieldCheck } from '@lucide/svelte';
	import type { ActionData, PageData } from './$types';

	// Sign-in to a client's portal with the account of THAT application — or, for an Admin of its
	// organization signed in to the console, with that session (§26). Plain form posts (no
	// enhance): on success the answer redirects to the portal — another site — which the browser
	// follows natively.
	let { data, form }: { data: PageData; form: ActionData } = $props();

	let busy = $state(false);

	/** Console sign-in, then back here (same request, so the portal's parameters are kept). */
	const consoleLogin = $derived(`/login?redirectTo=${encodeURIComponent(page.url.pathname + page.url.search)}`);
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

			{#if data.admin}
				{#if data.admin.twoFactorEnabled}
					<form method="POST" class="form" onsubmit={() => (busy = true)}>
						<input type="hidden" name="as" value="admin" />
						<Button addClass="w-full" icon={ShieldCheck} loading={busy} size="lg" type="submit">
							Continuer en tant que {data.admin.name} (admin)
						</Button>
					</form>
				{:else}
					<Alert variant="warning">
						Pour entrer en tant qu'admin, activez d'abord la double authentification dans la
						<a href="/securite">console</a>.
					</Alert>
				{/if}
				<div class="separator">ou avec un compte utilisateur</div>
			{/if}

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
				<Button
					addClass="w-full"
					loading={busy}
					size="lg"
					type="submit"
					variant={data.admin ? 'outline' : 'primary'}
				>
					Se connecter
				</Button>
			</form>
			<a class="forgot" href={`/mot-de-passe-oublie?app=${data.application.id}`}>Mot de passe oublié ?</a>
			{#if !data.consoleSignedIn}
				<a class="forgot" href={consoleLogin}>Vous êtes administrateur ? Connectez-vous à la console</a>
			{/if}
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
	.separator {
		font-size: 12px;
		text-align: center;
		color: var(--text-subtle);
	}
</style>
