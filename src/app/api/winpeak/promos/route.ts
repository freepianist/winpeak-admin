import { prisma } from '@/lib/db';
import { badRequest, requireAdmin, unauthorized } from '@/lib/admin-auth';
import { serializeOffer, serializePlayerBonus } from '@/lib/promos';
import { money } from '@/lib/money';

type PromoKind = 'WELCOME' | 'RELOAD' | 'CASHBACK' | 'REFERRAL';
type PromoStatus = 'ACTIVE' | 'PAUSED';

type OfferInput = {
	id?: string;
	market?: string | null;
	slug?: string;
	kind?: string;
	status?: string;
	name?: string;
	headline?: string;
	details?: string;
	matchPercent?: number;
	maxAmount?: number;
	minDeposit?: number;
	wagerMultiplier?: number;
	expireDays?: number;
	maxBet?: number;
	depositNumber?: number | null;
	rewardAmount?: number;
};

const KINDS: PromoKind[] = ['WELCOME', 'RELOAD', 'CASHBACK', 'REFERRAL'];

/** Offer amounts are USD, so they share the payment floors' ceiling. */
const MAX_USD = 100_000;

/**
 * Which deposit each kind is granted on, as `grantDepositPromos` reads it. An
 * offer filed under the wrong number would never be granted, so the number is
 * derived from the kind rather than typed in.
 */
function depositNumberFor(kind: PromoKind, submitted: number | null | undefined) {
	if (kind === 'WELCOME') return 1;

	if (kind === 'RELOAD') {
		const n = Math.trunc(Number(submitted));
		return n === 2 || n === 3 ? n : null;
	}

	return null;
}

function slugify(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 64);
}

