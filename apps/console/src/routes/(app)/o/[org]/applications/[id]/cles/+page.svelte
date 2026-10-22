<script lang="ts">
	import { orgPath } from '$lib/utils/orgPath';
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import {
		Alert,
		Badge,
		Breadcrumb,
		Button,
		ButtonAction,
		ButtonActionItem,
		Card,
		CopyButton,
		EmptyState,
		Input,
		Modal,
		RadioGroup,
		Table
	} from '@guillaumeg/ui';
	import { Ban, EllipsisVertical, KeyRound, Plus } from '@lucide/svelte';
	import PageTabs from '$lib/components/PageTabs.svelte';
	import SuperTitle from '$lib/components/SuperTitle.svelte';
	import {
		apiKeyKindHint,
		apiKeyKindLabel,
		apiKeyKindOptions,
		apiKeyKindVariant,
		type ApiKeyKind
	} from '$lib/records/apiKeys';
	import { applicationTabs } from '$lib/records/navigation';
	import { apiKeyCreateSchema } from '$lib/schemas/apiKey';
	import { FieldErrors } from '$lib/utils/fieldErrors.svelte';
	import { toastEnhance } from '$lib/utils/toastEnhance';
	import type { ApiKeyListItem, CreatedApiKey } from '$lib/viewmodels/apiKey';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const tabs = $derived(applicationTabs(page.params.org!, data.application, true, page.data.organization?.authEnabled ?? false));
	const crumbs = $derived([
		{ label: 'Applications', href: orgPath(page.params.org!, '/applications') },
		{ label: data.application.name, href: orgPath(page.params.org!, `/applications/${data.application.id}`) },
		{ label: 'Clés API' }
	]);
	const apiBase = $derived(`${page.url.origin}/api/v1`);
	const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

	const CREATE_MODAL_ID = 'key-create';
	const REVEAL_MODAL_ID = 'key-reveal';
	const REVOKE_MODAL_ID = 'key-revoke';

	let busy = $state(false);
	const setBusy = (v: boolean) => (busy = v);

	let newKind = $state<ApiKeyKind>('PUBLISHABLE');
	const createErrors = new FieldErrors(['name', 'kind'], apiKeyCreateSchema);
	let created = $state<CreatedApiKey | null>(null);
	let toRevoke = $state<ApiKeyListItem | null>(null);

	function modal(id: string) {
		return document.getElementById(id) as HTMLDialogElement | null;
	}

	function openCreate() {
		newKind = 'PUBLISHABLE';
		createErrors.clear();
		modal(CREATE_MODAL_ID)?.showModal();
	}

	function openRevoke(key: ApiKeyListItem) {
		toRevoke = key;
		modal(REVOKE_MODAL_ID)?.showModal();
	}

	/** The full key is in the action's answer — the only time it exists outside the caller's hands. */
	async function onCreated(d: Record<string, unknown>) {
		modal(CREATE_MODAL_ID)?.close();
		created = d.created as CreatedApiKey;
		await tick();
		modal(REVEAL_MODAL_ID)?.showModal();
	}
</script>

