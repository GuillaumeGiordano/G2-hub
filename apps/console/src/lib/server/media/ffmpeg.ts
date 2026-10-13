import { spawn } from 'node:child_process';
import { env } from '$env/dynamic/private';

// Thin wrapper around the system ffmpeg / ffprobe (installed on the VPS like for ShareMoment; path
// overridable from .env). Runs in the background worker only — never inside an HTTP request.

/** Kill a run that takes longer than this: guards against a stuck ffmpeg. */
const TIMEOUT_MS = 30 * 60_000;

export const ffmpegBin = () => env.FFMPEG_PATH || 'ffmpeg';
export const ffprobeBin = () => env.FFPROBE_PATH || 'ffprobe';

/** On the VPS, CPU-heavy work runs under `nice` so it never starves the web server (`nice` is a
 *  Unix tool: on a Windows dev machine the binary is spawned directly). */
function niced(bin: string, args: string[]): [string, string[]] {
	return process.platform === 'linux' ? ['nice', ['-n', '19', bin, ...args]] : [bin, args];
}

/** Run a binary; resolves with its stdout, rejects with the tail of its stderr. */
export function run(bin: string, args: string[], lowPriority = false): Promise<string> {
	return new Promise((resolve, reject) => {
		const [cmd, cmdArgs] = lowPriority ? niced(bin, args) : [bin, args];
		const child = spawn(cmd, cmdArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
		let out = '';
		let err = '';
		const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT_MS);
		child.stdout.on('data', (c: Buffer) => (out += c.toString()));
		child.stderr.on('data', (c: Buffer) => (err = (err + c.toString()).slice(-2000)));
		child.on('error', (e) => {
			clearTimeout(timer);
			reject(e);
		});
		child.on('close', (code) => {
			clearTimeout(timer);
			if (code === 0) resolve(out);
			else reject(new Error(`${bin} exited ${code}: ${err.trim()}`));
		});
	});
}

/** Width × height of a video's first stream, or null. */
export async function probeDimensions(path: string): Promise<{ width: number; height: number } | null> {
	try {
		const out = await run(ffprobeBin(), [
			'-v', 'error',
			'-select_streams', 'v:0',
			'-show_entries', 'stream=width,height',
			'-of', 'csv=p=0',
			path
		]);
		const [width, height] = out.trim().split(',').map(Number);
		return width > 0 && height > 0 ? { width, height } : null;
	} catch {
		return null;
	}
}
