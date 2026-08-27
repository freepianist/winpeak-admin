import { prisma } from '@/lib/db';
import { badRequest, notFound, requireAdmin, unauthorized } from '@/lib/admin-auth';
import { normalizeCountry } from '@/lib/countries';

type RouteContext = { params: Promise<{ code: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
	const session = await requireAdmin();

	if (!session) {
		return unauthorized();
	}

	const { code: raw } = await context.params;
	const code = normalizeCountry(raw);

	if (!code) {
		return badRequest('Invalid country code');
	}

	const existing = await prisma.blockedCountry.findUnique({ where: { code } });

	if (!existing) {
		return notFound('Country is not on the block list');
	}

	await prisma.blockedCountry.delete({ where: { code } });
	return Response.json({ success: true, code });
}
