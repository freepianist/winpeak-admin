import { prisma } from '@/lib/db';
import { badRequest, notFound, requireAdmin, unauthorized } from '@/lib/admin-auth';
import { hashPassword, validatePassword } from '@/lib/password';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
	const session = await requireAdmin();

	if (!session) {
		return unauthorized();
	}

	const { id } = await context.params;
	const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });

	if (!user) {
		return notFound('Player not found');
	}

	const body = (await request.json()) as { password?: string };
	const password = String(body.password || '');
	const passwordError = validatePassword(password);

	if (passwordError) {
		return badRequest(passwordError);
	}

	await prisma.user.update({
		where: { id },
		data: {
			passwordHash: await hashPassword(password),
			sessionVersion: { increment: 1 }
		}
	});

	return Response.json({ success: true });
}
