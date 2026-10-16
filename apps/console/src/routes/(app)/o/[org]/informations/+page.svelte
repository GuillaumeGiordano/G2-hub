<script lang="ts">
	import { enhance } from '$app/forms';
	import { Badge, Button, Card, FileInput, Input, Progress, Select } from '@guillaumeg/ui';
	import { AppWindow, ArrowLeftRight, Building, ImageUp, Save, Trash2, Users } from '@lucide/svelte';
	import PageTabs from '$lib/components/PageTabs.svelte';
	import SuperTitle from '$lib/components/SuperTitle.svelte';
	import { organizationTabs } from '$lib/records/navigation';
	import { orgPath } from '$lib/utils/orgPath';
	import {
		formatBytes,
		LOGO_TYPES,
		offerLabel,
		organizationStatusLabel,
		organizationStatusOptions,
		organizationStatusVariant,
		orgRoleLabel,
		SUPERADMIN_LABEL,
		usageLevel,
		usageLevelColor,
		usagePercent
	} from '$lib/records/organization';
	import { organizationProfileSchema, organizationStatusSchema } from '$lib/schemas/organizationProfile';
	import { FieldErrors } from '$lib/utils/fieldErrors.svelte';
	import { toastEnhance } from '$lib/utils/toastEnhance';
	import type { PageData } from './$types';

	// « Mon organisation »: the organization's name, logo and offer (§31). Its Admins edit the name and
	// the logo; the superadmin also sets the status. The legal and billing profile lives in g2-erp.
	let { data }: { data: PageData } = $props();

	const org = $derived(data.org);
	const percent = $derived(usagePercent(org.usedBytes, org.quotaBytes));

	const fields = new FieldErrors(['name'], organizationProfileSchema);
	const statusFields = new FieldErrors(['status'], organizationStatusSchema);

	let busy = $state<string | null>(null);
	const setBusy = (name: string) => (v: boolean) => (busy = v ? name : null);
	// The library FileInput keeps its own selection: re-mount it to clear it after a send.
	let logoRound = $state(0);

	let status = $derived<string>(org.status);
</script>

