import { prisma } from '$lib/server/db';

// Media processing queue — database queries only (DECISIONS.md §5).

/** A job is given up after this many failed attempts. */
export const MAX_ATTEMPTS = 3;

export type ClaimedJob = { id: string; fileId: string; attempts: number };

export function enqueue(fileId: string) {
	return prisma.mediaJob.create({ data: { fileId }, select: { id: true } });
}

/**
 * Atomically take the oldest queued job and mark it RUNNING. `FOR UPDATE SKIP LOCKED` locks the row
 * in the same statement that selects it: a concurrent claim skips it instead of blocking, so a
 * second process (or an overlapping dev restart) never runs the same ffmpeg twice.
 */
export async function claimNext(): Promise<ClaimedJob | null> {
	const rows = await prisma.$queryRaw<ClaimedJob[]>`
		UPDATE "MediaJob"
		SET status = 'RUNNING'::"MediaJobStatus", "startedAt" = now(), attempts = "MediaJob".attempts + 1
		WHERE id = (
			SELECT id FROM "MediaJob"
			WHERE status = 'QUEUED'::"MediaJobStatus"
			ORDER BY "createdAt"
			FOR UPDATE SKIP LOCKED
			LIMIT 1
		)
		RETURNING id, "fileId", attempts;
	`;
	return rows[0] ?? null;
}

export function markDone(jobId: string) {
	return prisma.mediaJob.update({
		where: { id: jobId },
		data: { status: 'DONE', lastError: null, finishedAt: new Date() }
	});
}

/** Requeue while attempts remain, else give up. Returns true when given up. */
export async function markFailed(job: ClaimedJob, message: string): Promise<boolean> {
	const giveUp = job.attempts >= MAX_ATTEMPTS;
	await prisma.mediaJob.update({
		where: { id: job.id },
		data: {
			status: giveUp ? 'FAILED' : 'QUEUED',
			lastError: message.slice(0, 1000),
			...(giveUp ? { finishedAt: new Date() } : {})
		}
	});
	return giveUp;
}

/** Jobs left RUNNING by a crash or restart go back to the queue (one worker per process: nothing
 *  else can legitimately hold a RUNNING job at startup). */
export async function requeueStale(): Promise<number> {
	const { count } = await prisma.mediaJob.updateMany({
		where: { status: 'RUNNING' },
		data: { status: 'QUEUED', startedAt: null }
	});
	return count;
}
