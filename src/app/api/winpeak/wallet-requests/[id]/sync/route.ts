import { badRequest, notFound, requireAdmin, unauthorized } from '@/lib/admin-auth';
import { serializeWalletRequest } from '@/lib/serializers';
import { syncWalletRequest } from '@/lib/wallet';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
	const session = await requireAdmin();

	if (!session) {
		return unauthorized();
	}

	const { id } = await context.params;
	const reviewedBy = session.db?.email || session.user?.email || 'admin';

	try {
		const result = await syncWalletRequest(id, reviewedBy);
		return Response.json({
			...serializeWalletRequest(result.request),
			syncChanged: result.changed,
			syncMessage: result.message
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Could not sync request';

		if (message === 'Request not found') {
			return notFound(message);
		}

		return badRequest(message);
	}
}
