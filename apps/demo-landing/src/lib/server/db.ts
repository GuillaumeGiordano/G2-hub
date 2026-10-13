import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

// The demo site's OWN database — a JSON file standing in for the client's real database (Postgres,
// SQLite…). It keeps the site's business data (title, price) and, as the link to the photo, the
// G2 Hub file id (DECISIONS.md §22). The photo itself lives in G2 Hub.

export type Creation = {
	id: string;
	/** The photo in G2 Hub. */
	hubFileId: string;
	title: string;
	/** Price in cents, or null. */
	priceCents: number | null;
	createdAt: string;
};

const FILE = resolve('data/creations.json');

async function readAll(): Promise<Creation[]> {
	try {
		return JSON.parse(await readFile(FILE, 'utf-8')) as Creation[];
	} catch {
		return [];
	}
}

async function writeAll(rows: Creation[]): Promise<void> {
	await mkdir(dirname(FILE), { recursive: true });
	await writeFile(FILE, JSON.stringify(rows, null, '\t'));
}

export async function listCreations(): Promise<Creation[]> {
	return (await readAll()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addCreation(data: Omit<Creation, 'id' | 'createdAt'>): Promise<Creation> {
	const rows = await readAll();
	const creation: Creation = { ...data, id: randomUUID(), createdAt: new Date().toISOString() };
	await writeAll([...rows, creation]);
	return creation;
}

export async function findCreation(id: string): Promise<Creation | null> {
	return (await readAll()).find((c) => c.id === id) ?? null;
}

export async function removeCreation(id: string): Promise<void> {
	await writeAll((await readAll()).filter((c) => c.id !== id));
}
