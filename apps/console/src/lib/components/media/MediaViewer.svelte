<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { Alert, Badge, Button, CopyButton, Input, Modal, Textarea } from '@guillaumeg/ui';
	import { ChevronLeft, ChevronRight, Download, FolderOpen, Trash2 } from '@lucide/svelte';
	import { fileKindLabel } from '$lib/records/files';
	import { formatBytes } from '$lib/records/organization';
	import { visibilityLabel, visibilityVariant } from '$lib/records/storage';
	import { fileTextSchema } from '$lib/schemas/fileText';
	import { FieldErrors } from '$lib/utils/fieldErrors.svelte';
	import { toastEnhance } from '$lib/utils/toastEnhance';
	import type { MediaItem } from '$lib/viewmodels/media';

	// Full-screen viewer of one media, driven by the URL (`?media=<id>`): the page passes the current
	// item and the links to its neighbours; closing (×, Escape, Back) drops the parameter. Image shown
	// large, video played, PDF embedded, with its details and actions.
	let {
		media,
		applicationId,
		prevHref,
		nextHref,
		closeHref,
		canWrite
	}: {
		media: MediaItem | null;
		applicationId: string;
		prevHref: string | null;
		nextHref: string | null;
		closeHref: string;
		canWrite: boolean;
	} = $props();

	const MODAL_ID = 'media-viewer';
	const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
	const textErrors = new FieldErrors(['alt', 'caption'], fileTextSchema);

	// Delete asks for a confirmation, tied to the media it was asked for: moving to another media
	// cancels it by itself.
	let confirmingFor = $state<string | null>(null);
	const confirmingDelete = $derived(!!media && confirmingFor === media.id);
	let busy = $state(false);

	function dialog() {
		return document.getElementById(MODAL_ID) as HTMLDialogElement | null;
	}

	const go = (href: string) => goto(href, { noScroll: true, keepFocus: true, replaceState: true });

	// Open / close the dialog with the URL; a close from the dialog itself (× or Escape) updates the URL.
	$effect(() => {
		const el = dialog();
		if (!el) return;
		if (media && !el.open) el.showModal();
		if (!media && el.open) el.close();
		const onClose = () => {
			if (media) goto(closeHref, { noScroll: true, keepFocus: true });
		};
		el.addEventListener('close', onClose);
		return () => el.removeEventListener('close', onClose);
	});

	function onkeydown(e: KeyboardEvent) {
		if (!media || !dialog()?.open) return;
		if (e.key === 'ArrowLeft' && prevHref) go(prevHref);
		if (e.key === 'ArrowRight' && nextHref) go(nextHref);
	}

	// Swipe left / right on touch screens.
	let touchX: number | null = null;
	function ontouchstart(e: TouchEvent) {
		touchX = e.touches[0].clientX;
	}
	function ontouchend(e: TouchEvent) {
		if (touchX === null) return;
		const dx = e.changedTouches[0].clientX - touchX;
		touchX = null;
		if (dx > 60 && prevHref) go(prevHref);
		if (dx < -60 && nextHref) go(nextHref);
	}
</script>

<svelte:window {onkeydown} />

