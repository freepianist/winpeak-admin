import { prisma } from '@/lib/db';
import { badRequest, requireAdmin, unauthorized } from '@/lib/admin-auth';
import { invalidatePricingCache } from '@/lib/pricing';
import {
	getMerchantBalance,
	getPayinCallbackUrl,
	getPayoutCallbackUrl,
	isDaypglConfigured
} from '@/lib/payments/daypgl';

type ChannelInput = {
	kind?: string;
	code?: string;
	label?: string;
	enabled?: boolean;
};

type CountryInput = {
	country?: string;
	currency?: string;
	fxRate?: number;
	depositSpreadPct?: number;
	withdrawSpreadPct?: number;
	minDepositUsd?: number;
	minWithdrawUsd?: number;
	enabled?: boolean;
	scorpioAgentId?: string | null;
	oroplayAgentId?: string | null;
	channels?: ChannelInput[];
};

/** Same ceiling as the manual-rail floors: anything above is a typo, not a policy. */
const MAX_MIN_USD = 100_000;
/** A spread past this is almost certainly a rate typed into the wrong box. */
const MAX_SPREAD_PCT = 20;

function payoutCallbackUrl() {
	try {
		return getPayoutCallbackUrl();
	} catch {
		return '';
	}
}

/** The player site's origin without `www`; a country's market is its `<code>.` subdomain. */
function siteOrigin() {
	try {
		const url = new URL(getPayinCallbackUrl());
		return `${url.protocol}//${url.host.replace(/^www\./, '')}`;
	} catch {
		return '';
	}
}

/** Accounts opened on each market. Their wallets hold its currency, so it cannot change under them. */
async function boundUserCounts() {
	const groups = await prisma.user.groupBy({
		by: ['market'],
		where: { market: { not: null } },
		_count: { _all: true }
	});
	return new Map(groups.map((group) => [group.market as string, group._count._all]));
}

async function readSettings() {
	const rows = await prisma.localPaymentCountry.findMany({
		include: { channels: { orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] } },
		orderBy: { country: 'asc' }
	});
	const bound = await boundUserCounts();
	const configured = isDaypglConfigured();

	// Balances are read live so staff can see a country is about to run dry
	// before a payout parks on it. One slow country must not blank the page.
	const balances = await Promise.all(
		rows.map(async (row) => {
			if (!configured || !row.enabled) return { balance: null, balanceError: '' };

			try {
				return { balance: await getMerchantBalance(row.country), balanceError: '' };
			} catch (error) {
				return {
					balance: null,
					balanceError: error instanceof Error ? error.message : 'Could not read balance'
				};
			}
		})
	);

	return {
		configured,
		siteOrigin: siteOrigin(),
		payinCallbackUrl: getPayinCallbackUrl(),
		payoutCallbackUrl: payoutCallbackUrl(),
		countries: rows.map((row, index) => ({
			country: row.country,
			currency: row.currency,
			fxRate: Number(row.fxRate),
			depositSpreadPct: row.depositSpreadPct,
			withdrawSpreadPct: row.withdrawSpreadPct,
			minDepositUsd: row.minDepositUsd,
			minWithdrawUsd: row.minWithdrawUsd,
			enabled: row.enabled,
			scorpioAgentId: row.scorpioAgentId,
			oroplayAgentId: row.oroplayAgentId,
			boundUsers: bound.get(row.country) || 0,
			channels: row.channels.map((channel) => ({
				kind: channel.kind,
				code: channel.code,
				label: channel.label,
				enabled: channel.enabled
			})),
			...balances[index],
			updatedBy: row.updatedBy || '',
			updatedAt: row.updatedAt.toISOString()
		}))
	};
}

export async function GET() {
	const session = await requireAdmin();

	if (!session) {
		return unauthorized();
	}

	return Response.json(await readSettings());
}

