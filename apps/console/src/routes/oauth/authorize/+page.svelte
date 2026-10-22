<script lang="ts">
	import { page } from '$app/state';
	import { Alert, Button, Input } from '@guillaumeg/ui';
	import { Building2, LogIn, ShieldCheck, UserPlus } from '@lucide/svelte';
	import type { ActionData, PageData } from './$types';

	// Sign-in to a client's portal with the account of THAT application — or, for a console member
	// signed in who may enter it, with that session (§26), for one organization on a tool (§38). An
	// application of the platform is entered with a console account only, created here if needed (§45).
	// Plain form posts (no
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

			{#if data.member}
				{@const member = data.member}
				{#if !member.twoFactorEnabled}
					<Alert variant="warning">
						Pour entrer avec votre compte console, activez d'abord la double authentification dans la
						<a href="/securite">console</a>.
					</Alert>
				{:else if member.organizations}
					<!-- A tool: entered for ONE organization, never across them (§38). -->
					{#if member.requestedUnavailable}
						<Alert variant="info">Cet outil n'est pas activé pour l'organisation demandée.</Alert>
					{/if}
					<div class="form">
						{#each member.organizations as organization (organization.id)}
							<form method="POST" onsubmit={() => (busy = true)}>
								<input type="hidden" name="as" value="admin" />
								<input type="hidden" name="organization" value={organization.id} />
								<Button addClass="w-full" icon={Building2} loading={busy} size="lg" type="submit">
									Connexion avec {organization.name}
								</Button>
							</form>
						{/each}
					</div>
				{:else}
					<form method="POST" class="form" onsubmit={() => (busy = true)}>
						<input type="hidden" name="as" value="admin" />
						<Button addClass="w-full" icon={ShieldCheck} loading={busy} size="lg" type="submit">
							Continuer en tant que {member.name}{member.role === 'admin' ? ' (admin)' : ''}
						</Button>
					</form>
				{/if}
				{#if !data.platform}<div class="separator">ou avec un compte utilisateur</div>{/if}
			{:else if data.platform && data.consoleSignedIn}
				<Alert variant="info">Votre compte n'a pas accès à {data.application.name}.</Alert>
			{/if}

			{#if data.platform}
				<!-- An application of the platform: console accounts only, no application users (§45). -->
				{#if !data.consoleSignedIn}
					<div class="form">
						<Button href={consoleLogin} addClass="w-full" icon={LogIn} size="lg">Se connecter</Button>
						{#if data.signupHref}
							<Button href={data.signupHref} addClass="w-full" icon={UserPlus} size="lg" variant="outline">Créer un compte</Button>
						{/if}
					</div>
				{/if}
			{:else}
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
						variant={data.member ? 'outline' : 'primary'}
					>
						Se connecter
					</Button>
				</form>
				<a class="forgot" href={`/mot-de-passe-oublie?app=${data.application.id}`}>Mot de passe oublié ?</a>
				{#if !data.consoleSignedIn}
					<a class="forgot" href={consoleLogin}>Vous êtes administrateur ? Connectez-vous à la console</a>
				{/if}
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
