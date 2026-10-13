<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Alert, Button, Input, ThemeToggle } from '@guillaumeg/ui';
	import { Network } from '@lucide/svelte';
	import { authClient } from '$lib/auth-client';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let formError = $state('');

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		loading = true;
		formError = '';
		const { data: result, error } = await authClient.signIn.email({ email, password });
		loading = false;
		if (error) {
			formError = 'Email ou mot de passe incorrect.';
			return;
		}
		// With 2FA enabled, the twoFactorClient redirects to /2fa (see auth-client.ts).
		if ((result as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) return;
		const to = page.url.searchParams.get('redirectTo');
		goto(to && to.startsWith('/') ? to : '/');
	}
</script>

<div class="auth-screen">
	<div class="corner">
		<ThemeToggle />
	</div>
	<form class="auth-card" onsubmit={submit}>
		<div class="brand">
			<span class="logo"><Network size={22} /></span>
			<div>
				<div class="title">{data.hubName}</div>
				<div class="sub">Connexion à la console</div>
			</div>
		</div>

		{#if formError}
			<Alert variant="error">{formError}</Alert>
		{/if}

		<Input bind:value={email} label="Email" placeholder="vous@exemple.fr" required type="email" />
		<Input bind:value={password} label="Mot de passe" required type="password" />

		<Button addClass="w-full" {loading} size="lg" type="submit">Se connecter</Button>
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
