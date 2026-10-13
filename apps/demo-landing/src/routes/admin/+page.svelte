<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Alert, Badge, Button, Card, EmptyState, FileInput, Input, Progress, Table, Textarea } from '@guillaumeg/ui';
	import { ImagePlus, Trash2 } from '@lucide/svelte';
	import type { CreationRow } from './+page.server';
	import type { PageData } from './$types';

	// The demo site's own admin — what a client's back-office does to feed its gallery (§22):
	// 1. the site's server gets an upload ticket from G2 Hub (secret key, never in this page);
	// 2. this page PUTs the photo straight to storage with the signed URL (progress bar);
	// 3. the site's server confirms it and saves title + price + G2 Hub file id in ITS database.
	let { data }: { data: PageData } = $props();

	let file = $state<File | null>(null);
	let title = $state('');
	let price = $state('');
	let alt = $state('');
	let caption = $state('');
	let progress = $state(0);
	let busy = $state(false);
	let message = $state<{ kind: 'success' | 'error'; text: string } | null>(null);
	// The library FileInput keeps its own selection: re-mount it to clear it after an upload.
	let round = $state(0);

	const priceFormat = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

	/** The FileInput exposes no callback: its native `change` bubbles up to this wrapper. */
	function onpick(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.type === 'file') file = input.files?.[0] ?? null;
	}

	function put(url: string, body: File, contentType: string) {
		return new Promise<void>((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			xhr.open('PUT', url);
			xhr.setRequestHeader('Content-Type', contentType);
			xhr.upload.onprogress = (e) => e.lengthComputable && (progress = Math.round((e.loaded / e.total) * 100));
			xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Stockage : ${xhr.status}`)));
			xhr.onerror = () => reject(new Error('Envoi interrompu.'));
			xhr.send(body);
		});
	}

	async function errorOf(res: Response) {
		const body = await res.json().catch(() => null);
		return (body as { message?: string } | null)?.message ?? 'Envoi impossible.';
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		message = null;
		if (!file || !title.trim()) {
			message = { kind: 'error', text: 'Choisissez une photo et donnez-lui un titre.' };
			return;
		}
		busy = true;
		progress = 0;
		try {
			const t = await fetch('/admin/upload', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type, alt, caption })
			});
			if (!t.ok) throw new Error(await errorOf(t));
			const ticket = (await t.json()) as { fileId: string; uploadUrl: string; contentType: string };
			await put(ticket.uploadUrl, file, ticket.contentType);
			const done = await fetch(`/admin/upload/${ticket.fileId}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ title, price })
			});
			if (!done.ok) throw new Error(await errorOf(done));
			message = { kind: 'success', text: `« ${title} » ajoutée : elle est sur le site et dans la médiathèque G2 Hub.` };
			file = null;
			title = price = alt = caption = '';
			round++;
			await invalidateAll();
		} catch (err) {
			message = { kind: 'error', text: (err as Error).message };
		} finally {
			busy = false;
		}
	}
</script>

