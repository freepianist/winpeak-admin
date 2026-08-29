import { prisma } from '@/lib/db';
import { money } from '@/lib/money';
import { requireAdmin, unauthorized } from '@/lib/admin-auth';
import { serializeLedger, serializeUser } from '@/lib/serializers';

export async function GET() {
	const session = await requireAdmin();

	if (!session) {
		return unauthorized();
	}

	try {

	const weekAgo = new Date();
	weekAgo.setDate(weekAgo.getDate() - 7);

	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	const [
		userCount,
		newUsers,
		suspendedUsers,
		wallets,
		ledgerByKind,
		postCount,
		commentCount,
		reviewCount,
		storyCount,
		unreadInbox,
		subscriberCount,
		recentUsers,
		recentLedger,
		recentActivity,
		pendingWalletRows
	] = await Promise.all([
		prisma.user.count(),
		prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
		prisma.user.count({ where: { status: 'SUSPENDED' } }),
		prisma.wallet.findMany({ select: { balance: true, currency: true } }),
		prisma.ledgerEntry.groupBy({
			by: ['kind'],
			_sum: { amount: true },
			_count: true
		}),
		prisma.blogPost.count(),
		prisma.blogComment.count(),
		prisma.gameReview.count(),
		prisma.successStory.count(),
		prisma.contactMessage.count({ where: { read: false } }),
		prisma.newsletterSubscriber.count(),
		prisma.user.findMany({
			orderBy: { createdAt: 'desc' },
			take: 6,
			include: {
				wallet: true,
				_count: { select: { ledger: true, reviews: true } }
			}
		}),
		prisma.ledgerEntry.findMany({
			orderBy: { createdAt: 'desc' },
			take: 8,
			include: { user: { select: { firstName: true, lastName: true, email: true } } }
		}),
		prisma.ledgerEntry.findMany({
			where: { createdAt: { gte: thirtyDaysAgo } },
			select: { kind: true, amount: true, createdAt: true }
		}),
		prisma.walletRequest.groupBy({
			by: ['type'],
			where: { status: { in: ['PENDING', 'PROCESSING'] } },
			_count: true
		}).catch(() => [])
	]);

	let affiliatePartners = 0;
	let affiliateFtds = 0;
	let pendingAffiliatePay: { _sum: { amount: unknown } } = { _sum: { amount: 0 } };

	try {
		[affiliatePartners, affiliateFtds, pendingAffiliatePay] = await Promise.all([
			prisma.affiliatePartner.count(),
			prisma.user.count({
				where: { referredByAffiliateId: { not: null }, firstDepositAt: { not: null } }
			}),
			prisma.affiliateCommission.aggregate({
				where: { status: { in: ['PENDING', 'APPROVED'] } },
				_sum: { amount: true }
			})
		]);
	} catch (error) {
		console.error('Affiliate stats unavailable', error);
	}

	const totals: Record<string, { amount: number; count: number }> = {};

	for (const row of ledgerByKind) {
		totals[row.kind] = {
			amount: money(row._sum.amount),
			count: row._count
		};
	}

	const deposits = totals.DEPOSIT?.amount || 0;
	const withdrawals = totals.WITHDRAW?.amount || 0;
	const bets = totals.BET?.amount || 0;
	const wins = totals.WIN?.amount || 0;
	const currency = wallets[0]?.currency || 'USD';

	const dayMap = new Map<string, { deposits: number; withdrawals: number; bets: number; wins: number }>();

	for (let i = 13; i >= 0; i -= 1) {
		const day = new Date();
		day.setHours(0, 0, 0, 0);
		day.setDate(day.getDate() - i);
		dayMap.set(day.toISOString().slice(0, 10), { deposits: 0, withdrawals: 0, bets: 0, wins: 0 });
	}

	for (const entry of recentActivity) {
		const key = entry.createdAt.toISOString().slice(0, 10);
		const bucket = dayMap.get(key);

		if (!bucket) {
			continue;
		}

		const amount = money(entry.amount);

		if (entry.kind === 'DEPOSIT') bucket.deposits += amount;
		if (entry.kind === 'WITHDRAW') bucket.withdrawals += amount;
		if (entry.kind === 'BET') bucket.bets += amount;
		if (entry.kind === 'WIN') bucket.wins += amount;
	}

	const pendingDeposits =
		pendingWalletRows.find((row) => row.type === 'DEPOSIT')?._count || 0;
	const pendingWithdrawals =
		pendingWalletRows.find((row) => row.type === 'WITHDRAW')?._count || 0;

	return Response.json({
		users: {
			total: userCount,
			newThisWeek: newUsers,
			suspended: suspendedUsers
		},
		wallets: {
			totalBalance: wallets.reduce((sum, wallet) => sum + money(wallet.balance), 0),
			currency
		},
		ledger: {
			deposits,
			withdrawals,
			bets,
			wins,
			netDeposits: deposits - withdrawals,
			ggr: bets - wins,
			counts: {
				deposits: totals.DEPOSIT?.count || 0,
				withdrawals: totals.WITHDRAW?.count || 0,
				bets: totals.BET?.count || 0,
				wins: totals.WIN?.count || 0
			}
		},
		queues: {
			pendingDeposits,
			pendingWithdrawals
		},
		content: {
			posts: postCount,
			comments: commentCount,
			reviews: reviewCount,
			stories: storyCount,
			unreadInbox,
			subscribers: subscriberCount
		},
		series: Array.from(dayMap.entries()).map(([date, values]) => ({ date, ...values })),
		recentUsers: recentUsers.map(serializeUser),
		recentLedger: recentLedger.map(serializeLedger),
		affiliates: {
			partners: affiliatePartners,
			ftds: affiliateFtds,
			pending: money(pendingAffiliatePay._sum.amount)
		}
	});
	} catch (error) {
		console.error('WinPeak stats failed', error);
		return Response.json(
			{ error: error instanceof Error ? error.message : 'Failed to load WinPeak data' },
			{ status: 500 }
		);
	}
}
