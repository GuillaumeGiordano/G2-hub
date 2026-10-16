<script lang="ts">
	import { page } from '$app/state';
	import { orgPath } from '$lib/utils/orgPath';
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { Alert, Badge, Breadcrumb, Button, Card, CopyButton, Input, Modal, RadioGroup, TagInput } from '@guillaumeg/ui';
	import { KeyRound, LogIn, Power, RefreshCw, Save } from '@lucide/svelte';
	import PageTabs from '$lib/components/PageTabs.svelte';
	import SuperTitle from '$lib/components/SuperTitle.svelte';
	import { applicationTabs } from '$lib/records/navigation';
	import { SSO_SCOPES } from '$lib/records/sso';
	import { platformAccessOptions } from '$lib/records/platform';
	import { platformSettingsSchema } from '$lib/schemas/platform';
	import { ssoRedirectsSchema } from '$lib/schemas/sso';
	import { FieldErrors } from '$lib/utils/fieldErrors.svelte';
	import { toastEnhance } from '$lib/utils/toastEnhance';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const sso = $derived(data.sso);
	const tabs = $derived(applicationTabs(page.params.org!, sso.application.id, true));
	const crumbs = $derived([
		{ label: 'Applications', href: orgPath(page.params.org!, '/applications') },
		{ label: sso.application.name, href: orgPath(page.params.org!, `/applications/${sso.application.id}`) },
		{ label: 'Connexion' }
	]);

	const SECRET_MODAL_ID = 'sso-secret';
	const ROTATE_MODAL_ID = 'sso-rotate';
	const DISABLE_MODAL_ID = 'sso-disable';

	let busy = $state(false);
	const setBusy = (v: boolean) => (busy = v);

	// The return URLs are edited locally, then saved; re-synced when the page data changes.
	let redirectUris = $derived([...data.sso.redirectUris]);
	const redirectErrors = new FieldErrors(['redirectUris'], ssoRedirectsSchema);
	const redirectError = $derived(
		redirectErrors.get('redirectUris') ||
			(Object.entries(redirectErrors.errors).find(([key]) => key.startsWith('redirectUris.'))?.[1] ?? '')
	);

	let secret = $state<string | null>(null);

	// « Application de la plateforme » (superadmin, §38): edited locally, re-synced with the data.
	let platformAccess = $derived<string>(data.platform?.platformAccess ?? 'NONE');
	let homeUrl = $derived(data.platform?.homeUrl ?? '');
	const platformErrors = new FieldErrors(['platformAccess', 'homeUrl'], platformSettingsSchema);

	function modal(id: string) {
		return document.getElementById(id) as HTMLDialogElement | null;
	}

	/** The full secret is in the action's answer — the only time it exists outside the portal. */
	async function onSecret(d: Record<string, unknown>) {
		modal(ROTATE_MODAL_ID)?.close();
		secret = d.secret as string;
		await tick();
		modal(SECRET_MODAL_ID)?.showModal();
	}
</script>

