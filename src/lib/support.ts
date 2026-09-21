import type { Session } from 'next-auth';

export type SupportStatus = 'BOT' | 'WAITING_AGENT' | 'AGENT' | 'RESOLVED';

export const SUPPORT_STATUSES: SupportStatus[] = ['BOT', 'WAITING_AGENT', 'AGENT', 'RESOLVED'];

export function isSupportStatus(value: string): value is SupportStatus {
	return (SUPPORT_STATUSES as string[]).includes(value);
}

/// Identity stamped onto an agent reply. `session.db.id` is the StaffAccount id for
/// support staff and the email for the env-configured admin, which is enough to tell
/// two agents apart in a transcript.
export function agentIdentity(session: Session) {
	return {
		id: String(session.db?.id || session.user?.email || 'agent'),
		name: String(session.db?.displayName || session.user?.name || 'Support agent')
	};
}

export function serializeSupportMessage(message: {
	id: string;
	author: string;
	body: string;
	authorName: string;
	createdAt: Date;
}) {
	return {
		id: message.id,
		author: message.author,
		body: message.body,
		authorName: message.authorName,
		createdAt: message.createdAt.toISOString()
	};
}

export function serializeSupportConversation(
	conversation: {
		id: string;
		userId: string | null;
		email: string;
		name: string;
		status: string;
		assignedStaffId: string | null;
		assignedStaffName: string;
		handoffReason: string;
		lastMessageAt: Date;
		unreadForAgent: number;
		createdAt: Date;
	},
	extras: Record<string, unknown> = {}
) {
	return {
		id: conversation.id,
		userId: conversation.userId,
		email: conversation.email,
		name: conversation.name || (conversation.userId ? 'Player' : 'Guest'),
		isGuest: !conversation.userId,
		status: conversation.status,
		assignedStaffId: conversation.assignedStaffId,
		assignedStaffName: conversation.assignedStaffName,
		handoffReason: conversation.handoffReason,
		lastMessageAt: conversation.lastMessageAt.toISOString(),
		unreadForAgent: conversation.unreadForAgent,
		createdAt: conversation.createdAt.toISOString(),
		...extras
	};
}
