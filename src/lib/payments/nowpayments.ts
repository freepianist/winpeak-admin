import { createHmac } from 'crypto';
import { ProxyAgent, fetch as proxiedFetch } from 'undici';

const API_BASE = 'https://api.nowpayments.io/v1';

export type JsonMap = Record<string, unknown>;

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

/**
 * NOWPayments ties its IP whitelist to the API key, so every call has to leave
 * from one address. Serverless hosts have no stable egress IP, so a static-IP
 * proxy stands in for one when NOWPAYMENTS_PROXY_URL is set.
 *
 * undici's `fetch` is used directly rather than the global one: Next.js wraps
 * `fetch` for caching and can rebuild the request, which would drop the
 * dispatcher and quietly send the call from the wrong IP.
 */
let proxyAgent: ProxyAgent | null | undefined;

function proxyDispatcher() {
	if (proxyAgent === undefined) {
		const url = process.env.NOWPAYMENTS_PROXY_URL?.trim();
		proxyAgent = url ? new ProxyAgent(url) : null;
	}
	return proxyAgent;
}

export async function npFetch<T>(path: string, init: RequestInit = {}, token?: string) {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		'x-api-key': nowpaymentsApiKey(),
		...(init.headers as Record<string, string> | undefined)
	};
	if (token) headers.Authorization = `Bearer ${token}`;

	const dispatcher = proxyDispatcher();
	const response = dispatcher
		? await proxiedFetch(`${API_BASE}${path}`, {
				method: init.method,
				body: init.body as string | undefined,
				headers,
				dispatcher
			})
		: await fetch(`${API_BASE}${path}`, { ...init, headers });
	const payload = (await response.json().catch(() => null)) as unknown;
	if (!response.ok) {
		throw new Error(apiError(payload, `NOWPayments request failed (${response.status})`));
	}
	return payload as T;
}

export async function getJwt() {
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

export async function estimateCryptoAmount(amountUsd: number, currency: string) {
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
	// Sent as the crypto `amount` only. Passing `fiat_amount` alongside it makes
	// NOWPayments ignore `amount` entirely and re-derive the payout from fiat,
	// which would no longer match the amount the treasury conversion produced.
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
						ipn_callback_url: ipn,
						// Never send extra_id here. NOWPayments matches whitelisted
						// payout addresses on (currency, address, extra_id), so any
						// value makes even a whitelisted address fail with
						// "address is not whitelisted". It is a memo/tag field for
						// chains like XRP, not a place for our own reference.
						unique_external_id: input.requestId
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
