<script lang="ts">
	import { Alert, Badge, Button, Card } from '@guillaumeg/ui';
	import { LogIn, LogOut, Settings, Wheat } from '@lucide/svelte';
	import { portalRoleLabel } from '$lib/roles';
	import type { PageData } from './$types';

	// A client's members area. It never sees a password: « Se connecter avec G2 Hub » sends the
	// member to the hub, which sends them back signed in (OpenID Connect).
	let { data }: { data: PageData } = $props();

	const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
</script>

<main class="portal">
	<header class="brand">
		<span class="logo"><Wheat size={24} /></span>
		<div>
			<h1>Boulangerie Côté Sud</h1>
			<p class="muted">Espace adhérent — démonstration de « Se connecter avec G2 Hub »</p>
		</div>
	</header>

	{#if data.error}
		<Alert variant="error" title="Connexion interrompue">{data.error}</Alert>
	{/if}

	{#if data.user}
		<Card>
			{#snippet header()}
				<div class="head">
					<span class="title">Bonjour {data.user?.name} !</span>
					<Badge label="Connecté via G2 Hub" variant="success" />
				</div>
			{/snippet}
			<dl class="facts">
				<dt>E-mail</dt>
				<dd>{data.user.email}</dd>
				<dt>Rôle</dt>
				<dd><Badge label={portalRoleLabel[data.user.role]} variant={data.user.role === 'admin' ? 'primary' : 'info'} /></dd>
				<dt>Identifiant G2 Hub (sub)</dt>
				<dd><code>{data.user.sub}</code></dd>
				<dt>Connecté le</dt>
				<dd>{dateFormat.format(data.user.signedInAt)}</dd>
			</dl>
			<form method="POST" action="/auth/logout" class="actions">
				<Button type="submit" variant="ghost" icon={LogOut}>Se déconnecter</Button>
			</form>
		</Card>

		{#if data.user.role === 'admin'}
			<!-- Shown only to an Admin of the client's organization (role claim from the hub). A real
			     portal ALSO checks the role on the server for every admin action. -->
			<Card>
				{#snippet header()}
					<div class="head">
						<span class="title"><Settings size={16} /> Administration</span>
						<Badge label="Réservé aux admins" variant="primary" />
					</div>
				{/snippet}
				<p class="muted">
					Ici, le back-office du site : produits, articles, galerie… Les médias sont stockés dans
					G2 Hub, les utilisateurs du portail se gèrent dans la console.
				</p>
			</Card>
		{/if}
	{:else}
		<Card>
			<div class="signin">
				<p>Connectez-vous pour accéder à votre espace : vos commandes, vos documents, vos avantages.</p>
				{#if data.configured}
					<Button href="/auth/login" icon={LogIn} size="lg">Se connecter avec G2 Hub</Button>
				{:else}
					<Alert variant="warning" title="Portail non configuré">
						Renseignez DEMO_PORTAL_CLIENT_ID et DEMO_PORTAL_CLIENT_SECRET dans le .env (console G2 Hub ›
						Applications › Connexion).
					</Alert>
				{/if}
			</div>
		</Card>
	{/if}
</main>

<style>
	.portal {
		max-width: 640px;
		margin: 0 auto;
		padding: 48px 16px 64px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.logo {
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		border-radius: var(--radius-lg);
		background: var(--primary-subtle);
		color: var(--primary);
	}
	h1 {
		margin: 0;
		font-size: 22px;
		font-weight: 700;
		color: var(--text-heading);
	}
	.muted {
		margin: 0;
		color: var(--text-muted);
		font-size: 14px;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		flex-wrap: wrap;
	}
	.title {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-weight: 600;
		color: var(--text-heading);
	}
	.facts {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 8px 16px;
		margin: 0 0 16px;
		font-size: 14px;
	}
	.facts dt {
		color: var(--text-muted);
	}
	.facts dd {
		margin: 0;
		word-break: break-all;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
	}
	.signin {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 16px;
	}
	.signin p {
		margin: 0;
	}
	@media (max-width: 640px) {
		.facts {
			grid-template-columns: 1fr;
			gap: 2px;
		}
		.facts dd {
			margin-bottom: 8px;
		}
	}
</style>
