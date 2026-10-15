<script lang="ts">
	import { enhance } from '$app/forms';
	import { Badge, Button, Card, FileInput, Input, Progress, Select, Switch, Textarea } from '@guillaumeg/ui';
	import { AppWindow, ArrowLeftRight, Building, ImageUp, Save, Trash2, Users } from '@lucide/svelte';
	import PageTabs from '$lib/components/PageTabs.svelte';
	import SuperTitle from '$lib/components/SuperTitle.svelte';
	import { organizationTabs } from '$lib/records/navigation';
	import { orgPath } from '$lib/utils/orgPath';
	import {
		formatBytes,
		legalFormOptions,
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
	import { organizationContractSchema, organizationProfileSchema } from '$lib/schemas/organizationProfile';
	import { frenchVatOf, isValidSiret, sirenOf } from '$lib/utils/companyIds';
	import { FieldErrors } from '$lib/utils/fieldErrors.svelte';
	import { toastEnhance } from '$lib/utils/toastEnhance';
	import type { PageData } from './$types';

	// « Mon organisation »: everything to know and keep about the active organization (§31). Its
	// Admins edit the profile; the superadmin also edits the contract. Every field is optional.
	let { data }: { data: PageData } = $props();

	const org = $derived(data.org);
	const p = $derived(data.org.profile);
	const percent = $derived(usagePercent(org.usedBytes, org.quotaBytes));
	const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' });

	const profileFields = [
		'name', 'legalName', 'legalForm', 'siret', 'vatNumber', 'nafCode', 'email', 'phone', 'website',
		'addressLine1', 'addressLine2', 'postalCode', 'city', 'country', 'billingAddressLine1',
		'billingAddressLine2', 'billingPostalCode', 'billingCity', 'billingCountry', 'billingEmail',
		'billingContactName', 'purchaseOrderRef', 'contactName', 'contactRole', 'contactEmail',
		'contactPhone', 'dpoName', 'dpoEmail'
	];
	const fields = new FieldErrors(profileFields, organizationProfileSchema);
	const contractFields = new FieldErrors(['status', 'contractStartedAt', 'internalNotes'], organizationContractSchema);

	let busy = $state<string | null>(null);
	const setBusy = (name: string) => (v: boolean) => (busy = v ? name : null);
	// The library FileInput keeps its own selection: re-mount it to clear it after a send.
	let logoRound = $state(0);

	// Editable copies of the fields that drive other ones (reset when the data changes).
	let legalForm = $derived(p.legalForm ?? '');
	let billingSame = $derived(p.billingSameAddress);
	let siret = $derived(p.siret ?? '');
	let vatNumber = $derived(p.vatNumber ?? '');
	let status = $derived<string>(org.contract.status);

	/** The French VAT number deduced from a valid SIRET, offered when the field is empty. */
	/** « — » first: the field stays optional and can be cleared. */
	const legalFormChoices = [{ value: '', label: '—' }, ...legalFormOptions];

	const suggestedVat = $derived(isValidSiret(siret) ? frenchVatOf(sirenOf(siret)) : null);
</script>

<div class="page">
	<SuperTitle headingLevel="h1" title={org.name} slogan="Votre organisation : son identité, ses coordonnées, sa facturation et son offre.">
		<Badge label={org.role ? orgRoleLabel[org.role] : SUPERADMIN_LABEL} variant="info" />
		<Badge label={organizationStatusLabel[org.contract.status]} variant={organizationStatusVariant[org.contract.status]} />
		{#if org.canSwitch}
			<Button variant="outline" icon={ArrowLeftRight} href="/choisir-organisation">Changer d'organisation</Button>
		{/if}
	</SuperTitle>
	<PageTabs tabs={organizationTabs(org.id)} />

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
				{#if org.contract.contractStartedAt}
					<div>
						<dt>Client depuis</dt>
						<dd>{dateFormat.format(new Date(org.contract.contractStartedAt))}</dd>
					</div>
				{/if}
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
		<fieldset disabled={!org.canEdit}>
			<Card>
				{#snippet header()}
					<div class="card-title">Identité</div>
				{/snippet}
				<div class="grid">
					<Input error={fields.get('name')} label="Nom d'usage" name="name" value={org.name} required />
					<Input error={fields.get('legalName')} label="Raison sociale" name="legalName" value={p.legalName ?? ''} />
					<Select bind:value={legalForm} error={fields.get('legalForm')} label="Forme juridique" name="legalForm" options={legalFormChoices} placeholder="" />
					<Input
						bind:value={siret}
						error={fields.get('siret')}
						label="SIRET"
						name="siret"
						hint={isValidSiret(siret) ? `SIREN : ${sirenOf(siret)}` : '14 chiffres.'}
					/>
					<div>
						<Input bind:value={vatNumber} error={fields.get('vatNumber')} label="N° de TVA intracommunautaire" name="vatNumber" />
						{#if suggestedVat && !vatNumber}
							<div class="suggest">
								<Button type="button" size="sm" variant="ghost" onclick={() => (vatNumber = suggestedVat ?? '')}>Utiliser {suggestedVat}</Button>
							</div>
						{/if}
					</div>
					<Input error={fields.get('nafCode')} label="Code NAF / APE" name="nafCode" value={p.nafCode ?? ''} hint="Ex. 62.01Z" />
				</div>
			</Card>

			<Card>
				{#snippet header()}
					<div class="card-title">Coordonnées et siège</div>
				{/snippet}
				<div class="grid">
					<Input error={fields.get('email')} label="E-mail général" name="email" type="email" value={p.email ?? ''} />
					<Input error={fields.get('phone')} label="Téléphone" name="phone" type="tel" value={p.phone ?? ''} />
					<Input error={fields.get('website')} label="Site web" name="website" value={p.website ?? ''} placeholder="https://" />
				</div>
				<div class="grid address">
					<Input error={fields.get('addressLine1')} label="Adresse" name="addressLine1" value={p.addressLine1 ?? ''} />
					<Input error={fields.get('addressLine2')} label="Complément" name="addressLine2" value={p.addressLine2 ?? ''} />
					<Input error={fields.get('postalCode')} label="Code postal" name="postalCode" value={p.postalCode ?? ''} />
					<Input error={fields.get('city')} label="Ville" name="city" value={p.city ?? ''} />
					<Input error={fields.get('country')} label="Pays" name="country" value={p.country ?? ''} placeholder="France" />
				</div>
			</Card>

			<Card>
				{#snippet header()}
					<div class="card-title">Facturation</div>
				{/snippet}
				<div class="switch-row">
					<Switch bind:checked={billingSame} label="Adresse de facturation identique au siège" />
				</div>
				<input type="hidden" name="billingSameAddress" value={billingSame ? 'on' : ''} />
				{#if !billingSame}
					<div class="grid">
						<Input error={fields.get('billingAddressLine1')} label="Adresse" name="billingAddressLine1" value={p.billingAddressLine1 ?? ''} />
						<Input error={fields.get('billingAddressLine2')} label="Complément" name="billingAddressLine2" value={p.billingAddressLine2 ?? ''} />
						<Input error={fields.get('billingPostalCode')} label="Code postal" name="billingPostalCode" value={p.billingPostalCode ?? ''} />
						<Input error={fields.get('billingCity')} label="Ville" name="billingCity" value={p.billingCity ?? ''} />
						<Input error={fields.get('billingCountry')} label="Pays" name="billingCountry" value={p.billingCountry ?? ''} placeholder="France" />
					</div>
				{/if}
				<div class="grid">
					<Input
						error={fields.get('billingEmail')}
						label="E-mail de facturation"
						name="billingEmail"
						type="email"
						value={p.billingEmail ?? ''}
						hint="Reçoit les factures."
					/>
					<Input error={fields.get('billingContactName')} label="Contact facturation" name="billingContactName" value={p.billingContactName ?? ''} />
					<Input
						error={fields.get('purchaseOrderRef')}
						label="Référence / bon de commande"
						name="purchaseOrderRef"
						value={p.purchaseOrderRef ?? ''}
						hint="À rappeler sur les factures, si besoin."
					/>
				</div>
			</Card>

			<Card>
				{#snippet header()}
					<div class="card-title">Contacts</div>
				{/snippet}
				<div class="grid">
					<Input error={fields.get('contactName')} label="Contact principal" name="contactName" value={p.contactName ?? ''} />
					<Input error={fields.get('contactRole')} label="Fonction" name="contactRole" value={p.contactRole ?? ''} />
					<Input error={fields.get('contactEmail')} label="E-mail" name="contactEmail" type="email" value={p.contactEmail ?? ''} />
					<Input error={fields.get('contactPhone')} label="Téléphone" name="contactPhone" type="tel" value={p.contactPhone ?? ''} />
				</div>
				<div class="grid">
					<Input error={fields.get('dpoName')} label="Contact RGPD / DPO" name="dpoName" value={p.dpoName ?? ''} />
					<Input error={fields.get('dpoEmail')} label="E-mail RGPD" name="dpoEmail" type="email" value={p.dpoEmail ?? ''} />
				</div>
			</Card>
		</fieldset>

		{#if org.canEdit}
			<div class="save">
				<Button type="submit" icon={Save} loading={busy === 'profile'}>Enregistrer les informations</Button>
			</div>
		{/if}
	</form>

	{#if org.isSuperadmin}
		<form
			method="POST"
			action="?/contract"
			novalidate
			oninput={contractFields.oninput}
			onfocusout={contractFields.onfocusout}
			use:enhance={toastEnhance({ success: 'Contrat enregistré.', setBusy: setBusy('contract'), fields: contractFields })}
		>
			<Card>
				{#snippet header()}
					<div class="card-head">
						<span class="card-title">Contrat</span>
						<Badge label="Visible par le superadmin seulement" variant="primary" />
					</div>
				{/snippet}
				<div class="grid">
					<Select
						bind:value={status}
						error={contractFields.get('status')}
						label="Statut"
						name="status"
						options={organizationStatusOptions}
						placeholder=""
						hint="Informatif pour l'instant : une organisation suspendue continue de fonctionner."
					/>
					<Input
						error={contractFields.get('contractStartedAt')}
						label="Début du contrat"
						name="contractStartedAt"
						type="date"
						value={org.contract.contractStartedAt ?? ''}
					/>
				</div>
				<Textarea
					error={contractFields.get('internalNotes')}
					label="Notes internes"
					name="internalNotes"
					rows={4}
					value={org.contract.internalNotes ?? ''}
					hint="Jamais visibles par les membres de l'organisation."
				/>
				<div class="save">
					<Button type="submit" icon={Save} loading={busy === 'contract'}>Enregistrer le contrat</Button>
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
	.profile,
	.profile fieldset {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	.profile fieldset {
		border: none;
		margin: 0;
		padding: 0;
		min-width: 0;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 12px 16px;
	}
	.grid + .grid {
		margin-top: 16px;
	}
	.switch-row {
		margin-bottom: 16px;
	}
	.address {
		margin-top: 16px;
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
	.profile .save {
		margin-top: 0;
	}
	.card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		flex-wrap: wrap;
	}
	.suggest {
		margin-top: 4px;
	}
	@media (max-width: 900px) {
		.top {
			grid-template-columns: 1fr;
		}
	}
</style>
