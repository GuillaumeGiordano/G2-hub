import {
	DeleteObjectsCommand,
	GetObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { env } from '$env/dynamic/private';
import type { Visibility } from '$lib/records/storage';

// Object storage (S3-compatible): MinIO in dev, Infomaniak Object Storage in prod — same code,
// only the .env differs (a delivered copy points at the client's own bucket). Two buckets
// (DECISIONS.md §7): PUBLIC is anonymously readable by URL, PRIVATE only through signed links.
//
// `forcePathStyle` + the "when required" checksums are needed by MinIO / Ceph (Infomaniak): the
// SDK's default CRC32 checksums break presigned uploads there.
function createClient() {
	const client = new S3Client({
		endpoint: env.S3_ENDPOINT,
		region: env.S3_REGION || 'us-east-1',
		forcePathStyle: true,
		requestChecksumCalculation: 'WHEN_REQUIRED',
		responseChecksumValidation: 'WHEN_REQUIRED',
		credentials: {
			accessKeyId: env.S3_ACCESS_KEY_ID ?? '',
			secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? ''
		}
	});
	// Swift (Infomaniak) refuses a multi-object delete without Content-MD5, which recent SDKs no
	// longer send (they use CRC32 checksums instead). Add it back before signing; MinIO accepts it too.
	client.middlewareStack.add(
		(next, context) => async (args) => {
			const request = args.request as { headers: Record<string, string>; body?: unknown };
			if (context.commandName === 'DeleteObjectsCommand' && typeof request.body === 'string') {
				request.headers['content-md5'] = createHash('md5').update(request.body).digest('base64');
			}
			return next(args);
		},
		{ step: 'build', name: 'contentMd5ForDeleteObjects' }
	);
	return client;
}

const globalForS3 = globalThis as unknown as { s3?: S3Client };
const s3 = globalForS3.s3 ?? createClient();
if (import.meta.env.DEV) globalForS3.s3 = s3;

export function bucketOf(visibility: Visibility): string {
	return (visibility === 'PUBLIC' ? env.S3_BUCKET_PUBLIC : env.S3_BUCKET_PRIVATE) ?? '';
}

/** Direct, stable URL of a public object — served by the storage, never by the hub (§4). */
export function publicUrl(key: string): string {
	return `${(env.S3_PUBLIC_URL ?? '').replace(/\/+$/, '')}/${key}`;
}

/** A URL the browser PUTs one file to. Type and exact size are part of the signature: S3 refuses
 *  any other body, so the declared size checked against the quota is the size received. */
export function presignUpload(visibility: Visibility, key: string, contentType: string, contentLength: number) {
	const command = new PutObjectCommand({
		Bucket: bucketOf(visibility),
		Key: key,
		ContentType: contentType,
		ContentLength: contentLength
	});
	return getSignedUrl(s3, command, { expiresIn: 15 * 60 });
}

/** Short-lived link to read a (private) object; `downloadAs` forces a download with that name. */
export function presignDownload(visibility: Visibility, key: string, expiresIn = 300, downloadAs?: string) {
	const command = new GetObjectCommand({
		Bucket: bucketOf(visibility),
		Key: key,
		...(downloadAs
			? { ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(downloadAs)}` }
			: {})
	});
	return getSignedUrl(s3, command, { expiresIn });
}

/** Size and type of an object, or null when it does not exist. */
export async function headObject(visibility: Visibility, key: string) {
	try {
		const head = await s3.send(new HeadObjectCommand({ Bucket: bucketOf(visibility), Key: key }));
		return { bytes: head.ContentLength ?? 0, contentType: head.ContentType ?? '' };
	} catch (err) {
		if ((err as { name?: string }).name === 'NotFound') return null;
		throw err;
	}
}

export async function getObjectBytes(visibility: Visibility, key: string): Promise<Uint8Array> {
	const res = await s3.send(new GetObjectCommand({ Bucket: bucketOf(visibility), Key: key }));
	return res.Body!.transformToByteArray();
}

/** Store a processed version. Keys are never reused (they contain the file id), hence the year-long
 *  immutable cache: a client site can cache an image forever (§4). */
export async function putObject(visibility: Visibility, key: string, body: Uint8Array, contentType: string) {
	await s3.send(
		new PutObjectCommand({
			Bucket: bucketOf(visibility),
			Key: key,
			Body: body,
			ContentType: contentType,
			CacheControl: 'public, max-age=31536000, immutable'
		})
	);
}

/** Store a processed version from a local file, streamed (a transcoded video can weigh hundreds
 *  of MB: never loaded in memory). Same immutable cache as `putObject`. */
export async function putFile(visibility: Visibility, key: string, path: string, contentType: string) {
	const { size } = await stat(path);
	await s3.send(
		new PutObjectCommand({
			Bucket: bucketOf(visibility),
			Key: key,
			Body: createReadStream(path),
			ContentLength: size,
			ContentType: contentType,
			CacheControl: 'public, max-age=31536000, immutable'
		})
	);
}

/** Delete objects (missing ones are ignored), in batches of 1000 (the S3 limit). */
export async function deleteObjects(visibility: Visibility, keys: string[]): Promise<void> {
	for (let i = 0; i < keys.length; i += 1000) {
		const batch = keys.slice(i, i + 1000);
		if (!batch.length) continue;
		await s3.send(
			new DeleteObjectsCommand({
				Bucket: bucketOf(visibility),
				Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true }
			})
		);
	}
}
