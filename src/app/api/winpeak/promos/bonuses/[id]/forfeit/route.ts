import { prisma } from '@/lib/db';
import { badRequest, notFound, requireAdmin, unauthorized } from '@/lib/admin-auth';
import { forfeitActiveBonus, serializePlayerBonus } from '@/lib/promos';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
	const session = await requireAdmin();

	if (!session) {
		return unauthorized();
	}

	const { id } = await context.params;
	const bonus = await prisma.playerBonus.findUnique({
		where: { id },
		include: {
			offer: { select: { name: true, kind: true } },
			user: { select: { firstName: true, lastName: true, email: true } }
		}
	});

	if (!bonus) {
		return notFound('Bonus not found');
	}

	if (bonus.status !== 'ACTIVE') {
		return badRequest('That bonus is no longer active');
	}

	await forfeitActiveBonus(bonus.userId, 'Forfeited by staff');
	const updated = await prisma.playerBonus.findUnique({
		where: { id },
		include: {
			offer: { select: { name: true, kind: true } },
			user: { select: { firstName: true, lastName: true, email: true } }
		}
	});

	return Response.json(serializePlayerBonus(updated || bonus));
}
