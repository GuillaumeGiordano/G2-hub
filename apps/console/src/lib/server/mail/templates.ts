import type { Mail } from './mailer';

// The e-mails sent to application users. Plain text + a minimal HTML version (inline styles: mail
// clients ignore style sheets). Every inserted value is escaped — an application name is typed by
// a client.

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function layout(paragraphs: string[], action: { label: string; url: string }, footer: string): string {
	const p = paragraphs.map((t) => `<p style="margin:0 0 14px">${escapeHtml(t)}</p>`).join('');
	return `<!doctype html><html lang="fr"><body style="margin:0;padding:24px;background:#f4f5f7;font-family:Arial,sans-serif;color:#1f2937;font-size:15px;line-height:1.5">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:10px;padding:28px">
${p}
<p style="margin:22px 0"><a href="${escapeHtml(action.url)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:bold">${escapeHtml(action.label)}</a></p>
<p style="margin:0;font-size:13px;color:#6b7280">${escapeHtml(footer)}</p>
</div></body></html>`;
}

type Context = { to: string; name: string; applicationName: string; link: string };

export function invitationMail(c: Context & { validDays: number }): Mail {
	const intro = `Bonjour ${c.name},`;
	const body = `Vous êtes invité(e) à rejoindre « ${c.applicationName} ». Choisissez votre mot de passe pour activer votre compte.`;
	const footer = `Ce lien est valable ${c.validDays} jours et ne sert qu'une fois. Si vous n'attendiez pas cette invitation, ignorez cet e-mail.`;
	return {
		to: c.to,
		subject: `Invitation à rejoindre ${c.applicationName}`,
		text: `${intro}\n\n${body}\n\n${c.link}\n\n${footer}\n`,
		html: layout([intro, body], { label: 'Activer mon compte', url: c.link }, footer)
	};
}

export function passwordResetMail(c: Context & { validMinutes: number }): Mail {
	const intro = `Bonjour ${c.name},`;
	const body = `Vous avez demandé à changer votre mot de passe pour « ${c.applicationName} ».`;
	const footer = `Ce lien est valable ${c.validMinutes} minutes et ne sert qu'une fois. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé.`;
	return {
		to: c.to,
		subject: `Nouveau mot de passe — ${c.applicationName}`,
		text: `${intro}\n\n${body}\n\n${c.link}\n\n${footer}\n`,
		html: layout([intro, body], { label: 'Choisir un nouveau mot de passe', url: c.link }, footer)
	};
}
