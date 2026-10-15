<script lang="ts">
	import type { Snippet } from 'svelte';
	import OrganizationHeader from '$lib/components/layout/OrganizationHeader.svelte';
	import type { LayoutData } from './$types';

	// An organization's pages (/o/<id>/…). The superadmin gets the organization's header and tabs;
	// an Admin uses its menu (« Mon organisation », « Mon application »).
	let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

{#if data.isSuperadmin && data.organization}
	<OrganizationHeader organization={data.organization} />
{/if}
{@render children()}
