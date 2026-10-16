// A short, human description of a browser's User-Agent ("Chrome · Windows"). Approximate on
// purpose: it only helps an Admin recognize a device in the sign-in log.

const BROWSERS: [RegExp, string][] = [
	[/Edg\//, 'Edge'],
	[/OPR\/|Opera/, 'Opera'],
	[/SamsungBrowser\//, 'Samsung Internet'],
	[/Firefox\//, 'Firefox'],
	[/Chrome\//, 'Chrome'],
	[/Safari\//, 'Safari']
];

const SYSTEMS: [RegExp, string][] = [
	[/Windows/, 'Windows'],
	[/Android/, 'Android'],
	[/iPhone|iPad|iPod/, 'iOS'],
	[/Mac OS X|Macintosh/, 'macOS'],
	[/Linux/, 'Linux']
];

export function describeUserAgent(userAgent: string | null): string | null {
	if (!userAgent) return null;
	const browser = BROWSERS.find(([re]) => re.test(userAgent))?.[1];
	const system = SYSTEMS.find(([re]) => re.test(userAgent))?.[1];
	return [browser, system].filter(Boolean).join(' · ') || 'Autre';
}
