import { prisma } from '@/lib/db';
import { badRequest, notFound, requireSupport, unauthorized } from '@/lib/admin-auth';
import { agentIdentity, serializeSupportConversation, serializeSupportMessage } from '@/lib/support';

type RouteContext = { params: Promise<{ id: string }> };

const ACTIONS = ['claim', 'release', 'resolve', 'reopen'] as const;

type Action = (typeof ACTIONS)[number];

export async function GET(_request: Request, context: RouteContext) {
	const session = await requireSupport();

	if (!session) {
		return unauthorized();
	}

	const { id } = await context.params;
	const conversation = await prisma.supportConversation.findUnique({
		where: { id },
		include: { messages: { orderBy: { createdAt: 'asc' } } }
	});

	if (!conversation) {
		return notFound('Conversation not found');
	}

	// Opening the thread is what clears the queue badge; the visitor's own unread
	// count is left alone because they have not read anything.
	if (conversation.unreadForAgent > 0) {
		await prisma.supportConversation.update({
			where: { id },
			data: { unreadForAgent: 0 }
		});
	}

	const player = conversation.userId
		? await prisma.user.findUnique({
				where: { id: conversation.userId },
				select: {
					id: true,
					email: true,
					firstName: true,
					lastName: true,
					status: true,
					emailVerifiedAt: true,
					createdAt: true
				}
			})
		: null;

	return Response.json({
		...serializeSupportConversation({ ...conversation, unreadForAgent: 0 }),
		player: player
			? {
					id: player.id,
					email: player.email,
					name: `${player.firstName} ${player.lastName}`.trim(),
					status: player.status,
					emailVerified: Boolean(player.emailVerifiedAt),
					createdAt: player.createdAt.toISOString()
				}
			: null,
		messages: conversation.messages.map(serializeSupportMessage)
	});
}

export async function PATCH(request: Request, context: RouteContext) {
	const session = await requireSupport();

	if (!session) {
		return unauthorized();
	}

	const { id } = await context.params;
	const existing = await prisma.supportConversation.findUnique({ where: { id } });

	if (!existing) {
		return notFound('Conversation not found');
	}

	const body = (await request.json()) as { action?: string };
	const action = String(body.action || '') as Action;

	if (!ACTIONS.includes(action)) {
		return badRequest(`Action must be one of ${ACTIONS.join(', ')}`);
	}

	const agent = agentIdentity(session);
	const data =
		action === 'claim'
			? { status: 'AGENT' as const, assignedStaffId: agent.id, assignedStaffName: agent.name }
			: action === 'release'
				? {
						status: 'WAITING_AGENT' as const,
						assignedStaffId: null,
						assignedStaffName: ''
					}
				: action === 'resolve'
					? { status: 'RESOLVED' as const }
					: // Reopening drops the assignment so the thread goes back on the queue
						// rather than silently landing with whoever closed it.
						{
							status: 'WAITING_AGENT' as const,
							assignedStaffId: null,
							assignedStaffName: ''
						};

	const updated = await prisma.supportConversation.update({ where: { id }, data });

	return Response.json(serializeSupportConversation(updated));
}

export async function DELETE(_request: Request, context: RouteContext) {
	const session = await requireSupport();

	if (!session) {
		return unauthorized();
	}

	const { id } = await context.params;
	await prisma.supportConversation.delete({ where: { id } }).catch(() => null);

	return Response.json({ success: true });
}
