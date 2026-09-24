import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * Game agent secrets at rest. Identical to winpeak lib/games/agent-secrets.ts,
 * which reads what this writes, so a change here has to land there too.
 */

const PREFIX = 'v1';

function key() {
	const secret = process.env.GAME_AGENT_SECRET_KEY || '';

	if (secret.length < 16) {
		throw new Error('GAME_AGENT_SECRET_KEY must be set to a long random string');
	}

	return createHash('sha256').update(secret).digest();
}

export function isAgentSecretKeyConfigured() {
	return (process.env.GAME_AGENT_SECRET_KEY || '').length >= 16;
}

export function encryptAgentSecret(plain: string) {
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', key(), iv);
	const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
	return [PREFIX, iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

export function decryptAgentSecret(stored: string | null | undefined) {
	if (!stored) return '';

	const [prefix, iv, tag, data] = stored.split(':');

	if (prefix !== PREFIX || !iv || !tag || !data) {
		throw new Error('Unreadable game agent secret');
	}

	const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
	decipher.setAuthTag(Buffer.from(tag, 'base64'));
	return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}
