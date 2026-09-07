import { prisma } from '@/lib/db';
import { requireAdmin, unauthorized } from '@/lib/admin-auth';

export async function GET() {
	const session = await requireAdmin();

	if (!session) {
		return unauthorized();
	}

	const reviews = await prisma.gameReview.findMany({
		orderBy: { createdAt: 'desc' },
		include: {
			replies: { orderBy: { createdAt: 'asc' } },
			user: { select: { firstName: true, lastName: true, email: true } }
		}
	});

	return Response.json(
		reviews.map((review) => ({
			id: review.id,
			source: review.source,
			providerId: review.providerId,
			gameCode: review.gameCode,
			userId: review.userId,
			playerName: review.user ? `${review.user.firstName} ${review.user.lastName}` : review.authorName,
			authorName: review.authorName,
			authorEmail: review.authorEmail,
			rating: review.rating,
			content: review.content,
			createdAt: review.createdAt.toISOString(),
			replyCount: review.replies.length,
			replies: review.replies.map((reply) => ({
				id: reply.id,
				authorName: reply.authorName,
				content: reply.content,
				createdAt: reply.createdAt.toISOString()
			}))
		}))
	);
}

export async function DELETE(request: Request) {
	const session = await requireAdmin();

	if (!session) {
		return unauthorized();
	}

	const body = (await request.json()) as { ids?: string[] };
	const ids = body.ids || [];

	if (ids.length) {
		await prisma.gameReview.deleteMany({ where: { id: { in: ids } } });
	}

	return Response.json({ success: true });
}
