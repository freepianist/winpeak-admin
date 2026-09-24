import { prisma } from '@/lib/db';
import { badRequest, notFound, requireMarketing, unauthorized } from '@/lib/admin-auth';
import { serializePayout } from '@/lib/affiliates';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
	const session = await requireMarketing();

	if (!session) {
		return unauthorized();
	}

	const { id } = await context.params;
	const body = (await request.json()) as { status?: string; note?: string };
	const status = String(body.status || '').toUpperCase();

	if (status && status !== 'PENDING' && status !== 'SENT') {
		return badRequest('Status must be PENDING or SENT');
	}

	const existing = await prisma.affiliatePayout.findUnique({ where: { id } });

	if (!existing) {
		return notFound('Payout not found');
	}

	const updated = await prisma.affiliatePayout.update({
		where: { id },
		data: {
			...(status ? { status: status as 'PENDING' | 'SENT' } : {}),
			...(body.note !== undefined ? { note: String(body.note).trim() || null } : {})
		},
		include: {
			partner: { select: { name: true, email: true, code: true } },
			_count: { select: { commissions: true } }
		}
	});

	return Response.json(serializePayout(updated));
}
