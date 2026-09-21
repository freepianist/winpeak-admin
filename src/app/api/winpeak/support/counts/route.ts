import { prisma } from '@/lib/db';
import { requireSupport, unauthorized } from '@/lib/admin-auth';
import type { SupportStatus } from '@/lib/support';

/// Totals behind each queue filter. The list endpoint only ever returns the slice
/// the agent is looking at, so without this the tabs could not say how much work is
/// piling up behind the ones they are not.
export async function GET() {
	const session = await requireSupport();

	if (!session) {
		return unauthorized();
	}

	const rows = await prisma.supportConversation.groupBy({
		by: ['status'],
		_count: { _all: true }
	});

	const counts: Record<SupportStatus, number> = { BOT: 0, WAITING_AGENT: 0, AGENT: 0, RESOLVED: 0 };

	rows.forEach((row) => {
		counts[row.status] = row._count._all;
	});

	return Response.json({ ...counts, OPEN: counts.WAITING_AGENT + counts.AGENT });
}
