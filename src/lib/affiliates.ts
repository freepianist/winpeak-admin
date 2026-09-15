import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { money } from '@/lib/money';

export function trackingLink(code: string) {
	const origin = (process.env.WINPEAK_SITE_URL || process.env.NEXT_PUBLIC_WINPEAK_SITE_URL || '').replace(/\/$/, '');
	const path = `?ref=${encodeURIComponent(code)}`;
	return origin ? `${origin}${path}` : path;
}

export function maskEmail(email: string) {
	const [user, domain] = email.split('@');

	if (!user || !domain) {
		return '***';
	}

	return `${user[0]}***@${domain}`;
}

export function makeAffiliateCode(name: string) {
	const base = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'AFF';
	const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
	return `${base}${suffix}`;
}

export function makeTempPassword() {
	return `Aff-${Math.random().toString(36).slice(2, 10)}`;
}

export async function hashAffiliatePassword(password: string) {
	return bcrypt.hash(password, 12);
}

export async function verifyAffiliatePassword(password: string, passwordHash: string) {
	return bcrypt.compare(password, passwordHash);
}

export function serializePartner(
	partner: {
		id: string;
		email: string;
		name: string;
		passwordHash?: string | null;
		code: string;
		dealType: string;
		cpaAmount: { toString(): string } | number | null;
		revSharePercent: { toString(): string } | number | null;
		minFtdAmount?: { toString(): string } | number | null;
		status: string;
		notes: string | null;
		createdAt: Date;
		updatedAt: Date;
	},
	extras: Record<string, unknown> = {}
) {
	return {
		id: partner.id,
		email: partner.email,
		name: partner.name,
		code: partner.code,
		dealType: partner.dealType,
		cpaAmount: money(partner.cpaAmount),
		revSharePercent: money(partner.revSharePercent),
		minFtdAmount: money(partner.minFtdAmount),
		status: partner.status,
		notes: partner.notes || '',
		hasPassword: Boolean(partner.passwordHash),
		trackingLink: trackingLink(partner.code),
		createdAt: partner.createdAt.toISOString(),
		updatedAt: partner.updatedAt.toISOString(),
		...extras
	};
}

export function serializeCommission(row: {
	id: string;
	partnerId: string;
	userId: string | null;
	kind: string;
	amount: { toString(): string } | number;
	basisAmount: { toString(): string } | number;
	status: string;
	createdAt: Date;
	partner?: { name: string; email: string; code: string };
	user?: { firstName: string; lastName: string; email: string } | null;
	maskPlayer?: boolean;
}) {
	const email = row.user?.email || '';
	return {
		id: row.id,
		partnerId: row.partnerId,
		partnerName: row.partner?.name || '',
		partnerEmail: row.partner?.email || '',
		partnerCode: row.partner?.code || '',
		userId: row.userId,
		playerName: row.user ? `${row.user.firstName} ${row.user.lastName}`.trim() : '',
		playerEmail: row.maskPlayer ? maskEmail(email) : email,
		kind: row.kind,
		amount: money(row.amount),
		basisAmount: money(row.basisAmount),
		status: row.status,
		createdAt: row.createdAt.toISOString()
	};
}

export function serializePayout(row: {
	id: string;
	partnerId: string;
	amount: { toString(): string } | number;
	status: string;
	note: string | null;
	createdAt: Date;
	partner?: { name: string; email: string; code: string };
}) {
	return {
		id: row.id,
		partnerId: row.partnerId,
		partnerName: row.partner?.name || '',
		partnerEmail: row.partner?.email || '',
		partnerCode: row.partner?.code || '',
		amount: money(row.amount),
		status: row.status,
		note: row.note || '',
		createdAt: row.createdAt.toISOString()
	};
}

export function serializeClick(row: {
	id: string;
	landingPath: string;
	referrer: string;
	createdAt: Date;
}) {
	return {
		id: row.id,
		landingPath: row.landingPath || '/',
		source: row.referrer || 'Direct',
		createdAt: row.createdAt.toISOString()
	};
}

function lastUtcDays(count: number) {
	const days: string[] = [];
	const now = new Date();

	for (let index = count - 1; index >= 0; index -= 1) {
		const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - index));
		days.push(day.toISOString().slice(0, 10));
	}

	return days;
}

async function getClickSeries(partnerId: string, days = 14) {
	const since = new Date();
	since.setUTCHours(0, 0, 0, 0);
	since.setUTCDate(since.getUTCDate() - (days - 1));

	const rows = await prisma
		.$queryRaw<Array<{ day: string; clicks: number; uniqueClicks: number }>>`
			SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day,
			       COUNT(*)::int AS clicks,
			       COUNT(DISTINCT "visitorKey")::int AS "uniqueClicks"
			FROM "AffiliateClick"
			WHERE "partnerId" = ${partnerId} AND "createdAt" >= ${since}
			GROUP BY 1
			ORDER BY 1
		`
		.catch((): Array<{ day: string; clicks: number; uniqueClicks: number }> => []);

	const byDay = new Map(rows.map((row) => [String(row.day).slice(0, 10), row]));

	return lastUtcDays(days).map((date) => {
		const row = byDay.get(date);
		return {
			date,
			clicks: Number(row?.clicks || 0),
			uniqueClicks: Number(row?.uniqueClicks || 0)
		};
	});
}

