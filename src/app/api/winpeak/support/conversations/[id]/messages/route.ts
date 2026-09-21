import { prisma } from '@/lib/db';
import { badRequest, notFound, requireSupport, unauthorized } from '@/lib/admin-auth';
import { agentIdentity, serializeSupportMessage } from '@/lib/support';

type RouteContext = { params: Promise<{ id: string }> };

const MAX_MESSAGE_LENGTH = 2000;

/// An agent reply. Sending one takes ownership of the thread, so an agent never has
/// to remember to claim it first, and it takes the conversation out of BOT mode for
/// good — the player site checks the same status before letting the AI answer.
export async function POST(request: Request, context: RouteContext) {
	const session = await requireSupport();

	if (!session) {
		return unauthorized();
	}

	const { id } = await context.params;
	const conversation = await prisma.supportConversation.findUnique({ where: { id } });

	if (!conversation) {
		return notFound('Conversation not found');
	}

	const payload = (await request.json()) as { body?: string };
	const body = String(payload.body || '')
		.trim()
		.slice(0, MAX_MESSAGE_LENGTH);

	if (!body) {
		return badRequest('Message is required');
	}

	const agent = agentIdentity(session);

	const [message] = await prisma.$transaction([
		prisma.supportMessage.create({
			data: {
				conversationId: id,
				author: 'AGENT',
				body,
				authorName: agent.name,
				staffId: agent.id
			}
		}),
		prisma.supportConversation.update({
			where: { id },
			data: {
				status: 'AGENT',
				assignedStaffId: conversation.assignedStaffId || agent.id,
				assignedStaffName: conversation.assignedStaffName || agent.name,
				lastMessageAt: new Date(),
				unreadForVisitor: { increment: 1 },
				unreadForAgent: 0
			}
		})
	]);

	return Response.json(serializeSupportMessage(message));
}