{#snippet nameCell(key: ApiKeyListItem)}
	<div class="strong">{key.name}</div>
	<code class="prefix">{key.prefix}…</code>
{/snippet}

{#snippet kindCell(key: ApiKeyListItem)}
	<Badge label={apiKeyKindLabel[key.kind]} variant={apiKeyKindVariant[key.kind]} />
{/snippet}

{#snippet usedCell(key: ApiKeyListItem)}
	<span class="muted">{key.lastUsedAt ? dateFormat.format(key.lastUsedAt) : 'Jamais'}</span>
{/snippet}

{#snippet statusCell(key: ApiKeyListItem)}
	{#if key.revokedAt}
		<Badge label="Révoquée" variant="default" />
	{:else}
		<Badge label="Active" variant="success" />
	{/if}
{/snippet}

{#snippet actionsCell(key: ApiKeyListItem)}
	<div class="actions">
		{#if !key.revokedAt}
			<ButtonAction label="Actions" icon={EllipsisVertical} variant="ghost" size="sm">
				{#snippet items(close)}
					<ButtonActionItem
						label="Révoquer"
						icon={Ban}
						variant="danger"
						onclick={() => {
							openRevoke(key);
							close();
						}}
					/>
				{/snippet}
			</ButtonAction>
		{/if}
	</div>
{/snippet}

<div class="page">
	<Breadcrumb items={crumbs} />
	<SuperTitle headingLevel="h1" title={data.application.name} slogan="Clés d'accès à l'API du hub pour ce site ou ce portail.">
		<Button icon={Plus} onclick={openCreate}>Nouvelle clé</Button>
	</SuperTitle>
	<PageTabs {tabs} />

	{#if data.keys.length === 0}
		<EmptyState
			icon={KeyRound}
			title="Aucune clé API"
			description="Créez une clé publique pour afficher les fichiers d'un dossier public sur le site."
			cta={{ label: 'Créer une clé', onclick: openCreate }}
		/>
	{:else}
		<Table
			rows={data.keys}
			columns={[
				{ key: 'name', label: 'Clé', cell: nameCell },
				{ key: 'kind', label: 'Type', cell: kindCell },
				{ key: 'lastUsedAt', label: 'Dernière utilisation', cell: usedCell },
				{ key: 'revokedAt', label: 'État', cell: statusCell },
				{ key: 'id', label: '', align: 'right', cell: actionsCell }
			]}
		/>
	{/if}

	<Card>
		{#snippet header()}
			<div class="card-title">Utiliser l'API</div>
		{/snippet}
		<div class="usage">
			<p class="muted">Lister les fichiers d'un dossier public (clé publique, depuis le site) :</p>
			<pre><code>GET {apiBase}/files?path=Galerie&key=g2_pub_…</code></pre>
			<p class="muted">Lister les sous-dossiers (sans <code>path</code> : la racine de l'application) :</p>
			<pre><code>GET {apiBase}/folders?path=Galerie&key=g2_pub_…</code></pre>
			<p class="muted">Côté serveur, avec une clé secrète (fichiers privés compris, liens signés 10 min) :</p>
			<pre><code>GET {apiBase}/files?path=Documents
Authorization: Bearer g2_sec_…</code></pre>
		</div>
	</Card>
</div>

<Modal id={CREATE_MODAL_ID} title="Nouvelle clé API">
	<form
		method="POST"
		action="?/create"
		class="form"
		novalidate
		oninput={createErrors.oninput}
		onfocusout={createErrors.onfocusout}
		use:enhance={toastEnhance({
			success: 'Clé créée.',
			onSuccess: onCreated,
			resetOnSuccess: true,
			setBusy,
			fields: createErrors
		})}
	>
		<Input error={createErrors.get('name')} label="Nom" name="name" placeholder="Site vitrine" required />
		<RadioGroup legend="Type" bind:value={newKind} options={apiKeyKindOptions} orientation="horizontal" />
		<input type="hidden" name="kind" value={newKind} />
		<p class="hint">{apiKeyKindHint[newKind]}</p>
		<div class="form-submit">
			<Button type="submit" icon={Plus} loading={busy}>Créer la clé</Button>
		</div>
	</form>
</Modal>

{#if created}
	<Modal id={REVEAL_MODAL_ID} title="Clé créée">
		<div class="reveal">
			<Alert variant="warning" title="Copiez-la maintenant">
				Cette clé ne sera plus jamais affichée : seule son empreinte est conservée. En cas de perte,
				révoquez-la et créez-en une nouvelle.
			</Alert>
			<div class="key-row">
				<Badge label={apiKeyKindLabel[created.kind]} variant={apiKeyKindVariant[created.kind]} />
				<span class="strong">{created.name}</span>
			</div>
			<div class="key-row">
				<code class="key">{created.key}</code>
				<CopyButton text={created.key} />
			</div>
			{#if created.kind === 'SECRET'}
				<p class="hint">À garder côté serveur (variables d'environnement), jamais dans le code d'une page.</p>
			{/if}
		</div>
	</Modal>
{/if}

<Modal id={REVOKE_MODAL_ID} title="Révoquer la clé">
	<p class="confirm-text">
		Révoquer <strong>{toRevoke?.name}</strong> ? Le site qui l'utilise ne pourra plus appeler le hub
		immédiatement. Cette action est <strong>irréversible</strong>.
	</p>
	<form
		method="POST"
		action="?/revoke"
		class="confirm-actions"
		use:enhance={toastEnhance({
			success: 'Clé révoquée.',
			onSuccess: () => modal(REVOKE_MODAL_ID)?.close(),
			setBusy
		})}
	>
		<input type="hidden" name="id" value={toRevoke?.id} />
		<Button type="button" variant="ghost" onclick={() => modal(REVOKE_MODAL_ID)?.close()}>Annuler</Button>
		<Button type="submit" variant="danger" icon={Ban} loading={busy}>Révoquer</Button>
	</form>
</Modal>

<style>
	.prefix {
		font-size: 12px;
		color: var(--text-subtle);
		font-family: var(--font-mono, monospace);
	}
	.actions {
		display: flex;
		justify-content: flex-end;
	}
	.hint {
		font-size: 13px;
		color: var(--text-muted);
		margin: 0;
	}
	.usage pre {
		margin: 4px 0 14px;
		padding: 10px 12px;
		background: var(--bg-subtle);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		overflow-x: auto;
		font-size: 13px;
	}
	.usage p {
		margin: 0;
		font-size: 13px;
	}
	.reveal {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.key-row {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.key {
		font-family: var(--font-mono, monospace);
		font-size: 13px;
		word-break: break-all;
		padding: 8px 10px;
		background: var(--bg-subtle);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		flex: 1;
	}
</style>
