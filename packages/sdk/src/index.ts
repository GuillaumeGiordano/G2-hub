// @g2/hub-client — read a G2 Hub application's folders and files from a client site or server.
//
//   const hub = createHubClient({ baseUrl: 'https://hub.example.fr', key: 'g2_pub_…' });
//   const { files } = await hub.files('Galerie/2026');
//   <img src={files[0].url} srcset={imageSrcset(files[0])} sizes="(max-width: 600px) 100vw, 33vw" />
//
// A publishable key (`g2_pub_…`) may live in a browser: it is sent as `?key=` (no CORS preflight)
// and only reads PUBLIC folders. A secret key (`g2_sec_…`) is server-only: it is sent in the
// Authorization header, and this client refuses to be created with one in a browser.
// Works with any fetch implementation (browsers, Node 18+, SvelteKit's `fetch`).

export type HubVisibility = 'PUBLIC' | 'PRIVATE';
export type HubFileKind = 'IMAGE' | 'VIDEO' | 'PDF';

export type HubFolder = { id: string; name: string; path: string; visibility: HubVisibility };

export type HubVersion = {
	url: string;
	contentType: string;
	bytes: number;
	width: number | null;
	height: number | null;
};

export type HubFile = {
	id: string;
	name: string;
	kind: HubFileKind;
	width: number | null;
	height: number | null;
	bytes: number;
	/** ISO date. */
	createdAt: string;
	/** Main version: largest image, the video, the PDF. */
	url: string;
	/** Image thumbnail or video poster; null for a PDF. */
	thumbnailUrl: string | null;
	/** thumb / medium / large (image), video / poster (video), document (PDF). */
	versions: Record<string, HubVersion>;
};

export type HubFolderListing = { folder: HubFolder | null; folders: HubFolder[] };
export type HubFileListing = { folder: HubFolder; files: HubFile[] };

/** An error answered by the hub (`status` 0 = the hub could not be reached). */
export class HubError extends Error {
	constructor(
		readonly status: number,
		message: string
	) {
		super(message);
		this.name = 'HubError';
	}
}

export type HubClientOptions = {
	/** The hub's address, e.g. "https://hub.g2webdev.fr". */
	baseUrl: string;
	/** An application key: `g2_pub_…` (browser-safe) or `g2_sec_…` (server only). */
	key: string;
	/** fetch to use (default: the global one). In SvelteKit loads, pass the `fetch` argument. */
	fetch?: typeof fetch;
	/**
	 * When the hub cannot be reached (network error, 5xx), answer with the last listing received
	 * for the same request instead of failing — a site keeps showing its gallery (default: true).
	 */
	serveStaleOnError?: boolean;
};

export type HubClient = {
	/** Subfolders of `path` ("Galerie"); without `path`, the application's root folders. */
	folders(path?: string): Promise<HubFolderListing>;
	/** Files of the folder at `path` ("Galerie/2026"), newest first. */
	files(path: string): Promise<HubFileListing>;
};

const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';

export function createHubClient(options: HubClientOptions): HubClient {
	const { baseUrl, key, serveStaleOnError = true } = options;
	const fetchImpl = options.fetch ?? globalThis.fetch;
	const secret = key.startsWith('g2_sec_');
	if (secret && isBrowser()) {
		throw new HubError(0, 'Clé secrète interdite dans un navigateur : utilisez une clé publique (g2_pub_…).');
	}
	/** Last good answer per request, served when the hub is unreachable. */
	const lastGood = new Map<string, unknown>();

	async function get<T>(endpoint: string, params: Record<string, string | undefined>): Promise<T> {
		const url = new URL(`/api/v1/${endpoint}`, baseUrl);
		for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
		const cacheKey = url.toString(); // without the key
		if (!secret) url.searchParams.set('key', key);

		let res: Response;
		try {
			res = await fetchImpl(url, { headers: secret ? { authorization: `Bearer ${key}` } : {} });
		} catch {
			if (serveStaleOnError && lastGood.has(cacheKey)) return lastGood.get(cacheKey) as T;
			throw new HubError(0, 'Hub injoignable.');
		}
		const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
		if (!res.ok) {
			// A 4xx is an answer (wrong key, folder deleted…): never hidden behind stale data.
			if (res.status >= 500 && serveStaleOnError && lastGood.has(cacheKey)) return lastGood.get(cacheKey) as T;
			throw new HubError(res.status, body?.error?.message ?? res.statusText);
		}
		lastGood.set(cacheKey, body);
		return body as T;
	}

	return {
		folders: (path) => get<HubFolderListing>('folders', { path }),
		files: (path) => get<HubFileListing>('files', { path })
	};
}

/** `srcset` of an image file from its widths ("…/thumb.webp 400w, …/medium.webp 1200w, …"), so the
 *  browser downloads the smallest version that fits. Empty for a video / PDF. */
export function imageSrcset(file: HubFile): string {
	if (file.kind !== 'IMAGE') return '';
	return ['thumb', 'medium', 'large']
		.map((name) => file.versions[name])
		.filter((v): v is HubVersion => !!v && !!v.width)
		.map((v) => `${v.url} ${v.width}w`)
		.join(', ');
}
