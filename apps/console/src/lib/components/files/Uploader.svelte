<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Badge, FileInput, Progress } from '@guillaumeg/ui';
	import { ACCEPT_ATTRIBUTE, uploadRefusal } from '$lib/records/files';
	import type { UploadTicket } from '$lib/viewmodels/file';

	// Uploads files of a folder (DECISIONS.md §5): for each one, 1. ask the hub for a ticket (type,
	// size, quota), 2. PUT the original straight to storage with a progress bar, 3. confirm so the hub
	// builds the processed versions. The list then reloads (files + storage usage).
	let { applicationId, folderId }: { applicationId: string; folderId: string } = $props();

	type Job = { key: number; name: string; progress: number; state: 'upload' | 'process' | 'done' | 'error'; error?: string };
	let jobs = $state<Job[]>([]);
	let nextKey = 0;
	// The library FileInput keeps its own file list: re-mount it to clear it after each selection.
	let round = $state(0);

	/** PUT with upload progress (fetch has no upload progress events). */
	function put(url: string, file: File, contentType: string, onProgress: (ratio: number) => void) {
		return new Promise<void>((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			xhr.open('PUT', url);
			xhr.setRequestHeader('Content-Type', contentType);
			xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
			xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Stockage : ${xhr.status}`)));
			xhr.onerror = () => reject(new Error('Envoi interrompu.'));
			xhr.send(file);
		});
	}

	async function errorOf(res: Response) {
		const body = await res.json().catch(() => null);
		return (body as { message?: string } | null)?.message ?? 'Envoi impossible.';
	}

	async function upload(file: File, job: Job) {
		const refusal = uploadRefusal(file);
		if (refusal) {
			Object.assign(job, { state: 'error', error: refusal });
			return;
		}
		try {
			const res = await fetch(`/applications/${applicationId}/fichiers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ folderId, name: file.name, size: file.size, contentType: file.type })
			});
			if (!res.ok) throw new Error(await errorOf(res));
			const ticket = (await res.json()) as UploadTicket;
			await put(ticket.uploadUrl, file, ticket.contentType, (r) => (job.progress = Math.round(r * 100)));
			job.state = 'process';
			const done = await fetch(`/applications/${applicationId}/fichiers/${ticket.fileId}`, { method: 'POST' });
			if (!done.ok) throw new Error(await errorOf(done));
			job.state = 'done';
		} catch (err) {
			Object.assign(job, { state: 'error', error: (err as Error).message });
		}
	}

	async function start(files: File[]) {
		if (!files.length) return;
		round++;
		const batch = files.map((f) => ({ key: nextKey++, name: f.name, progress: 0, state: 'upload' as const }));
		jobs = [...batch, ...jobs];
		// One at a time: keeps the quota checks in order and the VPS unloaded.
		for (let i = 0; i < files.length; i++) {
			await upload(files[i], jobs.find((j) => j.key === batch[i].key)!);
		}
		await invalidateAll();
		jobs = jobs.filter((j) => j.state === 'error');
	}

	// The picker's `change` and the drop zone's `drop` bubble up here (the library FileInput exposes
	// neither its files nor a callback).
	function onchange(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.type === 'file') start(Array.from(input.files ?? []));
	}
	function ondrop(e: DragEvent) {
		start(Array.from(e.dataTransfer?.files ?? []));
	}

	const stateLabel = { upload: 'Envoi', process: 'Traitement', done: 'Terminé', error: 'Échec' } as const;
	const stateVariant = { upload: 'info', process: 'info', done: 'success', error: 'danger' } as const;
</script>

<div class="uploader" {onchange} {ondrop} role="presentation">
	{#key round}
		<FileInput
			label="Ajouter des fichiers"
			hint="Images (JPEG, PNG, WebP, GIF, AVIF — 20 Mo max) ou PDF (20 Mo max). Glissez-les ou cliquez."
			accept={ACCEPT_ATTRIBUTE}
			multiple
		/>
	{/key}
</div>

{#if jobs.length}
	<ul class="jobs">
		{#each jobs as job (job.key)}
			<li>
				<div class="job-head">
					<span class="job-name">{job.name}</span>
					<Badge label={stateLabel[job.state]} variant={stateVariant[job.state]} />
				</div>
				{#if job.state === 'error'}
					<p class="job-error">{job.error}</p>
				{:else}
					<Progress value={job.state === 'upload' ? job.progress : 100} size="sm" animated={job.state === 'process'} />
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<style>
	.jobs {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.job-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 4px;
	}
	.job-name {
		font-size: 13px;
		color: var(--text-base);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.job-error {
		margin: 0;
		font-size: 13px;
		color: var(--danger);
	}
</style>
