import { prisma } from '@/lib/db';
import { badRequest, notFound, requireAdmin, unauthorized } from '@/lib/admin-auth';
import { getPlayerOrThrow, serializeLedger, serializeUser } from '@/lib/serializers';
import { serializePlayerBonus } from '@/lib/promos';
import { normalizeEmail } from '@/lib/password';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
	const session = await requireAdmin();

	if (!session) {
		return unauthorized();
	}

	const { id } = await context.params;
	const user = await getPlayerOrThrow(id);

	if (!user) {
		return notFound('Player not found');
	}

	const [ledger, bonuses] = await Promise.all([
		prisma.ledgerEntry.findMany({
			where: { userId: id },
			orderBy: { createdAt: 'desc' },
			take: 100,
			include: { user: { select: { firstName: true, lastName: true, email: true } } }
		}),
		prisma.playerBonus.findMany({
			where: { userId: id },
			orderBy: { grantedAt: 'desc' },
			include: {
				offer: { select: { name: true, kind: true } },
				user: { select: { firstName: true, lastName: true, email: true } }
			}
		})
	]);

	return Response.json({
		...serializeUser(user),
		ledger: ledger.map(serializeLedger),
		bonuses: bonuses.map(serializePlayerBonus),
		activeBonus: bonuses.find((row) => row.status === 'ACTIVE')
			? serializePlayerBonus(bonuses.find((row) => row.status === 'ACTIVE')!)
			: null
	});
}

export async function PATCH(request: Request, context: RouteContext) {
	const session = await requireAdmin();

	if (!session) {
		return unauthorized();
	}

	const { id } = await context.params;
	const user = await getPlayerOrThrow(id);

	if (!user) {
		return notFound('Player not found');
	}

	const body = (await request.json()) as {
		firstName?: string;
		lastName?: string;
		email?: string;
		status?: 'ACTIVE' | 'SUSPENDED';
		notes?: string;
	};

	const firstName = body.firstName?.trim();
	const lastName = body.lastName?.trim();
	const email = body.email ? normalizeEmail(body.email) : undefined;

	if (email && email !== user.email) {
		const existing = await prisma.user.findUnique({ where: { email } });

		if (existing) {
			return badRequest('Another player already uses that email');
		}
	}

	if (body.status && body.status !== 'ACTIVE' && body.status !== 'SUSPENDED') {
		return badRequest('Invalid status');
	}

	const updated = await prisma.user.update({
		where: { id },
		data: {
			...(firstName ? { firstName } : {}),
			...(lastName ? { lastName } : {}),
			...(email ? { email } : {}),
			...(body.status ? { status: body.status } : {}),
			...(body.notes !== undefined ? { notes: body.notes } : {})
		},
		include: {
			wallet: true,
			_count: { select: { ledger: true, reviews: true } }
		}
	});

	return Response.json(serializeUser(updated));
}
