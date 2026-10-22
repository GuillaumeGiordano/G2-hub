<script lang="ts">
	import { goto } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import { Badge, Breadcrumb, EmptyState, Input, Pagination, SearchFilters, Select, Table } from '@guillaumeg/ui';
	import { History } from '@lucide/svelte';
	import PageTabs from '$lib/components/PageTabs.svelte';
	import SuperTitle from '$lib/components/SuperTitle.svelte';
	import { PER_PAGE_OPTIONS } from '$lib/constants';
	import { applicationTabs } from '$lib/records/navigation';
	import {
		SIGN_IN_RETENTION_DAYS,
		signInFilterOptions,
		signInMethodLabel,
		signInOutcomeLabel,
		signInOutcomeVariant
	} from '$lib/records/signIns';
	import { orgPath } from '$lib/utils/orgPath';
	import type { SignInEventItem } from '$lib/viewmodels/signIn';
	import type { PageData } from './$types';

	// Sign-in log of one application (§40): who tried to sign in, when, how, and from where.
	let { data }: { data: PageData } = $props();

	const tabs = $derived(
		applicationTabs(page.params.org!, data.application, data.canManageKeys, page.data.organization?.authEnabled ?? false)
	);
	const crumbs = $derived([
		{ label: 'Applications', href: orgPath(page.params.org!, '/applications') },
		{ label: data.application.name, href: orgPath(page.params.org!, `/applications/${data.application.id}`) },
		{ label: 'Journal des connexions' }
	]);
	const pageCount = $derived(Math.max(1, Math.ceil(data.total / data.perPage)));
	const filtering = $derived(!!page.url.searchParams.get('q') || (page.url.searchParams.get('result') ?? 'all') !== 'all');
	const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });
	const retentionMonths = Math.round(SIGN_IN_RETENTION_DAYS / 30.5);

	function goToPage(p: number) {
		const params = new URLSearchParams(page.url.searchParams);
		params.set('page', String(p));
		goto(`?${params.toString()}`);
	}

	function setPerPage(pp: number) {
		const params = new URLSearchParams(page.url.searchParams);
		params.set('perPage', String(pp));
		params.set('page', '1');
		goto(`?${params.toString()}`);
	}
</script>

{#snippet dateCell(event: SignInEventItem)}
	<span class="nowrap">{dateFormat.format(event.createdAt)}</span>
{/snippet}

{#snippet whoCell(event: SignInEventItem)}
	{#if event.name}<div class="strong">{event.name}</div>{/if}
	<div class="muted small">{event.email}</div>
{/snippet}

{#snippet outcomeCell(event: SignInEventItem)}
	<Badge label={signInOutcomeLabel[event.outcome]} variant={signInOutcomeVariant[event.outcome]} />
{/snippet}

{#snippet methodCell(event: SignInEventItem)}
	{signInMethodLabel[event.method]}
{/snippet}

{#snippet originCell(event: SignInEventItem)}
	<div class="mono small">{event.ipAddress ?? '—'}</div>
	{#if event.device}<div class="muted small">{event.device}</div>{/if}
{/snippet}

<div class="page">
	<Breadcrumb items={crumbs} />
	<SuperTitle
		headingLevel="h1"
		title={data.application.name}
		slogan={`Chaque tentative de connexion à cette application, conservée ${retentionMonths} mois.`}
	>
		<Badge label={`${data.total} événement${data.total > 1 ? 's' : ''}`} variant="default" />
	</SuperTitle>
	<PageTabs {tabs} />

	{#if data.total === 0 && !filtering}
		<EmptyState
			icon={History}
			title="Aucune connexion"
			description="Les connexions de ses utilisateurs (et de ses admins) s'afficheront ici."
		/>
	{:else}
		<SearchFilters collapsible columns={2} loading={!!navigating.to} title="Rechercher" urlDriven>
			<Input label="E-mail" name="q" placeholder="Rechercher une adresse…" />
			<Select label="Résultat" name="result" options={signInFilterOptions} placeholder="" />
		</SearchFilters>

		<Table
			rows={data.items}
			emptyLabel="Aucun événement trouvé."
			columns={[
				{ key: 'createdAt', label: 'Date', cell: dateCell },
				{ key: 'email', label: 'Utilisateur', cell: whoCell },
				{ key: 'outcome', label: 'Résultat', cell: outcomeCell },
				{ key: 'method', label: 'Moyen', cell: methodCell },
				{ key: 'ipAddress', label: 'Origine', cell: originCell }
			]}
		/>

		<div class="pager">
			<span class="count">{data.total} événement{data.total > 1 ? 's' : ''}</span>
			<Pagination
				page={data.page}
				total={pageCount}
				perPage={data.perPage}
				perPageOptions={PER_PAGE_OPTIONS}
				onchange={goToPage}
				onPerPageChange={setPerPage}
			/>
		</div>
	{/if}
</div>

<style>
	.nowrap {
		white-space: nowrap;
	}
	.small {
		font-size: 12px;
	}
	.mono {
		font-family: var(--font-mono, monospace);
	}
	.pager {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}
	.count {
		font-size: 13px;
		color: var(--text-muted);
	}
</style>
