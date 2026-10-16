<script lang="ts">
	import { enhance } from '$app/forms';
	import { Badge, Button, Card, EmptyState } from '@guillaumeg/ui';
	import { ExternalLink, LayoutGrid, LayoutDashboard, Power, Wrench } from '@lucide/svelte';
	import SuperTitle from '$lib/components/SuperTitle.svelte';
	import { toastEnhance } from '$lib/utils/toastEnhance';
	import type { PageData } from './$types';

	// « Outils » (§38): an Admin opens the client portal and the tools enabled for THIS organization
	// (a tool always opens for it); the superadmin also enables / disables each tool.
	let { data }: { data: PageData } = $props();

	let busy = $state(false);
	const setBusy = (v: boolean) => (busy = v);
</script>

<div class="page">
	<SuperTitle
		headingLevel={data.tools ? 'h2' : 'h1'}
		title="Outils"
		slogan="Les services de la plateforme, ouverts avec votre compte : pas de mot de passe à retaper."
	/>

	{#if data.launcher.length === 0}
		<EmptyState icon={LayoutGrid} title="Aucun outil" description="Aucun service n'est encore proposé à cette organisation." />
	{:else}
		<ul class="cards">
			{#each data.launcher as item (item.id)}
				<li>
					<a class="card-link" href={item.url} target="_blank" rel="noopener">
						<Card hoverable>
							<div class="card">
								<span class="logo">
									{#if item.kind === 'portal'}<LayoutDashboard size={28} />{:else}<Wrench size={28} />{/if}
								</span>
								<span class="name">{item.name}</span>
								<span class="meta"><ExternalLink size={14} /> {item.kind === 'portal' ? 'Mon espace' : 'Ouvrir'}</span>
							</div>
						</Card>
					</a>
				</li>
			{/each}
		</ul>
	{/if}

	{#if data.tools}
		<Card>
			{#snippet header()}
				<div class="card-title">Outils activés pour cette organisation</div>
			{/snippet}
			{#if data.tools.length === 0}
				<p class="muted">
					Aucun outil sur l'instance : réglez une application en « Outil de la plateforme » (onglet Connexion).
				</p>
			{:else}
				<ul class="tools">
					{#each data.tools as tool (tool.id)}
						<li class="tool">
							<div class="tool-name">
								<span class="strong">{tool.name}</span>
								<span class="muted small">{tool.ownerName}</span>
							</div>
							<Badge label={tool.enabled ? 'Activé' : 'Désactivé'} variant={tool.enabled ? 'success' : 'default'} />
							{#if tool.owned}
								<span class="muted small">Son organisation : toujours activé</span>
							{:else}
								<form
									method="POST"
									action="?/toggle"
									use:enhance={toastEnhance({
										success: (d) => `« ${d.tool} » ${d.enabled ? 'activé' : 'désactivé'}.`,
										setBusy
									})}
								>
									<input type="hidden" name="applicationId" value={tool.id} />
									<input type="hidden" name="enabled" value={tool.enabled ? 'false' : 'true'} />
									<Button type="submit" size="sm" variant={tool.enabled ? 'ghost' : 'secondary'} icon={Power} loading={busy}>
										{tool.enabled ? 'Désactiver' : 'Activer'}
									</Button>
								</form>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</Card>
	{/if}
</div>

<style>
	.cards {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 16px;
	}
	.card-link {
		display: block;
		color: inherit;
		text-decoration: none;
		border-radius: var(--radius-lg);
	}
	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		text-align: center;
	}
	.logo {
		display: grid;
		place-items: center;
		width: 64px;
		height: 64px;
		border-radius: var(--radius-lg);
		background: var(--bg-muted);
		color: var(--text-subtle);
	}
	.name {
		font-weight: 600;
		color: var(--text-heading);
	}
	.meta {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 13px;
		color: var(--text-muted);
	}
	.card-title {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-heading);
	}
	.tools {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}
	.tool {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
		padding: 10px 0;
		border-bottom: 1px solid var(--border);
	}
	.tool:last-child {
		border-bottom: none;
	}
	.tool-name {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 160px;
	}
	.small {
		font-size: 13px;
	}
	p {
		margin: 0;
		font-size: 14px;
	}
</style>
