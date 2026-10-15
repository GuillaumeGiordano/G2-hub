// French company identifiers — pure helpers, shared by the browser and the server.
// SIRET = SIREN (9 digits, the company) + NIC (5 digits, the establishment). Both end with a Luhn
// check digit, except La Poste's establishments (SIREN 356000000), whose SIRET digits sum to a
// multiple of 5.

const LA_POSTE_SIREN = '356000000';

/** Digits only (spaces and dots typed by people are dropped). */
export const digitsOnly = (value: string) => value.replace(/[\s.]/g, '');

/** Luhn checksum: every second digit from the right is doubled. */
function luhnValid(digits: string): boolean {
	let sum = 0;
	for (let i = 0; i < digits.length; i++) {
		let d = Number(digits[digits.length - 1 - i]);
		if (i % 2 === 1) {
			d *= 2;
			if (d > 9) d -= 9;
		}
		sum += d;
	}
	return sum % 10 === 0;
}

export function isValidSiret(value: string): boolean {
	const siret = digitsOnly(value);
	if (!/^\d{14}$/.test(siret)) return false;
	if (siret.startsWith(LA_POSTE_SIREN)) {
		return [...siret].reduce((sum, d) => sum + Number(d), 0) % 5 === 0;
	}
	return luhnValid(siret);
}

/** The SIREN (company) of a SIRET: its first 9 digits. */
export const sirenOf = (siret: string) => digitsOnly(siret).slice(0, 9);

/** The French intra-EU VAT number of a SIREN: FR + key + SIREN, key = (12 + 3 × (SIREN mod 97)) mod 97. */
export function frenchVatOf(siren: string): string {
	const key = (12 + 3 * (Number(siren) % 97)) % 97;
	return `FR${String(key).padStart(2, '0')}${siren}`;
}

/** Upper-case, no spaces: « fr 12 345… » → « FR12345… ». */
export const normalizeVat = (value: string) => value.replace(/[\s.-]/g, '').toUpperCase();

/** A plausible intra-EU VAT number: 2-letter country code + 2 to 12 characters. A French one must
 *  carry the right key for its SIREN. */
export function isValidVat(value: string): boolean {
	const vat = normalizeVat(value);
	if (!/^[A-Z]{2}[0-9A-Z]{2,12}$/.test(vat)) return false;
	if (vat.startsWith('FR')) {
		const siren = vat.slice(4);
		return /^\d{9}$/.test(siren) && frenchVatOf(siren) === vat;
	}
	return true;
}

/** NAF / APE code: « 6201Z » or « 62.01Z » → « 62.01Z ». */
export function normalizeNaf(value: string): string | null {
	const m = value.replace(/\s/g, '').toUpperCase().match(/^(\d{2})\.?(\d{2})([A-Z])$/);
	return m ? `${m[1]}.${m[2]}${m[3]}` : null;
}
