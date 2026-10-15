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
// It also invites the users of its portal (DECISIONS.md §24): `await hub.inviteUser({ name, email, role })`.
//
// A PORTAL's server reaches the personal space of the user signed in with « Se connecter avec G2 Hub »
// (DECISIONS.md §28) — secret key + that user's access token, both checked by the hub:
//   const me = hub.asUser(session.accessToken);
//   const avatar = await me.uploadFile({ space: 'public', name, contentType, data });
//   const { files } = await me.files('private');
// The token lasts one hour: a 401 means « sign the user in again ».

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
	/** The site's pins ("product:42"…): while one exists the hub refuses to delete the file. Filled
	 *  for a secret key only (always [] with a publishable key). */
	pins: string[];
};

/** One page of the application's media library (every folder), for a « choose a media » picker. */
export type HubMediaListing = { files: HubFile[]; total: number; page: number; perPage: number };

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

/** Role of a portal user, by importance (DECISIONS.md §26) — the portal decides what each may do. */
export type HubUserRole = 'SUPER_USER' | 'USER' | 'GUEST';

/** A portal user of the application. INVITED until they choose their password. */
export type HubUser = {
	id: string;
	name: string;
	email: string;
	role: HubUserRole;
	status: 'INVITED' | 'ACTIVE' | 'DISABLED';
};

/** A user's personal space: « public » (public bucket: avatar…) or « private » (signed links). */
export type HubSpace = 'public' | 'private';

export type HubPersonalUploadRequest = Omit<HubUploadRequest, 'path' | 'folder'> & { space: HubSpace };

/** The personal space of ONE signed-in portal user (secret key + their access token). Every file of
 *  another user is answered 404. */
export type HubUserSpace = {
	/** READY files of the space, newest first (private ones with 10-minute signed links). */
	files(space: HubSpace): Promise<{ space: HubSpace; files: HubFile[] }>;
	/** One of the user's files by id. */
	file(id: string): Promise<HubFile>;
	/** Reserve an upload in the space (created on first use); the quota is the organization's. */
	createUpload(request: HubPersonalUploadRequest): Promise<HubUploadTicket>;
	/** The file was PUT: process it. */
	completeUpload(fileId: string): Promise<HubFile>;
	/** Ticket + PUT + completion in one go, for a file already on the server. */
	uploadFile(request: Omit<HubPersonalUploadRequest, 'size'> & { data: Blob | ArrayBuffer | Uint8Array }): Promise<HubFile>;
	updateFile(id: string, text: { alt?: string | null; caption?: string | null }): Promise<HubFile>;
	deleteFile(id: string): Promise<void>;
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
	/** One file by id (a publishable key only sees a READY file of a public folder). */
	file(id: string): Promise<HubFile>;
	/** The application's READY files, every folder together, newest first — what a « choose a media »
	 *  picker lists. `q` searches the name; `folder` (an id) keeps that folder and its subfolders; a
	 *  publishable key only sees public files. */
	media(params?: { q?: string; kind?: HubFileKind; folder?: string; page?: number; perPage?: number }): Promise<HubMediaListing>;

	// ── Secret key (server side) ──
	/** Every folder of the application, flat, with its full path ("Galerie/Été"), sorted by path —
	 *  what a « folder » select lists. */
	folderTree(): Promise<{ folders: HubFolder[] }>;
	/** Reserve an upload (type, size, quota checked) and get the signed URL to PUT the file to. */
	createUpload(request: HubUploadRequest): Promise<HubUploadTicket>;
	/** The file was PUT: process it. Image / PDF → READY; video → PROCESSING (poll `file(id)`). */
	completeUpload(fileId: string): Promise<HubFile>;
	/** Ticket + PUT + completion in one go, for a file already on the server. */
	uploadFile(request: Omit<HubUploadRequest, 'size'> & { data: Blob | ArrayBuffer | Uint8Array }): Promise<HubFile>;
	/** Set alt and / or caption (null clears; absent = unchanged). */
	updateFile(id: string, text: { alt?: string | null; caption?: string | null }): Promise<HubFile>;
	/** Delete a file (and free its space). Refused (409) while the file is pinned. */
	deleteFile(id: string): Promise<void>;
	/** Declare that the site uses the file for `ref` (its own label, e.g. "product:42": letters, digits,
	 *  `: _ - .`). While at least one pin exists, nobody can delete it — a card keeps its photo.
	 *  Idempotent. */
	pinFile(id: string, ref: string): Promise<HubFile>;
	/** The site no longer uses the file for `ref` (card deleted, photo replaced). Idempotent. */
	unpinFile(id: string, ref: string): Promise<HubFile>;
	/** Invite someone to the application's portal: the account is created and the invitation
	 *  e-mailed (link valid 7 days). `role` defaults to USER. 400 if the address is already invited /
	 *  registered. */
	inviteUser(user: { name: string; email: string; role?: HubUserRole }): Promise<HubUser>;
	/** The personal space of the user this access token was issued to (« Se connecter avec G2 Hub »,
	 *  same application). */
	asUser(accessToken: string): HubUserSpace;
};

