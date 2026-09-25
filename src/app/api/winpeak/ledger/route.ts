import { prisma } from '@/lib/db';
import { requireAdmin, unauthorized } from '@/lib/admin-auth';
import { serializeLedger } from '@/lib/serializers';
import type { LedgerKind } from '@/generated/prisma';

export async function GET(request: Request) {
	const session = await requireAdmin();

	if (!session) {
		return unauthorized();
	}

	const { searchParams } = new URL(request.url);
	const kind = searchParams.get('kind') as LedgerKind | null;
	const userId = searchParams.get('userId');

	const entries = await prisma.ledgerEntry.findMany({
		where: {
			...(kind ? { kind } : {}),
			...(userId ? { userId } : {})
		},
		orderBy: { createdAt: 'desc' },
		take: 2000,
		include: {
			user: { select: { firstName: true, lastName: true, email: true, wallet: { select: { currency: true } } } }
		}
	});

	return Response.json(entries.map(serializeLedger));
}
