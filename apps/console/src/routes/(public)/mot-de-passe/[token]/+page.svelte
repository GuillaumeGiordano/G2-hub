<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { Alert, Button, Input } from '@guillaumeg/ui';
	import { KeyRound } from '@lucide/svelte';
	import { passwordLinkTitle, PASSWORD_MIN_LENGTH } from '$lib/records/appUsers';
	import { passwordChooseSchema } from '$lib/schemas/appUser';
	import { FieldErrors } from '$lib/utils/fieldErrors.svelte';
	import { toastEnhance } from '$lib/utils/toastEnhance';
	import type { ActionData, PageData } from './$types';

	// An application user chooses a password from an e-mailed link (invitation or reset). After
	// success the link is used up: the page then shows the confirmation from the action's answer.
	let { data, form }: { data: PageData; form: ActionData } = $props();

	let busy = $state(false);
	const fields = new FieldErrors(['password', 'confirm'], passwordChooseSchema);
	const done = $derived(form && 'done' in form ? form.done : null);
</script>

<svelte:head>
	<title>{data.link ? `${passwordLinkTitle[data.link.purpose]} — ${data.link.applicationName}` : 'Lien expiré'}</title>
</svelte:head>

<div class="auth-screen">
	<div class="auth-card">
		<div class="auth-brand">
			<span class="auth-logo"><KeyRound size={22} /></span>
			<div>
				<div class="auth-title">{done?.applicationName ?? data.link?.applicationName ?? 'Mot de passe'}</div>
				{#if data.link && !done}<div class="auth-sub">{passwordLinkTitle[data.link.purpose]}</div>{/if}
			</div>
		</div>

		{#if done}
			<Alert variant="success" title="Mot de passe enregistré">
				Votre compte est prêt : vous pouvez vous connecter à {done.applicationName}.
			</Alert>
		{:else if !data.link}
			<Alert variant="error" title="Lien invalide ou expiré">
				Ce lien a déjà servi ou n'est plus valable. Demandez une nouvelle invitation, ou un nouveau
				lien depuis « Mot de passe oublié » sur le portail.
			</Alert>
		{:else}
			<p class="who">{data.link.name} — <span class="muted">{data.link.email}</span></p>
			<form
				method="POST"
				class="form"
				novalidate
				oninput={fields.oninput}
				onfocusout={fields.onfocusout}
				use:enhance={toastEnhance({ success: 'Mot de passe enregistré.', setBusy: (v) => (busy = v), fields })}
			>
				<!-- Lets password managers save the new password under the right account. -->
				<input type="email" name="username" value={data.link.email} autocomplete="username" hidden readonly />
				<Input
					error={fields.get('password')}
					label="Mot de passe"
					name="password"
					type="password"
					autocomplete="new-password"
					hint={`${PASSWORD_MIN_LENGTH} caractères minimum.`}
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

		<p class="auth-note">Comptes sécurisés par {page.data.hubName}</p>
	</div>
</div>

<style>
	.who {
		margin: 0;
		font-size: 14px;
		color: var(--text-heading);
	}
</style>
