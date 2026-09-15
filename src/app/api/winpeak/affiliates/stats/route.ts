import { prisma } from '@/lib/db';
import { requireMarketing, unauthorized } from '@/lib/admin-auth';
import { getPartnerBook } from '@/lib/affiliates';
import { money as toMoney } from '@/lib/money';

export async function GET() {
	const session = await requireMarketing();

	if (!session) {
		return unauthorized();
	}

	const [partners, pendingInvites, referredPlayers, ftds, commissions, payouts, clickTotals] =
		await Promise.all([
			prisma.affiliatePartner.findMany({ orderBy: { createdAt: 'desc' } }),
			prisma.affiliatePartner.count({ where: { status: 'INVITED' } }),
			prisma.user.count({ where: { referredByAffiliateId: { not: null } } }),
			prisma.user.count({
				where: { referredByAffiliateId: { not: null }, firstDepositAt: { not: null } }
			}),
			prisma.affiliateCommission.groupBy({
				by: ['status', 'kind'],
				where: { status: { not: 'VOID' } },
				_sum: { amount: true }
			}),
			prisma.affiliatePayout.aggregate({ _sum: { amount: true } }),
			prisma
				.$queryRaw<Array<{ clicks: number; uniqueClicks: number }>>`
					SELECT COUNT(*)::int AS clicks, COUNT(DISTINCT "visitorKey")::int AS "uniqueClicks"
					FROM "AffiliateClick"
				`
				.then((rows) => rows[0] || { clicks: 0, uniqueClicks: 0 })
				.catch(() => ({ clicks: 0, uniqueClicks: 0 }))
		]);

	let bookedCpa = 0;
	let bookedRevShare = 0;
	let pending = 0;
	let approved = 0;
	let paid = 0;

	for (const row of commissions) {
		const amount = toMoney(row._sum.amount);

		if (row.kind === 'CPA') bookedCpa += amount;
		if (row.kind === 'REVSHARE') bookedRevShare += amount;
		if (row.status === 'PENDING') pending += amount;
		if (row.status === 'APPROVED') approved += amount;
		if (row.status === 'PAID') paid += amount;
	}

	const books = await Promise.all(
		partners.map(async (partner) => {
			const book = await getPartnerBook(partner.id);
			return {
				id: partner.id,
				name: partner.name,
				code: partner.code,
				dealType: partner.dealType,
				status: partner.status,
				stats: book?.stats
			};
		})
	);

	const leaderboard = [...books].sort((a, b) => (b.stats?.ftds || 0) - (a.stats?.ftds || 0)).slice(0, 6);

	return Response.json({
		partners: {
			total: partners.length,
			active: partners.filter((partner) => partner.status === 'ACTIVE').length,
			invited: pendingInvites,
			paused: partners.filter((partner) => partner.status === 'PAUSED').length
		},
		players: {
			signups: referredPlayers,
			ftds,
			clicks: clickTotals.clicks,
			uniqueClicks: clickTotals.uniqueClicks
		},
		money: {
			bookedCpa,
			bookedRevShare,
			pending,
			approved,
			paid,
			paidOut: toMoney(payouts._sum.amount),
			estimatedRevShare: books.reduce((sum, row) => sum + (row.stats?.estimatedRevShare || 0), 0)
		},
		leaderboard
	});
}
