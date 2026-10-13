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
//
// With a SECRET key, a site's server also writes (DECISIONS.md §22):
//   const ticket = await hub.createUpload({ path: 'Galerie', name, size, contentType });
//   → the visitor's browser PUTs the file to `ticket.uploadUrl` (Content-Type = contentType)
//   const file = await hub.completeUpload(ticket.fileId);   // store file.id in the site's database
// or, when the file is already on the server: `await hub.uploadFile({ path, name, contentType, data })`.
// It also invites the users of its portal (DECISIONS.md §24): `await hub.inviteUser({ name, email })`.

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

export type HubFileStatus = 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED';

export type HubFile = {
	id: string;
	name: string;
	kind: HubFileKind;
	/** Listings only hold READY files; after an upload a video is PROCESSING for a while. */
	status: HubFileStatus;
	/** Alternative text and caption (editable in the hub's media library too). */
	alt: string | null;
	caption: string | null;
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
	/** Why processing failed (FAILED only). */
	error: string | null;
};

/** Where to upload: a folder `path` ("Galerie/2026") or its `folder` id. */
export type HubUploadTarget = { path: string; folder?: never } | { folder: string; path?: never };

export type HubUploadRequest = HubUploadTarget & {
	/** The file's name (shown in the hub's media library). */
	name: string;
	/** Exact size in bytes — the signed URL only accepts this size. */
	size: number;
	/** MIME type: image/jpeg, image/png, image/webp, image/gif, image/avif, video/mp4,
	 *  video/quicktime, video/webm, application/pdf. */
	contentType: string;
	alt?: string | null;
	caption?: string | null;
};

export type HubUploadTicket = {
	fileId: string;
	/** PUT the file's bytes here, with header Content-Type = `contentType`. */
	uploadUrl: string;
	contentType: string;
	expiresInSeconds: number;
};

/** A portal user of the application. INVITED until they choose their password. */
export type HubUser = { id: string; name: string; email: string; status: 'INVITED' | 'ACTIVE' | 'DISABLED' };

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
	/** One file by id (a publishable key only sees a READY file of a public folder). */
	file(id: string): Promise<HubFile>;

	// ── Secret key (server side) ──
	/** Reserve an upload (type, size, quota checked) and get the signed URL to PUT the file to. */
	createUpload(request: HubUploadRequest): Promise<HubUploadTicket>;
	/** The file was PUT: process it. Image / PDF → READY; video → PROCESSING (poll `file(id)`). */
	completeUpload(fileId: string): Promise<HubFile>;
	/** Ticket + PUT + completion in one go, for a file already on the server. */
	uploadFile(request: Omit<HubUploadRequest, 'size'> & { data: Blob | ArrayBuffer | Uint8Array }): Promise<HubFile>;
	/** Set alt and / or caption (null clears; absent = unchanged). */
	updateFile(id: string, text: { alt?: string | null; caption?: string | null }): Promise<HubFile>;
	/** Delete a file (and free its space). */
	deleteFile(id: string): Promise<void>;
	/** Invite someone to the application's portal: the account is created and the invitation
	 *  e-mailed (link valid 7 days). 400 if the address is already invited / registered. */
	inviteUser(user: { name: string; email: string }): Promise<HubUser>;
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

	async function get<T>(endpoint: string, params: Record<string, string | undefined> = {}): Promise<T> {
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

	/** A write (secret key only): no stale fallback — a write must really happen or fail. */
	async function send<T>(method: 'POST' | 'PATCH' | 'DELETE', endpoint: string, body?: unknown): Promise<T> {
		if (!secret) throw new HubError(403, 'Opération réservée à une clé secrète (côté serveur).');
		let res: Response;
		try {
			res = await fetchImpl(new URL(`/api/v1/${endpoint}`, baseUrl), {
				method,
				headers: { authorization: `Bearer ${key}`, ...(body ? { 'content-type': 'application/json' } : {}) },
				body: body ? JSON.stringify(body) : undefined
			});
		} catch {
			throw new HubError(0, 'Hub injoignable.');
		}
		const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
		if (!res.ok) throw new HubError(res.status, data?.error?.message ?? res.statusText);
		return data as T;
	}

	const client: HubClient = {
		folders: (path) => get<HubFolderListing>('folders', { path }),
		files: (path) => get<HubFileListing>('files', { path }),
		file: (id) => get<HubFile>(`files/${encodeURIComponent(id)}`),
		createUpload: (request) => send<HubUploadTicket>('POST', 'uploads', request),
		completeUpload: (fileId) => send<HubFile>('POST', `uploads/${encodeURIComponent(fileId)}/complete`),
		async uploadFile({ data, ...request }) {
			const bytes = data instanceof Blob ? data : new Blob([data as BlobPart]);
			const ticket = await client.createUpload({ ...request, size: bytes.size } as HubUploadRequest);
			const put = await fetchImpl(ticket.uploadUrl, {
				method: 'PUT',
				headers: { 'content-type': ticket.contentType },
				body: bytes
			});
			if (!put.ok) throw new HubError(put.status, `Envoi refusé par le stockage (${put.status}).`);
			return client.completeUpload(ticket.fileId);
		},
		updateFile: (id, text) => send<HubFile>('PATCH', `files/${encodeURIComponent(id)}`, text),
		deleteFile: async (id) => {
			await send<{ deleted: true }>('DELETE', `files/${encodeURIComponent(id)}`);
		},
		inviteUser: (user) => send<HubUser>('POST', 'users', user)
	};
	return client;
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
