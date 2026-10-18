import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { ffmpegBin, probeDimensions, run } from './ffmpeg';

// Video processing (DECISIONS.md §5): every video is re-encoded to H.264 / AAC MP4 capped at 1080p
// — iPhone videos are HEVC, which most browsers cannot play, and raw phone videos are huge. Plus a
// WebP poster for the lists and the sites. Only these versions are kept.

/** ffmpeg threads: the VPS is shared with other apps, leave headroom for the web server. */
const THREADS = 2;

/** Fit a 16:9 box of 1920×1080 whatever the orientation (portrait phone videos stay portrait),
 *  never upscale; `force_divisible_by=2` keeps the size valid for H.264 / yuv420p. */
const SCALE_1080P =
	"scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2";

/**
 * The container of an upload, from its first bytes — never from its declared type nor its name.
 * ffmpeg guesses formats from the CONTENT: a « video » that is really an HLS playlist (a text file
 * listing URLs) would make the server fetch those URLs — internal services, the cloud metadata
 * address (SSRF). So only MP4 / MOV (`ftyp`… boxes) and WebM / Matroska (EBML header) are let
 * through, and that demuxer is then FORCED (`-f`), so no other one ever reads the file.
 */
const MOV_BOXES = ['ftyp', 'moov', 'mdat', 'free', 'wide', 'skip'];

async function sniffContainer(sourceUrl: string): Promise<'mov' | 'matroska'> {
	const res = await fetch(sourceUrl, { headers: { range: 'bytes=0-31' } });
	if (!res.ok) throw new Error(`cannot read the upload (${res.status})`);
	const head = new Uint8Array(await res.arrayBuffer()).subarray(0, 32);
	if (head.length >= 8 && MOV_BOXES.includes(String.fromCharCode(...head.subarray(4, 8)))) return 'mov';
	if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return 'matroska';
	throw new Error('not an MP4 / MOV / WebM video');
}

export type ProcessedVideo = {
	videoPath: string;
	videoBytes: number;
	posterPath: string;
	posterBytes: number;
	width: number | null;
	height: number | null;
};

/**
 * Transcode `sourceUrl` (ffmpeg reads the original straight from its signed link — no staging of a
 * large file on the VPS disk) into `dir`, then extract the poster from the local result.
 */
export async function processVideo(sourceUrl: string, dir: string): Promise<ProcessedVideo> {
	const videoPath = join(dir, 'video.mp4');
	const container = await sniffContainer(sourceUrl);
	// Only the protocol of the signed link itself (https in production, http for MinIO in dev).
	const protocols = sourceUrl.startsWith('https:') ? 'https,tls,tcp' : 'http,tcp';
	await run(
		ffmpegBin(),
		[
			'-y',
			'-protocol_whitelist', protocols,
			'-f', container,
			'-i', sourceUrl,
			'-vf', SCALE_1080P,
			'-c:v', 'libx264',
			'-preset', 'medium',
			'-crf', '23',
			'-pix_fmt', 'yuv420p',
			'-c:a', 'aac',
			'-b:a', '128k',
			// Index at the front: a browser starts playing before the whole file is downloaded.
			'-movflags', '+faststart',
			'-threads', String(THREADS),
			videoPath
		],
		true
	);
	const videoBytes = (await stat(videoPath)).size;
	if (!videoBytes) throw new Error('ffmpeg produced an empty video');

	const posterPath = join(dir, 'poster.webp');
	await run(
		ffmpegBin(),
		[
			'-y',
			// ~1 s in, to avoid a black first frame (a shorter video falls back to its first frame).
			'-ss', '1',
			'-i', videoPath,
			'-frames:v', '1',
			'-vf', "scale='min(1280,iw)':-2",
			'-c:v', 'libwebp',
			'-quality', '80',
			posterPath
		],
		true
	).catch(() =>
		run(ffmpegBin(), ['-y', '-i', videoPath, '-frames:v', '1', '-vf', "scale='min(1280,iw)':-2", '-c:v', 'libwebp', posterPath], true)
	);
	const posterBytes = (await stat(posterPath)).size;

	const dims = await probeDimensions(videoPath);
	return { videoPath, videoBytes, posterPath, posterBytes, width: dims?.width ?? null, height: dims?.height ?? null };
}
