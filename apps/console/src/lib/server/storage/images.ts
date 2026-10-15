import sharp from 'sharp';

// Image processing (DECISIONS.md §5): only processed versions are kept — WebP at a few widths for
// fast client sites. `rotate()` applies the EXIF orientation, and sharp drops every metadata (GPS
// included) unless asked to keep it. A version is never upscaled.

export const IMAGE_WIDTHS = { thumb: 400, medium: 1200, large: 2560 } as const;
export type ImageVariantName = keyof typeof IMAGE_WIDTHS;

export type ProcessedImage = {
	name: ImageVariantName;
	body: Uint8Array;
	width: number;
	height: number;
};

export async function processImage(input: Uint8Array): Promise<ProcessedImage[]> {
	// `animated`: an animated GIF / WebP stays animated.
	const source = sharp(input, { animated: true, failOn: 'error' });
	const meta = await source.metadata();
	if (!meta.width || !meta.height) throw new Error('Image illisible.');

	const out: ProcessedImage[] = [];
	for (const [name, width] of Object.entries(IMAGE_WIDTHS) as [ImageVariantName, number][]) {
		const { data, info } = await source
			.clone()
			.rotate()
			.resize({ width, withoutEnlargement: true })
			.webp({ quality: 80, effort: 4 })
			.toBuffer({ resolveWithObject: true });
		out.push({ name, body: new Uint8Array(data), width: info.width, height: info.height });
	}
	return out;
}

/** An organization's logo: fits in 512 × 512, never upscaled, transparent background kept. */
export async function processLogo(input: Uint8Array): Promise<Uint8Array> {
	const data = await sharp(input, { failOn: 'error' })
		.rotate()
		.resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
		.webp({ quality: 85 })
		.toBuffer();
	return new Uint8Array(data);
}
