<script lang="ts">
	import { enhance } from '$app/forms';
	import { Badge, Button, Card, EmptyState } from '@guillaumeg/ui';
	import { ArrowRight, Building } from '@lucide/svelte';
	import SuperTitle from '$lib/components/SuperTitle.svelte';
	import type { PageData } from './$types';

	// A member of several organizations picks the one to work in.
	let { data }: { data: PageData } = $props();
</script>

<div class="page">
	<SuperTitle headingLevel="h1" title="Choisir une organisation" slogan="Les organisations dont vous êtes membre." />

	{#if data.organizations.length === 0}
		<EmptyState
			icon={Building}
			title="Aucune organisation"
			description="Vous n'êtes membre d'aucune organisation pour le moment."
		/>
	{:else}
		<Card>
			<ul class="list">
				{#each data.organizations as org (org.id)}
					<li>
						<span class="name">
							<Building size={18} />
							<span class="strong">{org.name}</span>
							{#if org.id === data.activeId}<Badge label="Active" variant="success" />{/if}
						</span>
						<form method="POST" action="?/open" use:enhance>
							<input type="hidden" name="id" value={org.id} />
							<Button type="submit" variant="outline" size="sm" icon={ArrowRight}>Ouvrir</Button>
						</form>
					</li>
				{/each}
			</ul>
		</Card>
	{/if}
</div>

<style>
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}
	.list li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 0;
		border-bottom: 1px solid var(--border);
	}
	.list li:last-child {
		border-bottom: none;
	}
	.name {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
</style>
