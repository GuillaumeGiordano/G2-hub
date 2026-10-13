// Wake-up line between the code that queues media work (fileService) and the worker that does it,
// without the two importing each other. Kept on globalThis: Vite HMR re-imports modules in dev.

type Signal = { wake: (() => void) | null };
const globalForSignal = globalThis as unknown as { mediaSignal?: Signal };
const signal: Signal = (globalForSignal.mediaSignal ??= { wake: null });

/** Ask the worker to look at the queue now instead of at its next poll. */
export function wakeWorker(): void {
	signal.wake?.();
}

/** The worker registers how to wake it while it sleeps (null when awake). */
export function setWaker(fn: (() => void) | null): void {
	signal.wake = fn;
}
