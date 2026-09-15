import { prisma } from '@/lib/db';
import { requireAffiliate, unauthorized } from '@/lib/admin-auth';
import { getPartnerBook, maskEmail, serializeCommission, serializePartner, serializePayout } from '@/lib/affiliates';

export async function GET() {
	const access = await requireAffiliate();

	if (!access) {
		return unauthorized();
	}

	const book = await getPartnerBook(access.partner.id);

	if (!book) {
		return unauthorized();
	}

	const [commissions, payouts] = await Promise.all([
		prisma.affiliateCommission.findMany({
			where: { partnerId: access.partner.id },
			orderBy: { createdAt: 'desc' },
			include: { user: { select: { firstName: true, lastName: true, email: true } } }
		}),
		prisma.affiliatePayout.findMany({
			where: { partnerId: access.partner.id },
			orderBy: { createdAt: 'desc' }
		})
	]);

	return Response.json({
		partner: serializePartner(book.partner),
		stats: book.stats,
		players: book.players.map((player, index) => ({
			id: player.id,
			label: `Player ${index + 1}`,
			displayName: `${player.firstName} ${player.lastName.slice(0, 1)}.`.trim(),
			email: maskEmail(player.email),
			joinedAt: player.createdAt.toISOString(),
			firstDepositAt: player.firstDepositAt?.toISOString() || null,
			qualified: Boolean(player.firstDepositAt)
		})),
		commissions: commissions.map((row) => serializeCommission({ ...row, maskPlayer: true })),
		payouts: payouts.map(serializePayout),
		clicks: book.clicks,
		clickSeries: book.clickSeries
	});
}
