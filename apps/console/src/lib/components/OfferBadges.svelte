<script lang="ts">
	import { Badge } from '@guillaumeg/ui';
	import { offerHint, offerLabel, offersOf } from '$lib/records/organization';

	// The offers of an organization, side by side (DECISIONS.md §12); « Aucune offre » without any.
	let { organization }: { organization: { authEnabled: boolean; storageEnabled: boolean } } = $props();

	const offers = $derived(offersOf(organization));
</script>

<span class="offers">
	{#each offers as offer (offer)}
		<span title={offerHint[offer]}><Badge label={offerLabel[offer]} variant="primary" /></span>
	{:else}
		<Badge label="Aucune offre" variant="warning" />
	{/each}
</span>

<style>
	.offers {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 6px;
	}
</style>
