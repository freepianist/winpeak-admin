import { prisma } from '@/lib/db';
import { badRequest, requireAdmin, unauthorized } from '@/lib/admin-auth';
import { serializeOffer, serializePlayerBonus } from '@/lib/promos';
import { money } from '@/lib/money';

export async function GET() {
	const session = await requireAdmin();

	if (!session) {
		return unauthorized();
	}

	const [offers, bonuses, cashbackAgg] = await Promise.all([
		prisma.promoOffer.findMany({
			orderBy: [{ depositNumber: 'asc' }, { createdAt: 'asc' }]
		}),
		prisma.playerBonus.findMany({
			orderBy: { grantedAt: 'desc' },
			take: 100,
			include: {
				offer: { select: { name: true, kind: true } },
				user: { select: { firstName: true, lastName: true, email: true } }
			}
		}),
		prisma.cashbackPayout.aggregate({
			_sum: { amount: true },
			_count: true
		})
	]);

	return Response.json({
		offers: offers.map(serializeOffer),
		bonuses: bonuses.map(serializePlayerBonus),
		cashback: {
			lastAmount: money(cashbackAgg._sum.amount),
			lastCount: cashbackAgg._count
		}
	});
}

export async function PATCH(request: Request) {
	const session = await requireAdmin();

	if (!session) {
		return unauthorized();
	}

	const body = (await request.json()) as {
		id?: string;
		status?: 'ACTIVE' | 'PAUSED';
		name?: string;
		headline?: string;
		details?: string;
		matchPercent?: number;
		maxAmount?: number;
		minDeposit?: number;
		wagerMultiplier?: number;
		expireDays?: number;
		maxBet?: number;
		rewardAmount?: number;
	};

	if (!body.id) {
		return badRequest('Offer id is required');
	}

	const existing = await prisma.promoOffer.findUnique({ where: { id: body.id } });

	if (!existing) {
		return badRequest('Offer not found');
	}

	if (body.status && body.status !== 'ACTIVE' && body.status !== 'PAUSED') {
		return badRequest('Invalid status');
	}

	const updated = await prisma.promoOffer.update({
		where: { id: body.id },
		data: {
			...(body.status ? { status: body.status } : {}),
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