<div class="page">
	<SuperTitle headingLevel="h1" title={org.name} slogan="Votre organisation : son nom, son logo et son offre.">
		<Badge label={org.role ? orgRoleLabel[org.role] : SUPERADMIN_LABEL} variant="info" />
		<Badge label={organizationStatusLabel[org.status]} variant={organizationStatusVariant[org.status]} />
		{#if org.canSwitch}
			<Button variant="outline" icon={ArrowLeftRight} href="/mes-organisations">Changer d'organisation</Button>
		{/if}
	</SuperTitle>
	{#if !org.isSuperadmin}<PageTabs tabs={organizationTabs(org.id)} />{/if}

	<div class="top">
		<Card>
			{#snippet header()}
				<div class="card-title">Logo</div>
			{/snippet}
			<div class="logo-box">
				<div class="logo">
					{#if org.logoUrl}
						<img src={org.logoUrl} alt={`Logo de ${org.name}`} />
					{:else}
						<Building size={40} />
					{/if}
				</div>
				{#if org.canEdit}
					<form
						method="POST"
						action="?/logo"
						enctype="multipart/form-data"
						class="logo-form"
						use:enhance={toastEnhance({ success: 'Logo enregistré.', onSuccess: () => logoRound++, setBusy: setBusy('logo') })}
					>
						{#key logoRound}
							<FileInput label="Nouveau logo" name="logo" accept={LOGO_TYPES.join(',')} hint="JPEG, PNG ou WebP — 2 Mo max. Redimensionné en 512 px." />
						{/key}
						<div class="row-actions">
							<Button type="submit" size="sm" icon={ImageUp} loading={busy === 'logo'}>Enregistrer</Button>
						</div>
					</form>
					{#if org.logoUrl}
						<form method="POST" action="?/removeLogo" use:enhance={toastEnhance({ success: 'Logo retiré.', setBusy: setBusy('removeLogo') })}>
							<Button type="submit" size="sm" variant="ghost" icon={Trash2} loading={busy === 'removeLogo'}>Retirer le logo</Button>
						</form>
					{/if}
				{/if}
			</div>
		</Card>

		<Card>
			{#snippet header()}
				<div class="card-title">Offre</div>
			{/snippet}
			<dl class="facts">
				<div>
					<dt>Offre</dt>
					<dd><Badge label={offerLabel(org.storageEnabled)} variant={org.storageEnabled ? 'primary' : 'default'} /></dd>
				</div>
				{#if org.storageEnabled}
					<div>
						<dt>Stockage</dt>
						<dd>{formatBytes(org.usedBytes)} / {formatBytes(org.quotaBytes)}</dd>
					</div>
				{/if}
				<div>
					<dt>Applications</dt>
					<dd>{org.applicationCount}</dd>
				</div>
				<div>
					<dt>Membres</dt>
					<dd>{org.memberCount}</dd>
				</div>
			</dl>
			{#if org.storageEnabled}
				<Progress value={percent} color={usageLevelColor[usageLevel(org.usedBytes, org.quotaBytes)]} />
			{/if}
			<div class="links">
				<Button variant="outline" size="sm" icon={AppWindow} href={orgPath(org.id, '/applications')}>Applications</Button>
				{#if org.isSuperadmin}<Button variant="outline" size="sm" icon={Users} href={orgPath(org.id, '/membres')}>Membres</Button>{/if}
			</div>
		</Card>
	</div>

	<form
		method="POST"
		action="?/profile"
		class="profile"
		novalidate
		oninput={fields.oninput}
		onfocusout={fields.onfocusout}
		use:enhance={toastEnhance({ success: 'Informations enregistrées.', setBusy: setBusy('profile'), fields })}
	>
		<Card>
			{#snippet header()}
				<div class="card-title">Identité</div>
			{/snippet}
			<fieldset disabled={!org.canEdit}>
				<Input error={fields.get('name')} label="Nom de l'organisation" name="name" value={org.name} required />
			</fieldset>
			<p class="note">
				Raison sociale, adresses, facturation et contacts sont gérés avec votre contrat, par votre prestataire.
			</p>
			{#if org.canEdit}
				<div class="save">
					<Button type="submit" icon={Save} loading={busy === 'profile'}>Enregistrer</Button>
				</div>
			{/if}
		</Card>
	</form>

	{#if org.isSuperadmin}
		<form
			method="POST"
			action="?/status"
			novalidate
			oninput={statusFields.oninput}
			onfocusout={statusFields.onfocusout}
			use:enhance={toastEnhance({ success: 'Statut enregistré.', setBusy: setBusy('status'), fields: statusFields })}
		>
			<Card>
				{#snippet header()}
					<div class="card-head">
						<span class="card-title">Statut</span>
						<Badge label="Visible par le superadmin seulement" variant="primary" />
					</div>
				{/snippet}
				<Select
					bind:value={status}
					error={statusFields.get('status')}
					label="Statut"
					name="status"
					options={organizationStatusOptions}
					placeholder=""
					hint="Informatif pour l'instant : une organisation suspendue continue de fonctionner."
				/>
				<div class="save">
					<Button type="submit" icon={Save} loading={busy === 'status'}>Enregistrer le statut</Button>
				</div>
			</Card>
		</form>
	{/if}
</div>

<style>
	.top {
		display: grid;
		grid-template-columns: minmax(240px, 1fr) 2fr;
		gap: 20px;
	}
	.profile fieldset {
		border: none;
		margin: 0;
		padding: 0;
		min-width: 0;
	}
	.note {
		margin: 12px 0 0;
		font-size: 13px;
		color: var(--text-muted);
	}
	.facts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 16px;
		margin: 0 0 16px;
	}
	.facts dt {
		font-size: 12px;
		color: var(--text-muted);
		margin-bottom: 4px;
	}
	.facts dd {
		margin: 0;
	}
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 16px;
	}
	.logo-box {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}
	.logo {
		display: grid;
		place-items: center;
		width: 128px;
		height: 128px;
		border-radius: var(--radius-lg);
		border: 1px solid var(--border);
		background: var(--bg-muted);
		color: var(--text-subtle);
		overflow: hidden;
	}
	.logo img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}
	.logo-form {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.row-actions,
	.save {
		display: flex;
		justify-content: flex-end;
	}
	.save {
		margin-top: 16px;
	}
	.card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		flex-wrap: wrap;
	}
	@media (max-width: 900px) {
		.top {
			grid-template-columns: 1fr;
		}
	}
</style>
