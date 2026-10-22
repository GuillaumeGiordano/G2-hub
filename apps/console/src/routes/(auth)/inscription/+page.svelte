<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { Alert, Button, Checkbox, Input } from '@guillaumeg/ui';
	import { UserPlus } from '@lucide/svelte';
	import { SIGNUP_LINK_VALID_HOURS } from '$lib/constants';
	import { signupSchema } from '$lib/schemas/signup';
	import { FieldErrors } from '$lib/utils/fieldErrors.svelte';
	import { toastEnhance } from '$lib/utils/toastEnhance';
	import type { ActionData, PageData } from './$types';

	// « Créer un compte » for the platform's portal (DECISIONS.md §45). No password here: it is
	// chosen from the e-mailed link. The answer is the same whether the address has an account or
	// not: the page never reveals who is registered.
	let { data, form }: { data: PageData; form: ActionData } = $props();

	let busy = $state(false);
	const fields = new FieldErrors(['name', 'email', 'privacy'], signupSchema);
	const sent = $derived(!!form && 'sent' in form && form.sent);
</script>

<svelte:head>
	<title>Créer un compte — {page.data.hubName}</title>
</svelte:head>

<div class="auth-screen">
	<div class="auth-card">
		<div class="auth-brand">
			<span class="auth-logo"><UserPlus size={22} /></span>
			<div>
				<div class="auth-title">{data.applicationName}</div>
				<div class="auth-sub">Créer votre compte {page.data.hubName}</div>
			</div>
		</div>

		{#if sent}
			<Alert variant="success" title="Vérifiez votre boîte mail">
				Un e-mail vient de vous être envoyé avec un lien valable {SIGNUP_LINK_VALID_HOURS} heures pour confirmer votre
				adresse et choisir votre mot de passe. Pensez à vérifier les indésirables.
			</Alert>
		{:else}
			{#if form && 'message' in form && form.message}<Alert variant="error">{form.message}</Alert>{/if}
			<form
				method="POST"
				class="form"
				novalidate
				oninput={fields.oninput}
				onfocusout={fields.onfocusout}
				use:enhance={toastEnhance({ success: 'Inscription envoyée.', setBusy: (v) => (busy = v), fields })}
			>
				<Input error={fields.get('name')} label="Nom et prénom" name="name" autocomplete="name" required />
				<Input error={fields.get('email')} label="E-mail" name="email" type="email" autocomplete="email" required />
				<p class="privacy">
					Vos données servent à gérer votre compte et vos demandes.
					<a href={data.privacyUrl} target="_blank" rel="noopener noreferrer">Lire la politique de confidentialité</a>
				</p>
				<Checkbox error={fields.get('privacy')} label="J'accepte la politique de confidentialité" name="privacy" required />
				<Button addClass="w-full" loading={busy} size="lg" type="submit">Créer mon compte</Button>
			</form>
		{/if}

		<a class="back" href={data.loginHref}>Déjà un compte ? Se connecter</a>
	</div>
</div>

<style>
	.privacy {
		margin: 0;
		font-size: 13px;
		color: var(--text-muted);
	}
	.privacy a {
		color: var(--primary);
	}
	.back {
		align-self: center;
		font-size: 13px;
		color: var(--text-muted);
	}
</style>
