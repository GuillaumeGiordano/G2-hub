<script lang="ts">
	import { Card, EmptyState } from '@guillaumeg/ui';
	import { AppWindow, Building } from '@lucide/svelte';
	import SuperTitle from '$lib/components/SuperTitle.svelte';
	import { orgPath } from '$lib/utils/orgPath';
	import type { PageData } from './$types';

	// An Admin of several organizations picks the one to open.
	let { data }: { data: PageData } = $props();
</script>

<div class="page">
	<SuperTitle headingLevel="h1" title="Mes organisations" slogan="Les organisations dont vous êtes admin." />

	{#if data.organizations.length === 0}
		<EmptyState icon={Building} title="Aucune organisation" description="Vous n'êtes membre d'aucune organisation pour le moment." />
	{:else}
		<ul class="cards">
			{#each data.organizations as org (org.id)}
				<li>
					<a class="card-link" href={orgPath(org.id)}>
						<Card hoverable>
							<div class="card">
								<span class="logo">
									{#if org.logoUrl}
										<img src={org.logoUrl} alt="" />
									{:else}
										<Building size={28} />
									{/if}
								</span>
								<span class="name">{org.name}</span>
								<span class="meta">
									<AppWindow size={14} />
									{org.applicationCount} application{org.applicationCount > 1 ? 's' : ''}
								</span>
							</div>
						</Card>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.cards {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
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
		width: 72px;
		height: 72px;
		border-radius: var(--radius-lg);
		background: var(--bg-muted);
		color: var(--text-subtle);
		overflow: hidden;
	}
	.logo img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
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
</style>
