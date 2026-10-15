<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { Alert, Button, Input } from '@guillaumeg/ui';
	import { KeyRound } from '@lucide/svelte';
	import { CONSOLE_PASSWORD_MIN_LENGTH, consolePasswordResetSchema } from '$lib/schemas/account';
	import { FieldErrors } from '$lib/utils/fieldErrors.svelte';
	import { toastEnhance } from '$lib/utils/toastEnhance';
	import type { ActionData, PageData } from './$types';

	// A console account chooses a new password from its e-mailed link: an invitation (a new account)
	// or a reset. After success the link is used up and every session of the account is closed: the
	// person signs in (and sets up two-factor authentication the first time).
	let { data, form }: { data: PageData; form: ActionData } = $props();

	let busy = $state(false);
	const fields = new FieldErrors(['password', 'confirm'], consolePasswordResetSchema);
	const done = $derived(!!form && 'done' in form && form.done);
	const heading = $derived(data.invitation ? 'Activer votre compte' : 'Nouveau mot de passe');
</script>

<svelte:head>
	<title>{heading} — {page.data.hubName}</title>
</svelte:head>

<div class="auth-screen">
	<div class="auth-card">
		<div class="auth-brand">
			<span class="auth-logo"><KeyRound size={22} /></span>
			<div>
				<div class="auth-title">{page.data.hubName}</div>
				<div class="auth-sub">{heading}</div>
			</div>
		</div>

		{#if done}
			<Alert variant="success" title="Mot de passe enregistré">
				{data.invitation
					? 'Votre compte est prêt. Connectez-vous : la double authentification vous sera demandée.'
					: 'Vous pouvez vous connecter avec votre nouveau mot de passe.'}
			</Alert>
			<Button href="/login" addClass="w-full" size="lg">Se connecter</Button>
		{:else if !data.valid}
			<Alert variant="error" title="Lien invalide ou expiré">
				{data.invitation
					? "Ce lien a déjà servi ou n'est plus valable. Demandez à un admin de votre organisation de vous renvoyer l'invitation."
					: "Ce lien a déjà servi ou n'est plus valable. Demandez-en un nouveau."}
			</Alert>
			{#if !data.invitation}
				<Button href="/login/mot-de-passe-oublie" addClass="w-full" size="lg" variant="secondary">Demander un nouveau lien</Button>
			{/if}
		{:else}
			<form
				method="POST"
				class="form"
				novalidate
				oninput={fields.oninput}
				onfocusout={fields.onfocusout}
				use:enhance={toastEnhance({ success: 'Mot de passe enregistré.', setBusy: (v) => (busy = v), fields })}
			>
				<input type="hidden" name="token" value={data.token} />
				<Input
					error={fields.get('password')}
					label="Mot de passe"
					name="password"
					type="password"
					autocomplete="new-password"
					hint={`${CONSOLE_PASSWORD_MIN_LENGTH} caractères minimum.`}
					required
				/>
				<Input
					error={fields.get('confirm')}
					label="Confirmation"
					name="confirm"
					type="password"
					autocomplete="new-password"
					required
				/>
				<Button addClass="w-full" loading={busy} size="lg" type="submit">Enregistrer</Button>
			</form>
		{/if}
	</div>
</div>
