<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		slogan?: string;
		headingLevel?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
		addClass?: string;
		children?: Snippet;
		[key: string]: any;
	}

	let {
		title,
		slogan = '',
		headingLevel = 'h2',
		addClass = '',
		children,
		...others
	}: Props = $props();

	const headingClasses: Record<string, string> = {
		h1: 'text-3xl md:text-4xl',
		h2: 'text-2xl md:text-3xl',
		h3: 'text-xl md:text-2xl',
		h4: 'text-xl',
		h5: 'text-lg',
		h6: 'text-md'
	};
</script>

<div class="mx-auto w-full {addClass}" {...others}>
	<!-- The actions stay in the flow (not absolute): on a narrow screen they wrap under the title
	     instead of covering it. -->
	<div class="flex w-full flex-wrap items-center justify-between gap-3">
		<svelte:element this={headingLevel} class="min-w-0 break-words {headingClasses[headingLevel]}">
			{title}
		</svelte:element>

		{#if children}
			<div class="flex flex-wrap items-center gap-2">
				{@render children()}
			</div>
		{/if}
	</div>

	{#if slogan}
		<p class="my-slogan mt-3 italic">
			{slogan}
		</p>
	{/if}
</div>
