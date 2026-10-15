// « à l'instant », « il y a 10 heures », « hier »… — for the activity columns.
const rtf = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	['year', 365 * 24 * 3600],
	['month', 30 * 24 * 3600],
	['day', 24 * 3600],
	['hour', 3600],
	['minute', 60]
];

/** How long ago `date` was, in words. */
export function timeAgo(date: Date, now = new Date()): string {
	const seconds = (date.getTime() - now.getTime()) / 1000;
	for (const [unit, size] of UNITS) {
		if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
	}
	return "à l'instant";
}
