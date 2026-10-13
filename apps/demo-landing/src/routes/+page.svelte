<script lang="ts">
	import { Alert, EmptyState, GallerySection, HeroSection, ThemeToggle } from '@guillaumeg/ui';
	import { ImageOff } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const images = $derived(data.images);
</script>

<div class="corner"><ThemeToggle /></div>

<HeroSection
	title="Boulangerie"
	highlight="Côté Sud"
	description="Pains au levain, viennoiseries pur beurre et pâtisseries de saison, faits chaque matin à Ollioules."
	primaryCta={{ label: 'Voir nos créations', href: '#galerie' }}
/>

<section id="galerie" class="gallery">
	{#if data.error}
		<div class="notice">
			<Alert variant="warning" title="Galerie indisponible">{data.error}</Alert>
		</div>
	{:else if images.length === 0}
		<EmptyState icon={ImageOff} title="Aucune photo pour l'instant" description="Les photos ajoutées dans G2 Hub apparaîtront ici." />
	{:else}
		<GallerySection
			badge="Galerie"
			title="Nos créations"
			description="Photos gérées par la boulangerie dans G2 Hub — mises à jour sans toucher au site."
			{images}
			columns={3}
		/>
	{/if}
</section>

<footer class="footer">Site de démonstration — galerie servie par G2 Hub.</footer>

<style>
	.corner {
		position: fixed;
		top: 16px;
		right: 16px;
		z-index: 10;
	}
	.gallery {
		scroll-margin-top: 24px;
	}
	.notice {
		max-width: 720px;
		margin: 32px auto;
		padding: 0 16px;
	}
	.footer {
		padding: 32px 16px;
		text-align: center;
		font-size: 13px;
		color: var(--text-subtle);
	}
</style>
