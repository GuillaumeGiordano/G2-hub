<script lang="ts">
	import { Alert, CopyButton, Modal } from '@guillaumeg/ui';

	// Shows, ONCE, the temporary password of an account just created by an operator (no SMTP yet):
	// it is not stored in clear anywhere and cannot be displayed again.
	let { id, email, password }: { id: string; email: string; password: string } = $props();
</script>

<Modal {id} title="Compte créé">
	<div class="body">
		<Alert variant="warning" title="À transmettre maintenant">
			Ce mot de passe ne sera plus jamais affiché. Transmettez-le à la personne : elle le changera
			dans « Sécurité » après sa première connexion.
		</Alert>
		<dl>
			<dt>Identifiant</dt>
			<dd>{email}</dd>
			<dt>Mot de passe temporaire</dt>
			<dd class="password">
				<code>{password}</code>
				<CopyButton text={password} />
			</dd>
		</dl>
	</div>
</Modal>

<style>
	.body {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	dl {
		display: grid;
		gap: 4px;
		margin: 0;
	}
	dt {
		font-size: 12px;
		color: var(--text-subtle);
	}
	dd {
		margin: 0 0 8px;
		color: var(--text-heading);
	}
	.password {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	code {
		font-family: var(--font-mono, monospace);
		font-size: 16px;
		letter-spacing: 0.04em;
	}
</style>