/** The header carrying the signed-in user's access token (personal spaces). */
const USER_TOKEN_HEADER = 'x-g2-user-token';

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

	/** `userToken`: a personal-space read — never served stale (the cache is not per user). */
	async function get<T>(endpoint: string, params: Record<string, string | undefined> = {}, userToken?: string): Promise<T> {
		const url = new URL(`/api/v1/${endpoint}`, baseUrl);
		for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
		const cacheKey = url.toString(); // without the key
		if (!secret) url.searchParams.set('key', key);
		const stale = serveStaleOnError && !userToken;

		let res: Response;
		try {
			res = await fetchImpl(url, {
				headers: {
					...(secret ? { authorization: `Bearer ${key}` } : {}),
					...(userToken ? { [USER_TOKEN_HEADER]: userToken } : {})
				}
			});
		} catch {
			if (stale && lastGood.has(cacheKey)) return lastGood.get(cacheKey) as T;
			throw new HubError(0, 'Hub injoignable.');
		}
		const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
		if (!res.ok) {
			// A 4xx is an answer (wrong key, folder deleted…): never hidden behind stale data.
			if (res.status >= 500 && stale && lastGood.has(cacheKey)) return lastGood.get(cacheKey) as T;
			throw new HubError(res.status, body?.error?.message ?? res.statusText);
		}
		if (!userToken) lastGood.set(cacheKey, body);
		return body as T;
	}

	/** A write (secret key only): no stale fallback — a write must really happen or fail. */
	async function send<T>(
		method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
		endpoint: string,
		body?: unknown,
		userToken?: string
	): Promise<T> {
		if (!secret) throw new HubError(403, 'Opération réservée à une clé secrète (côté serveur).');
		let res: Response;
		try {
			res = await fetchImpl(new URL(`/api/v1/${endpoint}`, baseUrl), {
				method,
				headers: {
					authorization: `Bearer ${key}`,
					...(userToken ? { [USER_TOKEN_HEADER]: userToken } : {}),
					...(body ? { 'content-type': 'application/json' } : {})
				},
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
		media: (params = {}) =>
			get<HubMediaListing>('media', {
				q: params.q,
				kind: params.kind,
				folder: params.folder,
				page: params.page ? String(params.page) : undefined,
				perPage: params.perPage ? String(params.perPage) : undefined
			}),
		folderTree: () => get<{ folders: HubFolder[] }>('folders/tree'),
		createUpload: (request) => send<HubUploadTicket>('POST', 'uploads', request),
		completeUpload: (fileId) => send<HubFile>('POST', `uploads/${encodeURIComponent(fileId)}/complete`),
		async uploadFile({ data, ...request }) {
			const bytes = toBlob(data);
			const ticket = await client.createUpload({ ...request, size: bytes.size } as HubUploadRequest);
			await putBytes(ticket, bytes);
			return client.completeUpload(ticket.fileId);
		},
		updateFile: (id, text) => send<HubFile>('PATCH', `files/${encodeURIComponent(id)}`, text),
		deleteFile: async (id) => {
			await send<{ deleted: true }>('DELETE', `files/${encodeURIComponent(id)}`);
		},
		pinFile: (id, ref) => send<HubFile>('PUT', `files/${encodeURIComponent(id)}/pins/${encodeURIComponent(ref)}`),
		unpinFile: (id, ref) => send<HubFile>('DELETE', `files/${encodeURIComponent(id)}/pins/${encodeURIComponent(ref)}`),
		inviteUser: (user) => send<HubUser>('POST', 'users', user),
		asUser(accessToken) {
			if (!secret) throw new HubError(403, 'Opération réservée à une clé secrète (côté serveur).');
			const t = accessToken;
			const space: HubUserSpace = {
				files: (s) => get<{ space: HubSpace; files: HubFile[] }>('me/files', { space: s }, t),
				file: (id) => get<HubFile>(`files/${encodeURIComponent(id)}`, {}, t),
				createUpload: (request) => send<HubUploadTicket>('POST', 'me/uploads', request, t),
				completeUpload: (fileId) => send<HubFile>('POST', `uploads/${encodeURIComponent(fileId)}/complete`, undefined, t),
				async uploadFile({ data, ...request }) {
					const bytes = toBlob(data);
					const ticket = await space.createUpload({ ...request, size: bytes.size });
					await putBytes(ticket, bytes);
					return space.completeUpload(ticket.fileId);
				},
				updateFile: (id, text) => send<HubFile>('PATCH', `files/${encodeURIComponent(id)}`, text, t),
				deleteFile: async (id) => {
					await send<{ deleted: true }>('DELETE', `files/${encodeURIComponent(id)}`, undefined, t);
				}
			};
			return space;
		}
	};

	const toBlob = (data: Blob | ArrayBuffer | Uint8Array) => (data instanceof Blob ? data : new Blob([data as BlobPart]));

	/** PUT the bytes to the ticket's signed URL (straight to storage, no key involved). */
	async function putBytes(ticket: HubUploadTicket, bytes: Blob) {
		const put = await fetchImpl(ticket.uploadUrl, {
			method: 'PUT',
			headers: { 'content-type': ticket.contentType },
			body: bytes
		});
		if (!put.ok) throw new HubError(put.status, `Envoi refusé par le stockage (${put.status}).`);
	}

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
