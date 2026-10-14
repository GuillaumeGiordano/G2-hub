<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Alert, Avatar, Badge, Button, Card, EmptyState, FileInput } from '@guillaumeg/ui';
	import { ArrowLeft, FileText, ImageUp, LogIn, Trash2, Upload } from '@lucide/svelte';
	import type { ActionData, PageData } from './$types';

	// « Mon profil »: the member's personal space in G2 Hub (DECISIONS.md §28). The avatar lives in
	// the PUBLIC space (stable URL), documents in the PRIVATE one (short signed links).
	let { data, form }: { data: PageData; form: ActionData } = $props();

	let busy = $state<string | null>(null);
	// The library FileInput keeps its own selection: re-mount it to clear it after a send.
	let round = $state(0);

	const sizeFormat = (bytes: number) =>
		bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
	const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' });

	const unavailableText: Record<string, string> = {
		config: 'Renseignez DEMO_HUB_SECRET_KEY dans le .env (clé secrète de la même application).',
		admin: "Les admins de l'organisation se connectent avec leur compte console : ils n'ont pas d'espace personnel.",
		expired: 'Votre session G2 Hub a expiré (1 h) : reconnectez-vous pour accéder à vos fichiers.'
	};

	const submit =
		(name: string): SubmitFunction =>
		() => {
			busy = name;
			return async ({ result, update }) => {
				await update();
				busy = null;
				if (result.type === 'success') round++;
			};
		};
</script>

<main class="portal">
	<a class="back" href="/"><ArrowLeft size={16} /> Retour</a>

	<header class="brand">
		<Avatar src={data.avatar?.url} name={data.user.name} alt="" size="xl" />
		<div>
			<h1>{data.user.name}</h1>
			<p class="muted">{data.user.email}</p>
		</div>
	</header>

	{#if form?.message}
		<Alert variant="error" title="Action impossible">{form.message}</Alert>
	{:else if form?.saved}
		<Alert variant="success" title={form.saved} />
	{/if}

	{#if data.unavailable}
		<Alert variant={data.unavailable === 'expired' ? 'warning' : 'info'} title="Espace personnel indisponible">
			{unavailableText[data.unavailable]}
		</Alert>
		{#if data.unavailable === 'expired'}
			<div><Button href="/auth/login" icon={LogIn}>Se reconnecter avec G2 Hub</Button></div>
		{/if}
	{:else}
		<Card>
			{#snippet header()}
				<div class="head">
					<span class="title"><ImageUp size={16} /> Photo de profil</span>
					<Badge label="Espace public" variant="info" />
				</div>
			{/snippet}
			<form
				method="POST"
				action="?/avatar"
				enctype="multipart/form-data"
				class="form"
				use:enhance={submit('avatar')}
			>
				{#key round}
					<FileInput
						label="Nouvelle photo"
						name="file"
						accept="image/jpeg,image/png,image/webp"
						hint="JPEG, PNG ou WebP — 2 Mo max. Elle remplace la précédente."
						required
					/>
				{/key}
				<div class="actions">
					<Button type="submit" icon={Upload} loading={busy === 'avatar'}>Enregistrer la photo</Button>
				</div>
			</form>
		</Card>

		<Card>
			{#snippet header()}
				<div class="head">
					<span class="title"><FileText size={16} /> Mes documents</span>
					<Badge label="Espace privé" variant="default" />
				</div>
			{/snippet}
			{#if data.documents.length === 0}
				<EmptyState icon={FileText} title="Aucun document" description="Vos justificatifs, visibles par vous seul." />
			{:else}
				<ul class="docs">
					{#each data.documents as doc (doc.id)}
						<li>
							<a href={doc.url} target="_blank" rel="noopener">{doc.name}</a>
							<span class="muted small">{sizeFormat(doc.bytes)} · {dateFormat.format(new Date(doc.createdAt))}</span>
							<form method="POST" action="?/delete" use:enhance={submit(`delete-${doc.id}`)}>
								<input type="hidden" name="id" value={doc.id} />
								<Button
									type="submit"
									variant="ghost"
									size="sm"
									icon={Trash2}
									aria-label={`Supprimer ${doc.name}`}
									loading={busy === `delete-${doc.id}`}
								/>
							</form>
						</li>
					{/each}
				</ul>
			{/if}
			<form
				method="POST"
				action="?/document"
				enctype="multipart/form-data"
				class="form"
				use:enhance={submit('document')}
			>
				{#key round}
					<FileInput label="Ajouter un document" name="file" accept="application/pdf,image/jpeg,image/png" hint="PDF ou image — 10 Mo max." required />
				{/key}
				<div class="actions">
					<Button type="submit" variant="secondary" icon={Upload} loading={busy === 'document'}>Ajouter</Button>
				</div>
			</form>
			<p class="muted small">Les liens de vos documents sont temporaires (10 min) : rechargez la page pour en obtenir de nouveaux.</p>
		</Card>
	{/if}
</main>

<style>
	.portal {
		max-width: 640px;
		margin: 0 auto;
		padding: 32px 16px 64px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--text-muted);
		font-size: 14px;
		text-decoration: none;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 16px;
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
	.small {
		font-size: 12px;
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
	.form {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
	}
	.docs {
		list-style: none;
		margin: 0 0 16px;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.docs li {
		display: grid;
		grid-template-columns: 1fr auto auto;
		align-items: center;
		gap: 12px;
		font-size: 14px;
	}
	.docs a {
		color: var(--text-heading);
		word-break: break-all;
	}
</style>
