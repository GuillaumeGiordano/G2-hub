<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { Alert, Button, Input } from '@guillaumeg/ui';
	import { KeyRound } from '@lucide/svelte';
	import { PASSWORD_RESET_VALID_MINUTES } from '$lib/records/appUsers';
	import { passwordForgotSchema } from '$lib/schemas/appUser';
	import { FieldErrors } from '$lib/utils/fieldErrors.svelte';
	import { toastEnhance } from '$lib/utils/toastEnhance';
	import type { ActionData, PageData } from './$types';

	// « Mot de passe oublié » of an application user. The answer is the same whether the address has
	// an account or not: the page never reveals who is registered.
	let { data, form }: { data: PageData; form: ActionData } = $props();

	let busy = $state(false);
	const fields = new FieldErrors(['email'], passwordForgotSchema);
	const sent = $derived(!!form && 'sent' in form && form.sent);
</script>

<svelte:head>
	<title>Mot de passe oublié — {data.application.name}</title>
</svelte:head>

<div class="auth-screen">
	<div class="auth-card">
		<div class="auth-brand">
			<span class="auth-logo"><KeyRound size={22} /></span>
			<div>
				<div class="auth-title">{data.application.name}</div>
				<div class="auth-sub">Mot de passe oublié</div>
			</div>
		</div>

		{#if sent}
			<Alert variant="success" title="Demande enregistrée">
				Si un compte existe pour cette adresse, un e-mail vient de lui être envoyé avec un lien valable
				{PASSWORD_RESET_VALID_MINUTES} minutes. Pensez à vérifier les indésirables.
			</Alert>
		{:else}
			<p class="intro">Indiquez l'adresse de votre compte : vous recevrez un lien pour choisir un nouveau mot de passe.</p>
			<form
				method="POST"
				class="form"
				novalidate
				oninput={fields.oninput}
				onfocusout={fields.onfocusout}
				use:enhance={toastEnhance({ success: 'Demande envoyée.', setBusy: (v) => (busy = v), fields })}
			>
				<Input error={fields.get('email')} label="E-mail" name="email" type="email" autocomplete="email" required />
				<Button addClass="w-full" loading={busy} size="lg" type="submit">Recevoir le lien</Button>
			</form>
		{/if}

		<p class="auth-note">Comptes sécurisés par {page.data.hubName}</p>
	</div>
</div>

<style>
	.intro {
		margin: 0;
		font-size: 14px;
		color: var(--text-muted);
	}
</style>