<Modal id={MODAL_ID} title={media?.name ?? ''} size="full">
	{#if media}
		<div class="viewer">
			<div class="stage" {ontouchstart} {ontouchend} role="presentation">
				{#if prevHref}
					<a class="nav prev" href={prevHref} data-sveltekit-noscroll data-sveltekit-replacestate aria-label="Précédent">
						<ChevronLeft size={28} />
					</a>
				{/if}
				{#key media.id}
					{#if media.kind === 'IMAGE'}
						<img src={media.viewUrl} alt={media.name} />
					{:else if media.kind === 'VIDEO'}
						<!-- svelte-ignore a11y_media_has_caption -->
						<video src={media.viewUrl} poster={media.posterUrl ?? undefined} controls preload="metadata"></video>
					{:else}
						<iframe src={media.viewUrl} title={media.name}></iframe>
					{/if}
				{/key}
				{#if nextHref}
					<a class="nav next" href={nextHref} data-sveltekit-noscroll data-sveltekit-replacestate aria-label="Suivant">
						<ChevronRight size={28} />
					</a>
				{/if}
			</div>

			<aside class="details">
				<dl>
					<div>
						<dt>Dossier</dt>
						<dd><a href={`/applications/${applicationId}?dossier=${media.folderId}`}>{media.folderName}</a></dd>
					</div>
					<div>
						<dt>Visibilité</dt>
						<dd><Badge label={visibilityLabel[media.visibility]} variant={visibilityVariant[media.visibility]} /></dd>
					</div>
					<div>
						<dt>Type</dt>
						<dd>{fileKindLabel[media.kind]}{media.width ? ` · ${media.width} × ${media.height}` : ''}</dd>
					</div>
					<div>
						<dt>Taille</dt>
						<dd>{formatBytes(media.bytes)}</dd>
					</div>
					<div>
						<dt>Ajouté le</dt>
						<dd>{dateFormat.format(media.createdAt)}{media.source === 'API' ? ' · par le site' : ''}</dd>
					</div>
					{#if media.pins.length}
						<div>
							<dt>Utilisé par le site</dt>
							<dd>{media.pins.join(', ')}</dd>
						</div>
					{/if}
				</dl>

				{#if canWrite}
					{#key media.id}
						<form
							method="POST"
							action="?/updateText"
							class="texts"
							novalidate
							oninput={textErrors.oninput}
							onfocusout={textErrors.onfocusout}
							use:enhance={toastEnhance({ success: 'Textes enregistrés.', fields: textErrors })}
						>
							<input type="hidden" name="id" value={media.id} />
							<Input
								label="Texte alternatif"
								name="alt"
								value={media.alt ?? ''}
								error={textErrors.get('alt')}
								hint="Décrit l'image pour les lecteurs d'écran et le référencement."
							/>
							<Textarea label="Légende" name="caption" value={media.caption ?? ''} rows={2} error={textErrors.get('caption')} />
							<div class="form-submit"><Button type="submit" size="sm" variant="outline">Enregistrer les textes</Button></div>
						</form>
					{/key}
				{:else if media.alt || media.caption}
					<dl>
						{#if media.alt}<div><dt>Texte alternatif</dt><dd>{media.alt}</dd></div>{/if}
						{#if media.caption}<div><dt>Légende</dt><dd>{media.caption}</dd></div>{/if}
					</dl>
				{/if}

				{#if media.publicUrl}
					<div class="public">
						<span class="label">Lien public</span>
						<div class="link-row">
							<code>{media.publicUrl}</code>
							<CopyButton text={media.publicUrl} />
						</div>
					</div>
				{/if}

				<div class="actions">
					<Button href={media.downloadUrl} variant="outline" icon={Download}>Télécharger</Button>
					<Button href={`/applications/${applicationId}?dossier=${media.folderId}`} variant="ghost" icon={FolderOpen}>
						Ouvrir le dossier
					</Button>
					{#if canWrite && media.source === 'API'}
						<Alert variant="info">Envoyé par le site : il se supprime depuis le site uniquement.</Alert>
					{:else if canWrite && media.pins.length}
						<Alert variant="info">Utilisé par le site : il ne peut pas être supprimé tant que le site ne l'a pas libéré.</Alert>
					{:else if canWrite}
						{#if confirmingDelete}
							<form
								method="POST"
								action="?/deleteFile"
								class="confirm"
								use:enhance={toastEnhance({
									success: 'Fichier supprimé.',
									onSuccess: () => goto(closeHref, { noScroll: true, invalidateAll: true }),
									setBusy: (v) => (busy = v)
								})}
							>
								<input type="hidden" name="id" value={media.id} />
								<Button type="button" variant="ghost" onclick={() => (confirmingFor = null)}>Annuler</Button>
								<Button type="submit" variant="danger" icon={Trash2} loading={busy}>Confirmer</Button>
							</form>
						{:else}
							<Button variant="ghost" icon={Trash2} onclick={() => (confirmingFor = media!.id)}>Supprimer</Button>
						{/if}
					{/if}
				</div>
			</aside>
		</div>
	{/if}
</Modal>

<style>
	.viewer {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 300px;
		gap: 20px;
		min-height: min(75dvh, 760px);
	}
	.stage {
		position: relative;
		display: grid;
		place-items: center;
		background: var(--bg-muted);
		border-radius: var(--radius-lg);
		overflow: hidden;
		min-height: 320px;
	}
	.stage img,
	.stage video {
		max-width: 100%;
		max-height: min(75dvh, 760px);
		object-fit: contain;
		display: block;
	}
	.stage iframe {
		width: 100%;
		height: min(75dvh, 760px);
		border: 0;
		background: #fff;
	}
	.nav {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--bg-base) 85%, transparent);
		color: var(--text-heading);
		box-shadow: var(--shadow-md);
		z-index: 1;
	}
	.nav:hover {
		background: var(--bg-base);
	}
	.prev {
		left: 12px;
	}
	.next {
		right: 12px;
	}
	.details {
		display: flex;
		flex-direction: column;
		gap: 18px;
		min-width: 0;
	}
	dl {
		display: grid;
		gap: 12px;
		margin: 0;
	}
	dt {
		font-size: 12px;
		color: var(--text-subtle);
		margin-bottom: 2px;
	}
	dd {
		margin: 0;
		color: var(--text-heading);
		font-size: 14px;
	}
	dd a {
		color: var(--primary);
	}
	.public .label {
		font-size: 12px;
		color: var(--text-subtle);
	}
	.link-row {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 4px;
	}
	.link-row code {
		flex: 1;
		min-width: 0;
		font-size: 12px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		padding: 6px 8px;
		background: var(--bg-subtle);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
	}
	.texts {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding-top: 4px;
		border-top: 1px solid var(--border);
	}
	.actions,
	.confirm {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	@media (max-width: 900px) {
		.viewer {
			grid-template-columns: 1fr;
		}
		.stage img,
		.stage video {
			max-height: 60dvh;
		}
		.stage iframe {
			height: 60dvh;
		}
	}
</style>
