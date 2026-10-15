<script lang="ts">
	import PageTabs from '$lib/components/PageTabs.svelte';
	import PasswordPanel from '$lib/components/PasswordPanel.svelte';
	import SuperTitle from '$lib/components/SuperTitle.svelte';
	import TwoFactorPanel from '$lib/components/TwoFactorPanel.svelte';
	import { organizationTabs } from '$lib/records/navigation';
	import type { PageData } from './$types';

	// « Mon organisation › Sécurité »: the password and two-factor authentication of your account.
	let { data }: { data: PageData } = $props();
</script>

<div class="page">
	<SuperTitle
		headingLevel="h1"
		title={data.organization.name}
		slogan="Mot de passe et double authentification (2FA) de votre compte."
	/>
	<PageTabs tabs={organizationTabs(data.organization.id)} />

	<TwoFactorPanel enabled={data.twoFactorEnabled} mandatory={data.mandatory} setupRequired={false} />
	<PasswordPanel />
</div>