{#snippet photoCell(row: CreationRow)}
	{#if row.photo?.thumbnailUrl}
		<img class="thumb" src={row.photo.thumbnailUrl} alt={row.photo.alt ?? row.title} />
	{:else}
		<span class="muted">—</span>
	{/if}
{/snippet}

{#snippet titleCell(row: CreationRow)}
	<div class="strong">{row.title}</div>
	{#if row.photo?.caption}<div class="muted small">{row.photo.caption}</div>{/if}
{/snippet}

{#snippet priceCell(row: CreationRow)}
	{row.priceCents === null ? '—' : priceFormat.format(row.priceCents / 100)}
{/snippet}

{#snippet statusCell(row: CreationRow)}
	{#if !row.photo}
		<Badge label="Photo introuvable" variant="danger" />
	{:else if row.photo.status === 'READY'}
		<Badge label="En ligne" variant="success" />
	{:else}
		<Badge label="Traitement…" variant="info" />
	{/if}
{/snippet}

{#snippet actionsCell(row: CreationRow)}
	<form method="POST" action="?/delete" use:enhance class="right">
		<input type="hidden" name="id" value={row.id} />
		<Button type="submit" variant="ghost" size="sm" icon={Trash2}>Supprimer</Button>
	</form>
{/snippet}

<div class="admin">
	<h1>Admin du site — Boulangerie Côté Sud</h1>
	<p class="muted">
		Démonstration du back-office d'un site client : les photos partent dans G2 Hub, les infos métier
		(titre, prix) restent dans la base du site. <a href="/">Voir le site</a>
	</p>

	{#if !data.configured}
		<Alert variant="warning" title="Admin non configuré">Renseignez DEMO_HUB_SECRET_KEY dans le .env.</Alert>
	{/if}

	<Card>
		{#snippet header()}
			<div class="card-title">Ajouter une photo</div>
		{/snippet}
		<form class="form" onsubmit={submit}>
			<div class="picker" onchange={onpick} role="presentation">
				{#key round}
					<FileInput label="Photo" accept="image/jpeg,image/png,image/webp" hint="JPEG, PNG ou WebP — 20 Mo max." />
				{/key}
			</div>
			<div class="row">
				<Input label="Titre" bind:value={title} required placeholder="Croissant pur beurre" />
				<Input label="Prix (€)" bind:value={price} placeholder="1,40" />
			</div>
			<Input label="Texte alternatif" bind:value={alt} placeholder="Croissant doré sur une planche en bois" />
			<Textarea label="Légende" bind:value={caption} rows={2} placeholder="Feuilleté au beurre AOP, cuit chaque matin." />
			{#if busy}<Progress value={progress} showValue label="Envoi de la photo" />{/if}
			{#if message}<Alert variant={message.kind}>{message.text}</Alert>{/if}
			<div class="form-submit">
				<Button type="submit" icon={ImagePlus} loading={busy} disabled={!data.configured}>Ajouter</Button>
			</div>
		</form>
	</Card>

	<h2>Créations du site ({data.rows.length})</h2>
	{#if data.rows.length === 0}
		<EmptyState icon={ImagePlus} title="Aucune création" description="Ajoutez une première photo ci-dessus." />
	{:else}
		<Table
			rows={data.rows}
			columns={[
				{ key: 'photo', label: '', width: '72px', cell: photoCell },
				{ key: 'title', label: 'Création', cell: titleCell },
				{ key: 'priceCents', label: 'Prix', align: 'right', cell: priceCell },
				{ key: 'createdAt', label: 'Photo', cell: statusCell },
				{ key: 'id', label: '', align: 'right', cell: actionsCell }
			]}
		/>
	{/if}
</div>

<style>
	.admin {
		max-width: 900px;
		margin: 0 auto;
		padding: 32px 16px 64px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	h1 {
		font-size: 24px;
		font-weight: 700;
		color: var(--text-heading);
		margin: 0;
	}
	h2 {
		font-size: 18px;
		font-weight: 600;
		color: var(--text-heading);
		margin: 8px 0 0;
	}
	.muted {
		color: var(--text-muted);
		margin: 0;
	}
	.muted a {
		color: var(--primary);
	}
	.small {
		font-size: 12px;
	}
	.strong {
		font-weight: 600;
		color: var(--text-heading);
	}
	.card-title {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-heading);
	}
	.form {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.row {
		display: grid;
		grid-template-columns: 2fr 1fr;
		gap: 14px;
	}
	.form-submit,
	.right {
		display: flex;
		justify-content: flex-end;
	}
	.thumb {
		width: 56px;
		height: 56px;
		border-radius: var(--radius-md);
		object-fit: cover;
		display: block;
	}
	@media (max-width: 640px) {
		.row {
			grid-template-columns: 1fr;
		}
	}
</style>
