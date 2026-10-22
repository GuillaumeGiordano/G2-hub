import * as jobRepo from '$lib/server/repositories/mediaJobRepository';
import { cleanupAbandonedUploads, failVideo, processQueuedVideo } from '$lib/server/services/fileService';
import { purgeExpiredGrants } from '$lib/server/services/oidcService';
import { purgeOldSignIns } from '$lib/server/services/signInLogService';
import { purgeUnconfirmedSignups } from '$lib/server/services/signupService';
import { setWaker } from './signal';

// Single in-process worker draining the media queue, one job at a time (DECISIONS.md §5) —
// adapted from ShareMoment. Concurrency is deliberately 1: ffmpeg is CPU-heavy and the VPS is shared.
// It also removes abandoned uploads. Started from hooks.server.ts (`init`).

/** Idle poll interval; `wakeWorker()` short-circuits it when a job is queued. */
const IDLE_MS = 30_000;
/** Backoff after a failure, so a broken ffmpeg does not spin the CPU. */
const ERROR_MS = 5_000;
/** How often abandoned uploads are looked for. */
const CLEANUP_EVERY_MS = 10 * 60_000;

// Survives Vite HMR in dev, which re-imports this module on every change and would otherwise start
// a second worker on each reload.
const globalForWorker = globalThis as unknown as { mediaWorkerStarted?: boolean };

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		const timer = setTimeout(done, ms);
		setWaker(done);
		function done() {
			clearTimeout(timer);
			setWaker(null);
			resolve();
		}
	});
}

async function loop(): Promise<void> {
	const stale = await jobRepo.requeueStale();
	if (stale) console.log(`[media] requeued ${stale} job(s) left running by a restart`);
	let lastCleanup = 0;

	for (;;) {
		if (Date.now() - lastCleanup > CLEANUP_EVERY_MS) {
			lastCleanup = Date.now();
			const removed = await cleanupAbandonedUploads().catch((err) => {
				console.error('[media] cleanup failed:', err);
				return 0;
			});
			if (removed) console.log(`[media] removed ${removed} abandoned upload(s)`);
			// Same housekeeping tick: expired sign-in codes and access tokens (§25).
			await purgeExpiredGrants().catch((err) => console.error('[oidc] purge failed:', err));
			// And the sign-in log beyond its retention (§40).
			await purgeOldSignIns().catch((err) => console.error('[sign-in log] purge failed:', err));
			// And the sign-ups never confirmed (§45).
			const unconfirmed = await purgeUnconfirmedSignups().catch((err) => {
				console.error('[sign-up] purge failed:', err);
				return 0;
			});
			if (unconfirmed) console.log(`[sign-up] removed ${unconfirmed} unconfirmed account(s)`);
		}

		let job: jobRepo.ClaimedJob | null = null;
		try {
			job = await jobRepo.claimNext();
		} catch (err) {
			// A transient DB error must not kill the worker for the process's lifetime.
			console.error('[media] claim failed:', err);
			await sleep(ERROR_MS);
			continue;
		}
		if (!job) {
			await sleep(IDLE_MS);
			continue;
		}

		const startedAt = Date.now();
		try {
			await processQueuedVideo(job.fileId);
			await jobRepo.markDone(job.id);
			console.log(`[media] processed ${job.fileId} in ${Math.round((Date.now() - startedAt) / 1000)}s`);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			console.error(`[media] job ${job.id} failed (attempt ${job.attempts}):`, message);
			const gaveUp = await jobRepo.markFailed(job, message).catch(() => false);
			if (gaveUp) await failVideo(job.fileId).catch((e) => console.error('[media] failVideo:', e));
			await sleep(ERROR_MS);
		}
	}
}

/** Start the worker once per process. Safe to call on every module load. */
export function startMediaWorker(): void {
	if (globalForWorker.mediaWorkerStarted) return;
	globalForWorker.mediaWorkerStarted = true;
	// Detached on purpose: the loop runs for the process's lifetime and must never block startup.
	loop().catch((err) => {
		globalForWorker.mediaWorkerStarted = false;
		console.error('[media] worker crashed:', err);
	});
}
