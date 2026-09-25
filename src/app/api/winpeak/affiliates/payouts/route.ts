import { prisma } from '@/lib/db';
import { badRequest, requireAdminOrAffiliate, requireMarketing, unauthorized } from '@/lib/admin-auth';
import { money } from '@/lib/money';
import { serializePayout } from '@/lib/affiliates';

const payoutInclude = {
	partner: { select: { name: true, email: true, code: true } },
	_count: { select: { commissions: true } }
} as const;

class StaleCommissionsError extends Error {}

export async function GET() {
	const access = await requireAdminOrAffiliate();

	if (!access) {
		return unauthorized();
	}

	const payouts = await prisma.affiliatePayout.findMany({
		where: access.isAdmin ? undefined : { partnerId: access.partner.id },
		orderBy: { createdAt: 'desc' },
		include: payoutInclude
	});

	return Response.json(payouts.map(serializePayout));
}

export async function POST(request: Request) {
	const session = await requireMarketing();

	if (!session) {
		return unauthorized();
	}

	const body = (await request.json()) as {
		partnerId?: string;
		commissionIds?: unknown;
		note?: string;
	};

	const partnerId = String(body.partnerId || '');
	const commissionIds = Array.isArray(body.commissionIds)
		? [...new Set(body.commissionIds.filter((id): id is string => typeof id === 'string' && id.length > 0))]
		: [];

	if (!partnerId) {
		return badRequest('Partner is required');
	}

	if (commissionIds.length === 0) {
		return badRequest('Select at least one approved commission to pay');
	}

	const partner = await prisma.affiliatePartner.findUnique({ where: { id: partnerId } });

	if (!partner) {
		return badRequest('Partner not found');
	}

	const payable = { id: { in: commissionIds }, partnerId, status: 'APPROVED' as const, payoutId: null };

	try {
		const payout = await prisma.$transaction(async (tx) => {
			const commissions = await tx.affiliateCommission.findMany({
				where: payable,
				select: { amount: true }
			});

			if (commissions.length !== commissionIds.length) {
				throw new StaleCommissionsError();
			}

			const amount = Number(commissions.reduce((sum, row) => sum + money(row.amount), 0).toFixed(4));

			const created = await tx.affiliatePayout.create({
				data: {
					partnerId,
					amount,
					note: String(body.note || '').trim() || null,
					status: 'SENT'
				}
			});

			const settled = await tx.affiliateCommission.updateMany({
				where: payable,
				data: { status: 'PAID', payoutId: created.id }
			});

			if (settled.count !== commissionIds.length) {
				throw new StaleCommissionsError();
			}

			return tx.affiliatePayout.findUniqueOrThrow({ where: { id: created.id }, include: payoutInclude });
		});

		return Response.json(serializePayout(payout));
	} catch (error) {
		if (error instanceof StaleCommissionsError) {
			return badRequest('Some of those commissions are no longer approved. Refresh and try again.');
		}

		throw error;
	}
}
