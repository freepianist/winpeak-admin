import { requireAdmin, unauthorized } from '@/lib/admin-auth';
import { runWeeklyCashback } from '@/lib/promos';

export async function POST() {
	const session = await requireAdmin();

	if (!session) {
		return unauthorized();
	}

	const result = await runWeeklyCashback();

	return Response.json({
		credited: result.credited,
		amount: result.amount,
		scanned: result.scanned,
		periodStart: result.periodStart.toISOString(),
		periodEnd: result.periodEnd.toISOString()
	});
}
