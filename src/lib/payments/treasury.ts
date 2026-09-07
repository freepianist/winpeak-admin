import { getJwt, npFetch, type JsonMap } from '@/lib/payments/nowpayments';

/**
 * Treasury helpers mirroring the player site. The casino holds a single
 * settlement coin, so approving a payout to another network needs a Custody
 * conversion first: NOWPayments offers payout auto-conversion only in its
 * dashboard, never over the API.
 */

const SUPPORTED = ['usdttrc20', 'usdterc20', 'btc', 'eth', 'ltc'] as const;

export function getSettlementCurrency() {
	const raw = (process.env.NOWPAYMENTS_SETTLEMENT_CURRENCY || '').trim().toLowerCase();
	return (SUPPORTED as readonly string[]).includes(raw) ? raw : 'usdttrc20';
}

export function getConversionBufferPct() {
	const raw = Number(process.env.WITHDRAW_CONVERSION_BUFFER_PCT);
	return Number.isFinite(raw) && raw > 0 ? raw : 2;
}

function asNumber(value: unknown) {
	const amount = Number(value);
	return Number.isFinite(amount) ? amount : 0;
}

export async function getAvailableBalance(currency: string) {
	const raw = await npFetch<JsonMap>('/balance');
	const entry = (raw?.[currency.toLowerCase()] || {}) as JsonMap;
	return asNumber(entry.amount);
}

export async function payoutFee(currency: string, amount: number) {
	const query = new URLSearchParams({ currency: currency.toLowerCase(), amount: String(amount) });
	try {
		const result = await npFetch<{ fee?: number }>(`/payout/fee?${query.toString()}`);
		return asNumber(result.fee);
	} catch {
		return 0;
	}
}

export async function minConversionAmount(from: string, to: string) {
	const query = new URLSearchParams({
		currency_from: from.toLowerCase(),
		currency_to: to.toLowerCase()
	});
	try {
		const result = await npFetch<{ min_amount?: number }>(`/min-amount?${query.toString()}`);
		return asNumber(result.min_amount);
	} catch {
		return 0;
	}
}

export async function createConversion(from: string, to: string, amount: number) {
	const token = await getJwt();
	const created = await npFetch<{ id?: string | number; status?: string; result?: JsonMap }>(
		'/conversion',
		{
			method: 'POST',
			body: JSON.stringify({
				from_currency: from.toLowerCase(),
				to_currency: to.toLowerCase(),
				amount: String(amount)
			})
		},
		token
	);

	const nested = (created.result || {}) as JsonMap;
	const id = String(created.id || nested.id || '');
	if (!id) {
		throw new Error('Conversion was not accepted');
	}
	return { id, status: String(created.status || nested.status || 'CREATED').toUpperCase() };
}

/**
 * Reads one conversion. Fetched by path because the documented `?id=` filter on
 * the list endpoint responds 500; the list is used only as a fallback.
 */
export async function getConversion(id: string) {
	const token = await getJwt();

	try {
		const single = await npFetch<{ result?: JsonMap }>(`/conversion/${encodeURIComponent(id)}`, {}, token);
		const match = (single.result || single) as JsonMap;
		if (match?.id) {
			return { id: String(match.id), status: String(match.status || '').toUpperCase() };
		}
	} catch (error) {
		console.warn(`Reading conversion ${id} by path failed, falling back to the list`, error);
	}

	const list = await npFetch<{ result?: JsonMap[]; data?: JsonMap[] }>('/conversion?limit=50&order=DESC', {}, token);
	const rows = list.result || list.data || [];
	const match = Array.isArray(rows) ? rows.find((row) => String(row.id) === id) : undefined;
	return match ? { id: String(match.id), status: String(match.status || '').toUpperCase() } : null;
}

export function isConversionSettled(status: string) {
	return status.toUpperCase() === 'FINISHED';
}

export function isConversionFailed(status: string) {
	return ['REJECTED', 'FAILED', 'EXPIRED', 'CANCELLED'].includes(status.toUpperCase());
}

export type PayoutSnapshot = {
	id: string;
	status: string;
	hash: string;
	amount: string;
	currency: string;
	error: string;
};

/**
 * Reads a payout straight from NOWPayments. Accepts either the batch id or the
 * individual withdrawal id, since both resolve here and `providerRef` may hold
 * either depending on what /payout echoed back at submission.
 */
export async function getPayout(id: string): Promise<PayoutSnapshot | null> {
	const token = await getJwt();
	const raw = await npFetch<JsonMap>(`/payout/${encodeURIComponent(id)}`, {}, token);
	if (!raw) return null;

	// The batch wrapper is returned even when querying a single withdrawal.
	const nested = Array.isArray(raw.withdrawals) ? (raw.withdrawals as JsonMap[]) : [];
	const row = nested.find((item) => String(item.id) === id) || nested[0] || raw;

	const status = String(row.status || raw.status || '').toUpperCase();
	if (!status) return null;

	return {
		id: String(row.id || raw.id || id),
		status,
		hash: String(row.hash || ''),
		amount: String(row.amount || ''),
		currency: String(row.currency || '').toLowerCase(),
		error: String(row.error || '')
	};
}

export function isPayoutSettled(status: string) {
	return status.toUpperCase() === 'FINISHED';
}

export function isPayoutFailed(status: string) {
	return ['REJECTED', 'FAILED', 'EXPIRED', 'CANCELLED'].includes(status.toUpperCase());
}

/**
 * A payout NOWPayments accepted but never released because payout 2FA is on and
 * nothing verified it. It will sit here forever, so staff need to see it rather
 * than wait.
 */
export function isPayoutUnverified(status: string) {
	return status.toUpperCase() === 'CREATING';
}