<div class="page">
	<Breadcrumb items={crumbs} />
	<SuperTitle
		headingLevel="h1"
		title={sso.application.name}
		slogan="« Se connecter avec G2 Hub » : les utilisateurs de votre portail s'y connectent avec leur compte de cette application."
	/>
	<PageTabs {tabs} />

	<Card>
		{#snippet header()}
			<div class="card-head">
				<div class="card-title">Connexion avec G2 Hub</div>
				<Badge label={sso.enabled ? 'Activée' : 'Désactivée'} variant={sso.enabled ? 'success' : 'default'} />
			</div>
		{/snippet}
		{#if sso.enabled}
			<div class="state">
				<p class="muted">
					Secret client en service : <code class="mono">{sso.secretPrefix}…</code> — il n'est plus affichable.
					En cas de perte ou de fuite, générez-en un nouveau.
				</p>
				<div class="buttons">
					<Button variant="secondary" icon={RefreshCw} onclick={() => modal(ROTATE_MODAL_ID)?.showModal()}>
						Nouveau secret
					</Button>
					<Button variant="ghost" icon={Power} onclick={() => modal(DISABLE_MODAL_ID)?.showModal()}>Désactiver</Button>
				</div>
			</div>
		{:else}
			<div class="state">
				<p class="muted">
					Activez la connexion pour obtenir le secret client à placer dans la configuration (côté serveur) du
					portail. Pensez à déclarer ses adresses de retour ci-dessous.
				</p>
				<form
					method="POST"
					action="?/secret"
					use:enhance={toastEnhance({ success: 'Connexion activée.', onSuccess: onSecret, setBusy })}
				>
					<Button type="submit" icon={LogIn} loading={busy}>Activer la connexion</Button>
				</form>
			</div>
		{/if}
	</Card>

	{#if data.platform}
		<Card>
			{#snippet header()}
				<div class="card-title">Application de la plateforme</div>
			{/snippet}
			<form
				method="POST"
				action="?/platform"
				class="form"
				use:enhance={toastEnhance({ success: 'Réglage enregistré.', setBusy, fields: platformErrors })}
			>
				<RadioGroup
					legend="Qui peut s'y connecter avec son compte console"
					name="platformAccess"
					bind:value={platformAccess}
					options={platformAccessOptions}
					error={platformErrors.get('platformAccess')}
				/>
				<Input
					label="Adresse d'entrée"
					name="homeUrl"
					type="url"
					bind:value={homeUrl}
					placeholder="https://outil.g2webdev.fr"
					hint="Ouverte par la page « Outils » de la console. Un outil reçoit en plus ?organization=<id>, à transmettre à la connexion."
					error={platformErrors.get('homeUrl')}
				/>
				<div class="form-submit">
					<Button type="submit" icon={Save} loading={busy}>Enregistrer</Button>
				</div>
			</form>
		</Card>
	{/if}

	<Card>
		{#snippet header()}
			<div class="card-title">Adresses de retour</div>
		{/snippet}
		<form
			method="POST"
			action="?/redirects"
			class="form"
			use:enhance={toastEnhance({ success: 'Adresses enregistrées.', setBusy, fields: redirectErrors })}
		>
			<TagInput
				bind:tags={redirectUris}
				label="URL de retour autorisées"
				placeholder="https://monportail.fr/auth/callback puis Entrée"
				hint="Où G2 Hub peut renvoyer l'utilisateur après sa connexion. Comparées à l'identique (http seulement en local)."
				error={redirectError}
				onchange={() => redirectErrors.clearGroup('redirectUris')}
			/>
			<input type="hidden" name="redirectUris" value={JSON.stringify(redirectUris)} />
			<div class="form-submit">
				<Button type="submit" icon={Save} loading={busy}>Enregistrer</Button>
			</div>
		</form>
	</Card>

	<Card>
		{#snippet header()}
			<div class="card-title">Configuration du portail (OpenID Connect)</div>
		{/snippet}
		<dl class="config">
			<dt>Émetteur (issuer)</dt>
			<dd><code class="mono">{sso.issuer}</code><CopyButton text={sso.issuer} /></dd>
			<dt>Identifiant client (client_id)</dt>
			<dd><code class="mono">{sso.clientId}</code><CopyButton text={sso.clientId} /></dd>
			<dt>Secret client</dt>
			<dd class="muted">Affiché une seule fois, à l'activation ou au renouvellement.</dd>
			<dt>Flux</dt>
			<dd class="muted">Authorization Code + PKCE (S256), authentification client_secret_basic ou client_secret_post</dd>
			<dt>Scopes</dt>
			<dd><code class="mono">{SSO_SCOPES.join(' ')}</code></dd>
		</dl>
		<p class="muted small">
			Toute bibliothèque OpenID Connect découvre le reste depuis
			<code class="mono">{sso.issuer}/.well-known/openid-configuration</code>.
		</p>
	</Card>
</div>

{#if secret}
	<Modal id={SECRET_MODAL_ID} title="Secret client">
		<div class="reveal">
			<Alert variant="warning" title="Copiez-le maintenant">
				Ce secret ne sera plus jamais affiché : seule son empreinte est conservée. Placez-le dans les variables
				d'environnement du serveur du portail, jamais dans le code d'une page.
			</Alert>
			<div class="secret-row">
				<code class="mono secret">{secret}</code>
				<CopyButton text={secret} />
			</div>
		</div>
	</Modal>
{/if}

<Modal id={ROTATE_MODAL_ID} title="Nouveau secret client">
	<p class="confirm-text">
		Le secret actuel cessera de fonctionner <strong>immédiatement</strong> : le portail ne pourra plus connecter
		personne tant que sa configuration n'aura pas reçu le nouveau.
	</p>
	<form
		method="POST"
		action="?/secret"
		class="confirm-actions"
		use:enhance={toastEnhance({ success: 'Nouveau secret généré.', onSuccess: onSecret, setBusy })}
	>
		<Button type="button" variant="ghost" onclick={() => modal(ROTATE_MODAL_ID)?.close()}>Annuler</Button>
		<Button type="submit" icon={KeyRound} loading={busy}>Générer</Button>
	</form>
</Modal>

<Modal id={DISABLE_MODAL_ID} title="Désactiver la connexion">
	<p class="confirm-text">
		Plus personne ne pourra se connecter au portail avec G2 Hub, et les connexions en cours sont révoquées. Les
		comptes des utilisateurs sont conservés.
	</p>
	<form
		method="POST"
		action="?/disable"
		class="confirm-actions"
		use:enhance={toastEnhance({
			success: 'Connexion désactivée.',
			onSuccess: () => modal(DISABLE_MODAL_ID)?.close(),
			setBusy
		})}
	>
		<Button type="button" variant="ghost" onclick={() => modal(DISABLE_MODAL_ID)?.close()}>Annuler</Button>
		<Button type="submit" variant="danger" icon={Power} loading={busy}>Désactiver</Button>
	</form>
</Modal>

<style>
	.card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.card-title {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-heading);
	}
	.state {
		display: flex;
		flex-direction: column;
		gap: 14px;
		align-items: flex-start;
	}
	.state p {
		margin: 0;
		font-size: 14px;
	}
	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.mono {
		font-family: var(--font-mono, monospace);
		font-size: 13px;
		word-break: break-all;
	}
	.config {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 10px 16px;
		margin: 0 0 12px;
		font-size: 14px;
	}
	.config dt {
		color: var(--text-muted);
	}
	.config dd {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	.small {
		font-size: 13px;
		margin: 0;
	}
	.reveal {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.secret-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.secret {
		flex: 1;
		padding: 8px 10px;
		background: var(--bg-subtle);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
	}
	@media (max-width: 640px) {
		.config {
			grid-template-columns: 1fr;
			gap: 4px;
		}
		.config dd {
			margin-bottom: 8px;
		}
	}
</style>
