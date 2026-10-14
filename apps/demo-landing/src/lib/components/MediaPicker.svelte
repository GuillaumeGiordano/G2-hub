<script lang="ts" module>
	/** What the picker hands back: enough to show the choice and store its id (DECISIONS.md §23). */
	export type PickedMedia = { id: string; name: string; alt: string | null; thumbnailUrl: string | null };
</script>

<script lang="ts">
	import { Alert, Button, Input, Modal, Pagination } from '@guillaumeg/ui';
	import { Images } from '@lucide/svelte';

	// « Choisir dans la médiathèque » — copy this component into a client site's back-office. It
	// reads `endpoint`, a route of the SITE's server that lists the images through G2 Hub with the
	// secret key (see routes/admin/media): the key never reaches the browser. The site then stores
	// the chosen file's ID (never its URL) and pins it.
	let {
		endpoint,
		onselect,
		label = 'Choisir dans la médiathèque'
	}: {
		/** Answers `?q=&page=` with `{ files: PickedMedia[], total, page, perPage }`. */
		endpoint: string;
		onselect: (media: PickedMedia) => void;
		label?: string;
	} = $props();

	const MODAL_ID = 'media-picker';

	let q = $state('');
	let page = $state(1);
	let files = $state<PickedMedia[]>([]);
	let total = $state(0);
	let perPage = $state(12);
	let loading = $state(false);
	let error = $state('');
	let searchTimer: ReturnType<typeof setTimeout> | undefined;

	const pageCount = $derived(Math.max(1, Math.ceil(total / perPage)));

	function modal() {
		return document.getElementById(MODAL_ID) as HTMLDialogElement | null;
	}

	async function load() {
		loading = true;
		error = '';
		try {
			const params = new URLSearchParams({ page: String(page) });
			if (q.trim()) params.set('q', q.trim());
			const res = await fetch(`${endpoint}?${params}`);
			const body = await res.json().catch(() => null);
			if (!res.ok) throw new Error(body?.message ?? 'Médiathèque indisponible.');
			files = body.files;
			total = body.total;
			perPage = body.perPage;
		} catch (err) {
			error = (err as Error).message;
		} finally {
			loading = false;
		}
	}

	function open() {
		modal()?.showModal();
		load();
	}

	/** Search as you type, once the typing pauses. */
	function onsearch() {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			page = 1;
			load();
		}, 250);
	}

	function goTo(p: number) {
		page = p;
		load();
	}

	function choose(media: PickedMedia) {
		onselect(media);
		modal()?.close();
	}
</script>

<Button type="button" variant="outline" icon={Images} onclick={open}>{label}</Button>

<Modal id={MODAL_ID} title="Médiathèque G2 Hub" size="lg">
	<div class="picker">
		<div oninput={onsearch} role="presentation">
			<Input label="Rechercher" bind:value={q} placeholder="Nom du fichier…" />
		</div>

		{#if error}
			<Alert variant="error">{error}</Alert>
		{:else if !loading && files.length === 0}
			<p class="empty">Aucune image{q.trim() ? ' pour cette recherche' : ' dans la médiathèque'}.</p>
		{:else}
			<ul class="grid" aria-busy={loading}>
				{#each files as media (media.id)}
					<li>
						<button type="button" class="tile" onclick={() => choose(media)} title={media.name}>
							{#if media.thumbnailUrl}
								<img src={media.thumbnailUrl} alt={media.alt ?? media.name} loading="lazy" />
							{/if}
							<span class="name">{media.name}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		{#if pageCount > 1}
			<Pagination {page} total={pageCount} onchange={goTo} />
		{/if}
	</div>
</Modal>

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
		gap: 10px;
	}
	.grid[aria-busy='true'] {
		opacity: 0.6;
	}
	.tile {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 0;
		border: 2px solid transparent;
		border-radius: var(--radius-md);
		background: none;
		cursor: pointer;
		text-align: left;
	}
	.tile:hover,
	.tile:focus-visible {
		border-color: var(--primary);
	}
	.tile img {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		border-radius: var(--radius-sm);
		display: block;
	}
	.name {
		font-size: 12px;
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		padding: 0 4px 4px;
	}
	.empty {
		margin: 0;
		color: var(--text-muted);
	}
</style>
