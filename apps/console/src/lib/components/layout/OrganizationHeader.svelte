<script lang="ts">
	import { Badge } from '@guillaumeg/ui';
	import { ArrowLeft } from '@lucide/svelte';
	import PageTabs from '$lib/components/PageTabs.svelte';
	import { superadminOrganizationTabs } from '$lib/records/navigation';

	// The superadmin inside an organization (§34): back to the list, which organization is open, and
	// its pages as tabs — instead of a « work in this organization » switch.
	let { organization }: { organization: { id: string; name: string } } = $props();
</script>

<div class="page org-header">
	<a class="back" href="/organisations"><ArrowLeft size={16} /> Toutes les organisations</a>
	<div class="title">
		<span class="name">{organization.name}</span>
		<Badge label="Organisation" variant="default" />
	</div>
	<PageTabs tabs={superadminOrganizationTabs(organization.id)} />
</div>

<style>
	.org-header {
		padding-bottom: 0;
		gap: 12px;
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		width: fit-content;
		font-size: 13px;
		color: var(--text-muted);
		text-decoration: none;
	}
	.back:hover {
		color: var(--text-heading);
	}
	.title {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}
	.name {
		font-size: 22px;
		font-weight: 700;
		color: var(--text-heading);
	}
</style>
