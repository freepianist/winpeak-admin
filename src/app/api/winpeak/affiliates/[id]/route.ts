import { prisma } from '@/lib/db';
import { badRequest, notFound, requireMarketing, unauthorized } from '@/lib/admin-auth';
import {
	getPartnerBook,
	hashAffiliatePassword,
	serializeCommission,
	serializePartner,
	serializePayout
} from '@/lib/affiliates';

type RouteContext = { params: Promise<{ id: string }> };

const DEAL_TYPES = new Set(['CPA', 'REVSHARE', 'HYBRID']);
const STATUSES = new Set(['INVITED', 'ACTIVE', 'PAUSED', 'CLOSED']);

export async function GET(_request: Request, context: RouteContext) {
	const session = await requireMarketing();

	if (!session) {
		return unauthorized();
	}

	const { id } = await context.params;
	const book = await getPartnerBook(id);

	if (!book) {
		return notFound('Partner not found');
	}

	const [commissions, payouts] = await Promise.all([
		prisma.affiliateCommission.findMany({
			where: { partnerId: id },
			orderBy: { createdAt: 'desc' },
			include: { user: { select: { firstName: true, lastName: true, email: true } } }
		}),
		prisma.affiliatePayout.findMany({
			where: { partnerId: id },
			orderBy: { createdAt: 'desc' }
		})
	]);

	return Response.json({
		partner: serializePartner(book.partner),
		stats: book.stats,
		players: book.players.map((player) => ({
			id: player.id,
			displayName: `${player.firstName} ${player.lastName}`.trim(),
			email: player.email,
			status: player.status,
			joinedAt: player.createdAt.toISOString(),
			firstDepositAt: player.firstDepositAt?.toISOString() || null,
			qualified: Boolean(player.firstDepositAt)
		})),
		commissions: commissions.map(serializeCommission),
		payouts: payouts.map(serializePayout),
		clicks: book.clicks,
		clickSeries: book.clickSeries
	});
}

export async function PATCH(request: Request, context: RouteContext) {
	const session = await requireMarketing();

	if (!session) {
		return unauthorized();
	}

	const { id } = await context.params;
	const partner = await prisma.affiliatePartner.findUnique({ where: { id } });

	if (!partner) {
		return notFound('Partner not found');
	}

	const body = (await request.json()) as {
		name?: string;
		email?: string;
		dealType?: string;
		cpaAmount?: number | string | null;
		revSharePercent?: number | string | null;
		minFtdAmount?: number | string | null;
		status?: string;
		notes?: string;
		password?: string;
		code?: string;
	};

	const data: Record<string, unknown> = {};

	if (body.name !== undefined) {
		const name = String(body.name).trim();

		if (!name) {
			return badRequest('Name is required');
		}

		data.name = name;
	}

	if (body.email !== undefined) {
		data.email = String(body.email).trim().toLowerCase();
	}

	if (body.dealType !== undefined) {
		const dealType = String(body.dealType).toUpperCase();

		if (!DEAL_TYPES.has(dealType)) {
			return badRequest('Deal type must be CPA, REVSHARE, or HYBRID');
		}

		data.dealType = dealType;
	}

	if (body.status !== undefined) {
		const status = String(body.status).toUpperCase();

		if (!STATUSES.has(status)) {
			return badRequest('Invalid status');
		}

		data.status = status;
	}

	if (body.notes !== undefined) {
		data.notes = String(body.notes).trim() || null;
	}

	if (body.cpaAmount !== undefined) {
		data.cpaAmount = body.cpaAmount === null || body.cpaAmount === '' ? null : Number(body.cpaAmount);
	}

	if (body.revSharePercent !== undefined) {
		data.revSharePercent =
			body.revSharePercent === null || body.revSharePercent === '' ? null : Number(body.revSharePercent);
	}

	if (body.minFtdAmount !== undefined) {
		const minFtdAmount = body.minFtdAmount === null || body.minFtdAmount === '' ? 0 : Number(body.minFtdAmount);

		if (!Number.isFinite(minFtdAmount) || minFtdAmount < 0) {
			return badRequest('Enter a valid FTD floor');
		}

		data.minFtdAmount = minFtdAmount;
	}

	if (body.code !== undefined) {
		data.code = String(body.code).trim().toUpperCase();
	}

	if (body.password) {
		data.passwordHash = await hashAffiliatePassword(String(body.password));

		if (partner.status === 'INVITED') {
			data.status = 'ACTIVE';
		}
	}

	const updated = await prisma.affiliatePartner.update({
		where: { id },
		data
	});

	return Response.json(serializePartner(updated));
}