export async function getPartnerBook(partnerId: string) {
	const partner = await prisma.affiliatePartner.findUnique({ where: { id: partnerId } });

	if (!partner) {
		return null;
	}

	const players = await prisma.user.findMany({
		where: { referredByAffiliateId: partnerId },
		orderBy: { createdAt: 'desc' },
		select: {
			id: true,
			email: true,
			firstName: true,
			lastName: true,
			status: true,
			firstDepositAt: true,
			createdAt: true
		}
	});

	const playerIds = players.map((player) => player.id);
	const ftds = players.filter((player) => player.firstDepositAt).length;

	let bets = 0;
	let wins = 0;

	if (playerIds.length) {
		const rows = await prisma.ledgerEntry.groupBy({
			by: ['kind'],
			where: { userId: { in: playerIds }, kind: { in: ['BET', 'WIN'] } },
			_sum: { amount: true }
		});

		for (const row of rows) {
			if (row.kind === 'BET') bets = money(row._sum.amount);
			if (row.kind === 'WIN') wins = money(row._sum.amount);
		}
	}

	const ggr = Math.max(0, bets - wins);
	const revSharePercent = money(partner.revSharePercent);
	const estimatedRevShare =
		partner.dealType === 'CPA' ? 0 : Number(((ggr * revSharePercent) / 100).toFixed(4));

	const [commissionRows, payoutSum, clickCount, uniqueClicks, recentClicks, clickSeries] = await Promise.all([
		prisma.affiliateCommission.groupBy({
			by: ['status', 'kind'],
			where: { partnerId, status: { not: 'VOID' } },
			_sum: { amount: true }
		}),
		prisma.affiliatePayout.aggregate({
			where: { partnerId },
			_sum: { amount: true }
		}),
		prisma.affiliateClick.count({ where: { partnerId } }).catch(() => 0),
		prisma
			.$queryRaw<Array<{ count: number }>>`
				SELECT COUNT(DISTINCT "visitorKey")::int AS count
				FROM "AffiliateClick"
				WHERE "partnerId" = ${partnerId}
			`
			.then((rows) => rows[0]?.count || 0)
			.catch(() => 0),
		prisma.affiliateClick
			.findMany({
				where: { partnerId },
				orderBy: { createdAt: 'desc' },
				take: 100,
				select: { id: true, landingPath: true, referrer: true, createdAt: true }
			})
			.catch(
				(): Array<{ id: string; landingPath: string; referrer: string; createdAt: Date }> => []
			),
		getClickSeries(partnerId)
	]);

	let bookedCpa = 0;
	let bookedRevShare = 0;
	let pending = 0;
	let approved = 0;
	let paid = 0;

	for (const row of commissionRows) {
		const amount = money(row._sum.amount);

		if (row.kind === 'CPA') bookedCpa += amount;
		if (row.kind === 'REVSHARE') bookedRevShare += amount;
		if (row.status === 'PENDING') pending += amount;
		if (row.status === 'APPROVED') approved += amount;
		if (row.status === 'PAID') paid += amount;
	}

	return {
		partner,
		players,
		clicks: recentClicks.map(serializeClick),
		clickSeries,
		stats: {
			clicks: clickCount,
			uniqueClicks,
			signups: players.length,
			ftds,
			bets,
			wins,
			ggr,
			estimatedRevShare,
			bookedCpa,
			bookedRevShare,
			pending,
			approved,
			paid,
			paidOut: money(payoutSum._sum.amount)
		}
	};
}

export async function accrueAffiliateCpa(userId: string, depositAmount: number) {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		include: { referredBy: true }
	});

	if (!user || user.firstDepositAt) {
		return;
	}

	const floor = money(user.referredBy?.minFtdAmount);

	if (depositAmount < floor) {
		return;
	}

	const marked = await prisma.user.updateMany({
		where: { id: userId, firstDepositAt: null },
		data: { firstDepositAt: new Date() }
	});

	if (marked.count === 0) {
		return;
	}

	const partner = user.referredBy;

	if (!partner || partner.status !== 'ACTIVE' || partner.dealType === 'REVSHARE') {
		return;
	}

	const cpa = money(partner.cpaAmount);

	if (cpa <= 0) {
		return;
	}

	await prisma.affiliateCommission.create({
		data: {
			partnerId: partner.id,
			userId,
			kind: 'CPA',
			amount: cpa,
			basisAmount: depositAmount,
			status: 'PENDING'
		}
	});
}

export async function bookRevShare(partnerId: string) {
	const book = await getPartnerBook(partnerId);

	if (!book) {
		throw new Error('Partner not found');
	}

	if (book.partner.dealType === 'CPA') {
		throw new Error('This partner is CPA only');
	}

	const alreadyBooked = await prisma.affiliateCommission.aggregate({
		where: { partnerId, kind: 'REVSHARE', status: { not: 'VOID' } },
		_sum: { basisAmount: true }
	});

	const unbookedGgr = Math.max(0, book.stats.ggr - money(alreadyBooked._sum.basisAmount));
	const amount = Number(((unbookedGgr * money(book.partner.revSharePercent)) / 100).toFixed(4));

	if (amount <= 0) {
		throw new Error('No unbooked rev share to record');
	}

	return prisma.affiliateCommission.create({
		data: {
			partnerId,
			kind: 'REVSHARE',
			amount,
			basisAmount: unbookedGgr,
			status: 'PENDING'
		}
	});
}