function numberIn(value: unknown, min: number, max: number) {
	const n = Number(value);
	return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

export async function PATCH(request: Request) {
	const session = await requireAdmin();

	if (!session) {
		return unauthorized();
	}

	const body = (await request.json()) as { countries?: CountryInput[] };
	const submitted = Array.isArray(body.countries) ? body.countries : [];
	const updatedBy = session.db?.email || session.user?.email || 'admin';
	const seen = new Set<string>();
	const [existingRows, agents, bound] = await Promise.all([
		prisma.localPaymentCountry.findMany({ select: { country: true, currency: true } }),
		prisma.gameAgent.findMany({ select: { id: true, label: true, source: true, currency: true, enabled: true } }),
		boundUserCounts()
	]);
	const existing = new Map(existingRows.map((row) => [row.country, row]));
	const agentById = new Map(agents.map((agent) => [agent.id, agent]));
	const countries: {
		country: string;
		currency: string;
		fxRate: number;
		depositSpreadPct: number;
		withdrawSpreadPct: number;
		minDepositUsd: number;
		minWithdrawUsd: number;
		enabled: boolean;
		scorpioAgentId: string | null;
		oroplayAgentId: string | null;
		channels: { kind: 'DEPOSIT' | 'WITHDRAW'; code: string; label: string; enabled: boolean; sortOrder: number }[];
	}[] = [];

	for (const entry of submitted) {
		const country = (entry.country || '').trim().toUpperCase();

		if (!/^[A-Z]{2}$/.test(country)) {
			return badRequest(`${entry.country || 'A country'} is not a two-letter country code`);
		}

		if (seen.has(country)) {
			return badRequest(`${country} is listed twice`);
		}

		seen.add(country);

		const currency = (entry.currency || '').trim().toUpperCase();

		if (!/^[A-Z]{3}$/.test(currency)) {
			return badRequest(`Enter a three-letter currency code for ${country}`);
		}

		const boundUsers = bound.get(country) || 0;
		const previous = existing.get(country);

		if (boundUsers && previous && previous.currency.toUpperCase() !== currency) {
			return badRequest(
				`${boundUsers} account${boundUsers === 1 ? ' holds' : 's hold'} ${previous.currency} on ${country}, so its currency cannot change`
			);
		}

		const agentIds = { scorpio: entry.scorpioAgentId || null, oroplay: entry.oroplayAgentId || null };

		for (const source of ['scorpio', 'oroplay'] as const) {
			const id = agentIds[source];
			const name = source === 'scorpio' ? 'Scorpio' : 'Oroplay';

			if (!id) {
				// Bound accounts play on these agents; removing one would strand them.
				if (boundUsers) {
					return badRequest(`${country} has accounts playing on its ${name} agent. Swap it for another ${currency} agent instead of clearing it.`);
				}

				continue;
			}

			const agent = agentById.get(id);

			if (!agent || agent.source !== source) {
				return badRequest(`Choose a ${name} agent for ${country}`);
			}

			if (agent.currency.toUpperCase() !== currency) {
				return badRequest(`${agent.label} runs in ${agent.currency}, but ${country} runs in ${currency}`);
			}

			if (!agent.enabled) {
				return badRequest(`${agent.label} is turned off`);
			}
		}

		const fxRate = numberIn(entry.fxRate, 0.00000001, 1_000_000_000);

		if (fxRate === null || fxRate <= 0) {
			return badRequest(`Enter how many ${currency} make 1 USD for ${country}`);
		}

		const depositSpreadPct = numberIn(entry.depositSpreadPct ?? 0, 0, MAX_SPREAD_PCT);
		const withdrawSpreadPct = numberIn(entry.withdrawSpreadPct ?? 0, 0, MAX_SPREAD_PCT);

		if (depositSpreadPct === null || withdrawSpreadPct === null) {
			return badRequest(`Spreads for ${country} must be between 0 and ${MAX_SPREAD_PCT}%`);
		}

		const minDepositUsd = numberIn(entry.minDepositUsd, 0.01, MAX_MIN_USD);
		const minWithdrawUsd = numberIn(entry.minWithdrawUsd, 0.01, MAX_MIN_USD);

		if (minDepositUsd === null || minWithdrawUsd === null) {
			return badRequest(
				`Minimums for ${country} must be between 0.01 and ${MAX_MIN_USD.toLocaleString('en-US')} USD`
			);
		}

		const channels: (typeof countries)[number]['channels'] = [];
		const channelKeys = new Set<string>();

		for (const [index, channel] of (Array.isArray(entry.channels) ? entry.channels : []).entries()) {
			const kind = channel.kind === 'WITHDRAW' ? 'WITHDRAW' : channel.kind === 'DEPOSIT' ? 'DEPOSIT' : null;
			const code = (channel.code || '').trim();

			if (!code) {
				continue;
			}

			if (!kind) {
				return badRequest(`Choose deposit or payout for ${country} method ${code}`);
			}

			// Some published bank codes contain spaces ("VIETCOM BANK"), so only
			// line breaks and tabs are refused.
			if (code.length > 64 || /[\r\n\t]/.test(code)) {
				return badRequest(`${country} method code "${code.slice(0, 20)}" is not a valid DAYPGL code`);
			}

			const key = `${kind}:${code}`;

			if (channelKeys.has(key)) {
				return badRequest(`${country} lists ${code} twice for ${kind === 'DEPOSIT' ? 'deposits' : 'payouts'}`);
			}

			channelKeys.add(key);

			channels.push({
				kind,
				code,
				label: (channel.label || '').trim().slice(0, 120) || code,
				enabled: channel.enabled !== false,
				sortOrder: index
			});
		}

		const enabled = Boolean(entry.enabled);

		// Enabling a country with nothing to pay through would put a tab on the
		// player's wallet that cannot be completed, so it is refused up front.
		if (enabled && !channels.some((channel) => channel.enabled)) {
			return badRequest(`Add at least one enabled method before turning ${country} on`);
		}

		countries.push({
			country,
			currency,
			fxRate,
			depositSpreadPct: Math.round(depositSpreadPct * 100) / 100,
			withdrawSpreadPct: Math.round(withdrawSpreadPct * 100) / 100,
			minDepositUsd: Math.round(minDepositUsd * 100) / 100,
			minWithdrawUsd: Math.round(minWithdrawUsd * 100) / 100,
			enabled,
			scorpioAgentId: agentIds.scorpio,
			oroplayAgentId: agentIds.oroplay,
			channels
		});
	}

	const keep = countries.map((row) => row.country);
	const orphaned = [...bound.keys()].find((country) => existing.has(country) && !keep.includes(country));

	if (orphaned) {
		return badRequest(`${orphaned} has accounts opened on it and cannot be removed. Turn it off instead.`);
	}

	await prisma.$transaction([
		// Countries the form removed are deleted, and their methods with them.
		prisma.localPaymentCountry.deleteMany({
			where: keep.length ? { country: { notIn: keep } } : {}
		}),
		...countries.flatMap(({ channels, ...row }) => [
			prisma.localPaymentCountry.upsert({
				where: { country: row.country },
				create: { ...row, updatedBy },
				update: { ...row, updatedBy }
			}),
			prisma.localPaymentChannel.deleteMany({ where: { country: row.country } }),
			prisma.localPaymentChannel.createMany({
				data: channels.map((channel) => ({ ...channel, country: row.country }))
			})
		])
	]);
	invalidatePricingCache();

	return Response.json(await readSettings());
}
