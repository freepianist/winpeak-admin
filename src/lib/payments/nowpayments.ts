import { createHmac } from 'crypto';

const API_BASE = 'https://api.nowpayments.io/v1';

type JsonMap = Record<string, unknown>;

let cachedJwt: { token: string; exp: number } | null = null;

export function nowpaymentsApiKey() {
	return process.env.NOWPAYMENTS_API_KEY?.trim() || '';
}

export function isPayoutConfigured() {
	return Boolean(nowpaymentsApiKey() && process.env.NOWPAYMENTS_EMAIL?.trim() && process.env.NOWPAYMENTS_PASSWORD);
}

function playerSiteUrl() {
	return (process.env.WINPEAK_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '');
}

export function getIpnCallbackUrl() {
	const site = playerSiteUrl();
	if (!site) {
		throw new Error('WINPEAK_SITE_URL is required for crypto payouts');
	}
	return `${site}/api/payments/nowpayments/ipn`;
}

function apiError(payload: unknown, fallback: string) {
	if (payload && typeof payload === 'object') {
		const message = (payload as JsonMap).message || (payload as JsonMap).error || (payload as JsonMap).msg;
		if (typeof message === 'string' && message.trim()) return message;
	}
	return fallback;
}

async function npFetch<T>(path: string, init: RequestInit = {}, token?: string) {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		'x-api-key': nowpaymentsApiKey(),
		...(init.headers as Record<string, string> | undefined)
	};
	if (token) headers.Authorization = `Bearer ${token}`;

	const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
	const payload = (await response.json().catch(() => null)) as unknown;
	if (!response.ok) {
		throw new Error(apiError(payload, `NOWPayments request failed (${response.status})`));
	}
	return payload as T;
}

async function getJwt() {
	const email = process.env.NOWPAYMENTS_EMAIL?.trim();
	const password = process.env.NOWPAYMENTS_PASSWORD;
	if (!email || !password) {
		throw new Error('Payout credentials are not configured');
	}
	if (cachedJwt && cachedJwt.exp > Date.now()) {
		return cachedJwt.token;
	}
	const auth = await npFetch<{ token?: string }>('/auth', {
		method: 'POST',
		body: JSON.stringify({ email, password })
	});
	if (!auth.token) {
		throw new Error('Could not authenticate payouts');
	}
	cachedJwt = { token: auth.token, exp: Date.now() + 4 * 60 * 1000 };
	return auth.token;
}

function generateTotp(secret: string) {
	const key = decodeBase32(secret.replace(/\s/g, '').toUpperCase());
	const counter = Math.floor(Date.now() / 1000 / 30);
	const msg = Buffer.alloc(8);
	msg.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
	msg.writeUInt32BE(counter >>> 0, 4);
	const hmac = createHmac('sha1', key).update(msg).digest();
	const offset = hmac[hmac.length - 1] & 0xf;
	const code = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
	return String(code % 1_000_000).padStart(6, '0');
}

function decodeBase32(input: string) {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
	let bits = 0;
	let value = 0;
	const bytes: number[] = [];
	for (const char of input) {
		if (char === '=') break;
		const idx = alphabet.indexOf(char);
		if (idx < 0) continue;
		value = (value << 5) | idx;
		bits += 5;
		if (bits >= 8) {
			bytes.push((value >>> (bits - 8)) & 0xff);
			bits -= 8;
		}
	}
	return Buffer.from(bytes);
}

async function estimateCryptoAmount(amountUsd: number, currency: string) {
	const query = new URLSearchParams({
		amount: String(amountUsd),
		currency_from: 'usd',
		currency_to: currency
	});
	const estimate = await npFetch<{ estimated_amount?: number }>(`/estimate?${query.toString()}`);
	const amount = Number(estimate.estimated_amount);
	if (!Number.isFinite(amount) || amount <= 0) {
		throw new Error('Could not price this withdrawal in crypto');
	}
	return amount;
}

export async function createPayout(input: {
	amountUsd: number;
	address: string;
	currency: string;
	requestId: string;
}) {
	if (!isPayoutConfigured()) {
		throw new Error('Automatic crypto payouts are not configured');
	}

	const token = await getJwt();
	const currency = input.currency.toLowerCase();
	const cryptoAmount = await estimateCryptoAmount(input.amountUsd, currency);
	const ipn = getIpnCallbackUrl();
	const created = await npFetch<{ id?: string | number; status?: string; withdrawals?: JsonMap[] }>(
		'/payout',
		{
			method: 'POST',
			body: JSON.stringify({
				ipn_callback_url: ipn,
				withdrawals: [
					{
						address: input.address,
						currency,
						amount: cryptoAmount,
						fiat_amount: Number(input.amountUsd.toFixed(2)),
						fiat_currency: 'usd',
						ipn_callback_url: ipn,
						extra_id: input.requestId
					}
				]
			})
		},
		token
	);

	const payoutId = String(created.id || created.withdrawals?.[0]?.id || '');
	if (!payoutId) {
		throw new Error('Payout was not accepted');
	}

	const totpSecret = process.env.NOWPAYMENTS_2FA_SECRET?.replace(/\s/g, '');
	if (totpSecret) {
		await npFetch(
			`/payout/${payoutId}/verify`,
			{
				method: 'POST',
				body: JSON.stringify({ verification_code: generateTotp(totpSecret) })
			},
			token
		).catch(() => undefined);
	}

	return {
		id: payoutId,
		status: String(created.withdrawals?.[0]?.status || created.status || 'CREATING')
	};
}
