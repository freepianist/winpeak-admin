import { prisma } from '@/lib/db';
import { money } from '@/lib/money';
import { requireAdmin, unauthorized } from '@/lib/admin-auth';

export async function GET() {
	const session = await requireAdmin();

	if (!session) {
		return unauthorized();
	}

	const [entries, reviews] = await Promise.all([
		prisma.ledgerEntry.findMany({
			// `internal` entries are deposits and bonuses, which belong to no game even
			// on the rare row that carries a gameCode.
			where: { gameCode: { not: null }, source: { not: 'internal' } },
			select: { source: true, providerId: true, gameCode: true, kind: true, amount: true }
		}),
		// Aggregated in memory rather than with groupBy because plays and reviews live
		// in separate tables and have to be folded into one row per game.
		prisma.gameReview.findMany({
			select: { source: true, providerId: true, gameCode: true, rating: true }
		})
	]);

	type GameStat = {
		source: string;
		providerId: string | null;
		gameCode: string;
		bets: number;
		wins: number;
		rounds: number;
		reviews: number;
		ratingTotal: number;
		avgRating: number;
	};

	const games = new Map<string, GameStat>();

	const bucket = (
		row: { source: string; providerId: string | null },
		gameCode: string
	) => {
		// A vendor code can hold anything, so the parts are joined on a separator that
		// cannot appear in one.
		const mapKey = `${row.source}\u0000${row.providerId ?? ''}\u0000${gameCode}`;
		const current =
			games.get(mapKey) ||
			{
				source: row.source,
				providerId: row.providerId,
				gameCode,
				bets: 0,
				wins: 0,
				rounds: 0,
				reviews: 0,
				ratingTotal: 0,
				avgRating: 0
			};
		games.set(mapKey, current);
		return current;
	};

	for (const entry of entries) {
		const current = bucket(entry, entry.gameCode || '');

		if (entry.kind === 'BET') {
			current.bets += money(entry.amount);
			current.rounds += 1;
		}

		if (entry.kind === 'WIN') {
			current.wins += money(entry.amount);
		}
	}

	for (const review of reviews) {
		const current = bucket(review, review.gameCode);
		current.reviews += 1;
		current.ratingTotal += review.rating;
	}

	for (const game of games.values()) {
		game.avgRating = game.reviews > 0 ? game.ratingTotal / game.reviews : 0;
	}

	return Response.json(
		Array.from(games.values())
			.map(({ ratingTotal: _ratingTotal, ...game }) => ({
				...game,
				ggr: game.bets - game.wins
			}))
			.sort((a, b) => b.bets - a.bets)
	);
}
