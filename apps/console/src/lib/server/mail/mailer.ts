import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '$env/dynamic/private';
import { HubError } from '$lib/server/errors';

// Outgoing e-mail (infra). One SMTP server from .env: Mailpit in dev (catches everything), an
// Infomaniak mailbox in prod. The code is identical in both — only the .env differs.

export type Mail = { to: string; subject: string; text: string; html: string };

let transporter: Transporter | null = null;

function transport(): Transporter {
	if (!env.SMTP_HOST) {
		throw new HubError("L'envoi d'e-mails n'est pas configuré sur cette instance (SMTP_HOST).");
	}
	transporter ??= nodemailer.createTransport({
		host: env.SMTP_HOST,
		port: Number(env.SMTP_PORT) || 587,
		secure: env.SMTP_SECURE === 'true',
		auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined
	});
	return transporter;
}

export async function sendMail(mail: Mail): Promise<void> {
	const t = transport();
	try {
		await t.sendMail({ from: env.MAIL_FROM || 'G2 Hub <no-reply@localhost>', ...mail });
	} catch (err) {
		console.error('[mail] sending failed', err);
		throw new HubError("L'e-mail n'a pas pu être envoyé. Réessayez dans quelques instants.");
	}
}