function numberIn(value: unknown, min: number, max: number) {
	const n = Number(value);
	return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

/**
 * Markets staff can file an offer under: everything configured for local
 * payments, plus any code the offers already use. A market removed from payment
 * settings keeps its offers listed so they can be moved or deleted rather than
 * stranded out of sight.
 */
async function marketOptions() {
	const [countries, used] = await Promise.all([
		prisma.localPaymentCountry.findMany({
			select: { country: true, currency: true, fxRate: true, enabled: true },
			orderBy: { country: 'asc' }
		}),
		prisma.promoOffer.findMany({
			where: { market: { not: null } },
			select: { market: true },
			distinct: ['market']
		})
	]);
	const configured = new Map(countries.map((row) => [row.country, row]));
	const orphaned = used
		.map((row) => row.market as string)
		.filter((market) => !configured.has(market))
		.map((market) => ({ country: market, currency: '', fxRate: 0, enabled: false, configured: false }));

	return [
		...countries.map((row) => ({ ...row, fxRate: Number(row.fxRate), configured: true })),
		...orphaned.sort((a, b) => a.country.localeCompare(b.country))
	];
}

async function readPromos() {
	const [offers, bonuses, cashbackAgg, markets] = await Promise.all([
		prisma.promoOffer.findMany({
			orderBy: [{ market: 'asc' }, { depositNumber: 'asc' }, { createdAt: 'asc' }]
		}),
		prisma.playerBonus.findMany({
			orderBy: { grantedAt: 'desc' },
			take: 100,
			include: {
				offer: { select: { name: true, kind: true, market: true } },
				user: { select: { firstName: true, lastName: true, email: true, wallet: { select: { currency: true } } } }
			}
		}),
		prisma.cashbackPayout.aggregate({
			_sum: { amount: true },
			_count: true
		}),
		marketOptions()
	]);

	return {
		offers: offers.map((offer) => serializeOffer(offer)),
		bonuses: bonuses.map(serializePlayerBonus),
		markets,
		cashback: {
			lastAmount: money(cashbackAgg._sum.amount),
			lastCount: cashbackAgg._count
		}
	};
}

/**
 * A market runs one offer per slot; a second active one would simply never be
 * granted, because `getOffer` takes the oldest. Paused drafts are allowed, so a
 * replacement can be written before the live one is switched off.
 */
async function slotTaken(
	market: string | null,
	kind: PromoKind,
	depositNumber: number | null,
	exceptId?: string
) {
	const clash = await prisma.promoOffer.findFirst({
		where: {
			market,
			kind,
			depositNumber,
			status: 'ACTIVE',
			...(exceptId ? { id: { not: exceptId } } : {})
		},
		select: { name: true }
	});
	return clash?.name || null;
}

function marketLabel(market: string | null) {
	return market || 'all markets';
}

export async function GET() {
	const session = await requireAdmin();

	if (!session) {
		return unauthorized();
	}

	return Response.json(await readPromos());
}

export async function POST(request: Request) {
	const session = await requireAdmin();

	if (!session) {
		return unauthorized();
	}

	const body = (await request.json()) as OfferInput;
	const kind = KINDS.find((entry) => entry === body.kind);

	if (!kind) {
		return badRequest('Choose a welcome, reload, cashback or referral offer');
	}

	const market = (body.market || '').trim().toUpperCase() || null;

	if (market && !/^[A-Z]{2}$/.test(market)) {
		return badRequest(`${body.market} is not a two-letter market code`);
	}

	if (market) {
		const configured = await prisma.localPaymentCountry.findUnique({
			where: { country: market },
			select: { country: true }
		});

		if (!configured) {
			return badRequest(`${market} is not a configured market. Add it under Payment settings first.`);
		}
	}

	const name = (body.name || '').trim();

	if (!name) {
		return badRequest('Give the offer a name');
	}

	const headline = (body.headline || '').trim();

	if (!headline) {
		return badRequest('Write the headline players see on the promotions page');
	}

	const details = (body.details || '').trim();

	if (!details) {
		return badRequest('Write the terms players see when they open the offer');
	}

	const depositNumber = depositNumberFor(kind, body.depositNumber);

	if (kind === 'RELOAD' && depositNumber === null) {
		return badRequest('A reload runs on the second or the third deposit');
	}

	const slug = slugify(body.slug || name);

	if (!slug) {
		return badRequest('Give the offer a name that can be used as a slug');
	}

	const duplicateSlug = await prisma.promoOffer.findFirst({
		where: { market, slug },
		select: { id: true }
	});

	if (duplicateSlug) {
		return badRequest(`${slug} is already used by another offer on ${marketLabel(market)}`);
	}

	const status: PromoStatus = body.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE';
	const taken = status === 'ACTIVE' ? await slotTaken(market, kind, depositNumber) : null;

	if (taken) {
		return badRequest(
			`${taken} already runs this offer on ${marketLabel(market)}. Pause it first, or save the new one paused.`
		);
	}

	const amounts = {
		matchPercent: numberIn(body.matchPercent ?? 0, 0, 1000),
		maxAmount: numberIn(body.maxAmount ?? 0, 0, MAX_USD),
		minDeposit: numberIn(body.minDeposit ?? 0, 0, MAX_USD),
		wagerMultiplier: numberIn(body.wagerMultiplier ?? 0, 0, 1000),
		expireDays: numberIn(body.expireDays ?? 0, 0, 3650),
		maxBet: numberIn(body.maxBet ?? 0, 0, MAX_USD),
		rewardAmount: numberIn(body.rewardAmount ?? 0, 0, MAX_USD)
	};
	const invalid = Object.entries(amounts).find(([, value]) => value === null);

	if (invalid) {
		return badRequest(`${invalid[0]} is out of range`);
	}

	const created = await prisma.promoOffer.create({
		data: {
			market,
			slug,
			kind,
			name,
			headline,
			details,
			depositNumber,
			status,
			matchPercent: amounts.matchPercent as number,
			maxAmount: amounts.maxAmount as number,
			minDeposit: amounts.minDeposit as number,
			wagerMultiplier: amounts.wagerMultiplier as number,
			expireDays: Math.trunc(amounts.expireDays as number),
			maxBet: amounts.maxBet as number,
			rewardAmount: amounts.rewardAmount as number
		}
	});

	return Response.json(serializeOffer(created), { status: 201 });
}

export async function PATCH(request: Request) {
	const session = await requireAdmin();

	if (!session) {
		return unauthorized();
	}

	const body = (await request.json()) as OfferInput;

	if (!body.id) {
		return badRequest('Offer id is required');
	}

	const existing = await prisma.promoOffer.findUnique({ where: { id: body.id } });

	if (!existing) {
		return badRequest('Offer not found');
	}

	const status: PromoStatus | undefined =
		body.status === 'ACTIVE' || body.status === 'PAUSED' ? body.status : undefined;

	if (body.status && !status) {
		return badRequest('Invalid status');
	}

	// The market is the one thing an offer can be moved between, so it is
	// re-checked against the live slots the way a new offer is.
	let market = existing.market;

	if (body.market !== undefined) {
		market = (body.market || '').trim().toUpperCase() || null;

		if (market && !/^[A-Z]{2}$/.test(market)) {
			return badRequest(`${body.market} is not a two-letter market code`);
		}

		if (market && market !== existing.market) {
			const configured = await prisma.localPaymentCountry.findUnique({
				where: { country: market },
				select: { country: true }
			});

			if (!configured) {
				return badRequest(`${market} is not a configured market. Add it under Payment settings first.`);
			}
		}

		if (market !== existing.market) {
			const duplicateSlug = await prisma.promoOffer.findFirst({
				where: { market, slug: existing.slug, id: { not: existing.id } },
				select: { id: true }
			});

			if (duplicateSlug) {
				return badRequest(`${existing.slug} is already used by another offer on ${marketLabel(market)}`);
			}
		}
	}

	if ((status || existing.status) === 'ACTIVE') {
		const taken = await slotTaken(market, existing.kind, existing.depositNumber, existing.id);

		if (taken) {
			return badRequest(`${taken} already runs this offer on ${marketLabel(market)}. Pause it first.`);
		}
	}

	const updated = await prisma.promoOffer.update({
		where: { id: body.id },
		data: {
			market,
			...(status ? { status } : {}),
			...(body.name?.trim() ? { name: body.name.trim() } : {}),
			...(body.headline?.trim() ? { headline: body.headline.trim() } : {}),
			...(body.details?.trim() ? { details: body.details.trim() } : {}),
			...(body.matchPercent != null ? { matchPercent: Number(body.matchPercent) } : {}),
			...(body.maxAmount != null ? { maxAmount: Number(body.maxAmount) } : {}),
			...(body.minDeposit != null ? { minDeposit: Number(body.minDeposit) } : {}),
			...(body.wagerMultiplier != null ? { wagerMultiplier: Number(body.wagerMultiplier) } : {}),
			...(body.expireDays != null ? { expireDays: Math.trunc(Number(body.expireDays)) } : {}),
			...(body.maxBet != null ? { maxBet: Number(body.maxBet) } : {}),
			...(body.rewardAmount != null ? { rewardAmount: Number(body.rewardAmount) } : {})
		}
	});

	return Response.json(serializeOffer(updated));
}

export async function DELETE(request: Request) {
	const session = await requireAdmin();

	if (!session) {
		return unauthorized();
	}

	const id = new URL(request.url).searchParams.get('id') || '';

	if (!id) {
		return badRequest('Offer id is required');
	}

	const existing = await prisma.promoOffer.findUnique({ where: { id } });

	if (!existing) {
		return badRequest('Offer not found');
	}

	// Granted bonuses read their terms back off the offer, so one that has paid
	// out is history and can only be switched off.
	const [granted, cashback] = await Promise.all([
		prisma.playerBonus.count({ where: { offerId: id } }),
		prisma.cashbackPayout.count({ where: { offerId: id } })
	]);

	if (granted || cashback) {
		return badRequest(
			`${existing.name} has already paid out to ${granted + cashback} player${granted + cashback === 1 ? '' : 's'} and cannot be deleted. Pause it instead.`
		);
	}

	await prisma.promoOffer.delete({ where: { id } });

	return Response.json({ success: true, id });
}
