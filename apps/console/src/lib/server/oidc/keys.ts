import { calculateJwkThumbprint, exportJWK, exportPKCS8, generateKeyPair, importPKCS8, type JWK } from 'jose';
import * as oidcRepo from '$lib/server/repositories/oidcRepository';

// The key pair that signs the ID tokens (RS256 — an asymmetric signature: the hub signs with the
// PRIVATE key, portals verify with the PUBLIC key published at /oauth/jwks, so a portal can check a
// token without being able to forge one). Generated at first use and kept in the database: nothing
// to configure per instance. The oldest key signs; all of them are published (room for a rotation).

const ALG = 'RS256';

type SigningKey = { kid: string; privateKey: CryptoKey; jwks: JWK[] };

let cached: Promise<SigningKey> | null = null;

async function loadOrCreate(): Promise<SigningKey> {
	let rows = await oidcRepo.findSigningKeys();
	if (rows.length === 0) {
		const { publicKey, privateKey } = await generateKeyPair(ALG, { extractable: true, modulusLength: 2048 });
		const jwk = await exportJWK(publicKey);
		const kid = await calculateJwkThumbprint(jwk);
		await oidcRepo.insertSigningKey({
			kid,
			publicJwk: { ...jwk, kid, alg: ALG, use: 'sig' },
			privateKeyPem: await exportPKCS8(privateKey)
		});
		rows = await oidcRepo.findSigningKeys();
	}
	const active = rows[0];
	return {
		kid: active.kid,
		privateKey: await importPKCS8(active.privateKeyPem, ALG),
		jwks: rows.map((r) => r.publicJwk as JWK)
	};
}

/** The active signing key (loaded once per process). */
export function signingKey(): Promise<SigningKey> {
	cached ??= loadOrCreate().catch((err) => {
		cached = null; // retry on the next request
		throw err;
	});
	return cached;
}

export const SIGNING_ALG = ALG;
