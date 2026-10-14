import type { FileKind } from '$lib/records/files';
import type { UsageLevel } from '$lib/records/organization';

/** One line of the breakdown: what it stores, how many files, and its share of the used space. */
export type StorageShare = { bytes: number; files: number; percent: number };

/** The « Stockage » page of the active organization (DECISIONS.md §10, step 4). */
export type StorageOverview = {
	usedBytes: number;
	quotaBytes: number;
	percent: number;
	level: UsageLevel;
	/** The tier above the current one, or null at the top. */
	nextQuotaBytes: number | null;
	/** Every application, the biggest first (applications without files included, at 0). */
	byApplication: (StorageShare & { id: string; name: string })[];
	byKind: (StorageShare & { kind: FileKind })[];
	/** « Demander plus d'espace » target, or null (no button). */
	upgradeUrl: string | null;
};
