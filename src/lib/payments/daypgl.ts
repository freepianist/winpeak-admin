import { createHash, randomBytes } from 'crypto';
import { ProxyAgent, fetch as proxiedFetch } from 'undici';

/**
 * DAYPGL, the local-currency rail. A trimmed copy of the player site's client:
 * admin only sends payouts staff approve, queries orders, and reads balances.
 * Callbacks always go to the player site, which is where they are verified.
 *
 * `out_trade_no` is always the wallet request id, so a payout DAYPGL already
 * has can never be opened a second time.
 */

type Params = Record<string, string>;

type Envelope<T> = {
	code?: number | string;
	msg?: string;
	data?: T;
};

const REQUEST_TIMEOUT_MS = 20_000;

function gatewayUrl() {
	return (process.env.DAYPGL_GATEWAY_URL || '').trim().replace(/\/+$/, '');
}

function merchantId() {
	return (process.env.DAYPGL_MERCHANT_ID || '').trim();
}

function secretKey() {
	return (process.env.DAYPGL_SECRET_KEY || '').trim();
}

function playerSiteUrl() {
	return (process.env.WINPEAK_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '');
}

export function isDaypglConfigured() {
	return Boolean(gatewayUrl() && merchantId() && secretKey());
}

export function getPayinCallbackUrl() {
	return `${playerSiteUrl()}/api/payments/daypgl/payin`;
}

export function getPayoutCallbackUrl() {
	const site = playerSiteUrl();

	if (!site) {
		throw new Error('WINPEAK_SITE_URL is required for local payouts');
	}

	return `${site}/api/payments/daypgl/payout`;
}

export class DaypglError extends Error {
	readonly status: number;

	constructor(message: string, status: number) {
		super(message);
		this.name = 'DaypglError';
		this.status = status;
	}
}

/** No usable answer came back, so the order may or may not exist. */
export class DaypglNoAnswerError extends Error {
	readonly cause?: unknown;

	constructor(message: string, options?: { cause?: unknown }) {
		super(message);
		this.name = 'DaypglNoAnswerError';
		this.cause = options?.cause;
	}
}

/** Non-empty params except sign and ext_info, sorted, `&key=<secret>`, MD5, upper case. */
export function daypglSign(params: Params, secret = secretKey()) {
	const base = Object.keys(params)
		.filter((key) => key !== 'sign' && key !== 'ext_info' && params[key] !== '')
		.sort()
		.map((key) => `${key}=${params[key]}`)
		.join('&');
	return createHash('md5').update(`${base}&key=${secret}`, 'utf8').digest('hex').toUpperCase();
}

let proxyAgent: ProxyAgent | null | undefined;

function proxyDispatcher() {
	if (proxyAgent === undefined) {
		const url = process.env.DAYPGL_PROXY_URL?.trim();
		proxyAgent = url ? new ProxyAgent(url) : null;
	}

	return proxyAgent;
}

async function dayCall<T>(path: string, params: Params) {
	if (!isDaypglConfigured()) {
		throw new Error('DAYPGL is not configured in admin. Add the gateway URL, merchant id and secret key.');
	}

	const signed: Params = {
		...params,
		merchant_id: merchantId(),
		timestamp: String(Math.floor(Date.now() / 1000)),
		nonce: randomBytes(10).toString('hex')
	};
	signed.sign = daypglSign(signed);

	const url = `${gatewayUrl()}${path}`;
	const body = new URLSearchParams(signed).toString();
	const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
	const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);

	let status: number;
	let text: string;
	try {
		const dispatcher = proxyDispatcher();
		const response = dispatcher
			? await proxiedFetch(url, { method: 'POST', body, headers, dispatcher, signal })
			: await fetch(url, { method: 'POST', body, headers, signal, cache: 'no-store' });
		status = response.status;
		text = await response.text();
	} catch (error) {
		throw new DaypglNoAnswerError(`DAYPGL ${path} did not answer`, { cause: error });
	}

	let payload: Envelope<T> | null = null;
	try {
		payload = JSON.parse(text) as Envelope<T>;
	} catch {
		payload = null;
	}

	if (!payload || payload.code === undefined || payload.code === null) {
		if (status >= 400 && status !== 408 && status < 500) {
			throw new DaypglError(`DAYPGL ${path} failed (${status})`, status);
		}

		throw new DaypglNoAnswerError(`DAYPGL ${path} returned no status (${status})`);
	}

	const code = Number(payload.code);

	if (code !== 200) {
		const message =
			typeof payload.msg === 'string' && payload.msg.trim()
				? payload.msg.trim()
				: `DAYPGL ${path} failed (${code})`;
		throw new DaypglError(message, Number.isFinite(code) ? code : status);
	}

	return (payload.data ?? {}) as T;
}

