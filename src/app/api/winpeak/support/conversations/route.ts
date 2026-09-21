import type { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/db';
import { requireSupport, unauthorized } from '@/lib/admin-auth';
import { isSupportStatus, serializeSupportConversation } from '@/lib/support';

/// The agent queue. Threads still being handled by the bot are hidden by default:
/// staff only need to see what has been escalated to them, and the full list is a
/// deliberate `?status=` away.
export async function GET(request: Request) {
	const session = await requireSupport();

	if (!session) {
		return unauthorized();
	}

	const status = new URL(request.url).searchParams.get('status') || '';
	const where: Prisma.SupportConversationWhereInput = isSupportStatus(status)
		? { status }
		: { status: { in: ['WAITING_AGENT', 'AGENT'] } };

	const conversations = await prisma.supportConversation.findMany({
		where,
		orderBy: { lastMessageAt: 'desc' },
		take: 200,
		include: {
			messages: {
				orderBy: { createdAt: 'desc' },
				take: 1,
				select: { body: true, author: true }
			}
		}
	});

	return Response.json(
		conversations.map((conversation) =>
			serializeSupportConversation(conversation, {
				preview: conversation.messages[0]?.body.slice(0, 140) || '',
				previewAuthor: conversation.messages[0]?.author || null
			})
		)
	);
}
