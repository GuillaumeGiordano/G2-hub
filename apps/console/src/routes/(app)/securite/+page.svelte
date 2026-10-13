<script lang="ts">
	import { page } from '$app/state';
	import SuperTitle from '$lib/components/SuperTitle.svelte';
	import PasswordPanel from '$lib/components/PasswordPanel.svelte';
	import TwoFactorPanel from '$lib/components/TwoFactorPanel.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Set by the hook when a role requiring 2FA reaches the console without it.
	const setupRequired = $derived(page.url.searchParams.get('setup') === 'required');
</script>

<div class="page">
	<SuperTitle
		headingLevel="h1"
		title="Sécurité"
		slogan="Mot de passe et double authentification (2FA) de votre compte."
	/>

	<TwoFactorPanel enabled={data.twoFactorEnabled} mandatory={data.mandatory} {setupRequired} />
	<PasswordPanel />
</div>