function asText(value: unknown) {
	if (value === null || value === undefined) return '';

	return String(value);
}

function asNumber(value: unknown) {
	const amount = Number(value);
	return Number.isFinite(amount) ? amount : 0;
}

export type DaypglStatus = 'pending' | 'success' | 'failed';

export function payinStatus(value: unknown): DaypglStatus {
	const raw = asText(value).trim().toLowerCase();

	if (raw === '3' || raw === 'success') return 'success';

	if (raw === '4' || raw === '5' || raw === 'failed' || raw === 'expired') return 'failed';

	return 'pending';
}

/** Numeric on callbacks (2 success, 3-5 failed), a Chinese word on queries. */
export function payoutStatus(value: unknown): DaypglStatus {
	const raw = asText(value).trim().toLowerCase();

	if (raw === '2' || raw === 'success' || raw.includes('成功')) return 'success';

	if (raw === '3' || raw === '4' || raw === '5' || raw === 'failed' || raw.includes('失败')) return 'failed';

	return 'pending';
}

/** Whole units for currencies without a minor unit, two decimals otherwise. */
const ZERO_DECIMAL = new Set([
	'BIF',
	'CLP',
	'COP',
	'IDR',
	'ISK',
	'JPY',
	'KRW',
	'MMK',
	'PYG',
	'UGX',
	'VND',
	'XAF',
	'XOF'
]);

export function formatLocalAmount(amount: number, currency: string) {
	return amount.toFixed(ZERO_DECIMAL.has(currency.toUpperCase()) ? 0 : 2);
}

export async function createPayout(input: {
	requestId: string;
	country: string;
	bankCode: string;
	localAmount: string;
	payeeName: string;
	payeeAccount: string;
	userId: string;
}) {
	const data = await dayCall<Record<string, unknown>>('/payout/create', {
		country: input.country,
		out_trade_no: input.requestId,
		amount: input.localAmount,
		bank_code: input.bankCode,
		payee_name: input.payeeName,
		payee_account: input.payeeAccount,
		notify_url: getPayoutCallbackUrl(),
		vip_id: input.userId.slice(0, 64)
	});
	return {
		tradeNo: asText(data.trade_no),
		status: payoutStatus(data.status),
		rawStatus: asText(data.status)
	};
}

export async function queryPayin(country: string, requestId: string) {
	const data = await dayCall<Record<string, unknown>>('/payin/query', { country, out_trade_no: requestId });
	return {
		tradeNo: asText(data.trade_no),
		status: payinStatus(data.status),
		rawStatus: asText(data.status),
		actualAmount: asNumber(data.actual_amount)
	};
}

export async function queryPayout(country: string, requestId: string) {
	const data = await dayCall<Record<string, unknown>>('/payout/query', { country, out_trade_no: requestId });
	return {
		tradeNo: asText(data.trade_no),
		status: payoutStatus(data.status),
		rawStatus: asText(data.status),
		actualAmount: asNumber(data.actual_amount),
		failReason: asText(data.fail_reason)
	};
}

export async function getMerchantBalance(country: string) {
	const data = await dayCall<Record<string, unknown>>('/payout/balance', { country });
	return {
		available: asNumber(data.balance),
		frozen: asNumber(data.frozen ?? data.frozen_balance),
		currency: asText(data.currency)
	};
}
