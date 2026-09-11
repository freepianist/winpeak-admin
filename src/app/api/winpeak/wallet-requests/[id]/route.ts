import { badRequest, notFound, requireAdmin, unauthorized } from '@/lib/admin-auth';
import { serializeWalletRequest } from '@/lib/serializers';
import { approveWalletRequest, parseCreditedUsd, rejectWalletRequest } from '@/lib/wallet';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
	const session = await requireAdmin();

	if (!session) {
		return unauthorized();
	}

	const { id } = await context.params;
	const body = (await request.json()) as {
		status?: string;
		reviewNote?: string;
		creditedAmount?: unknown;
	};
	const status = String(body.status || '').toUpperCase();
	const reviewedBy = session.db?.email || session.user?.email || 'admin';

	try {
		if (status === 'APPROVED') {
			const creditedAmount = parseCreditedUsd(body.creditedAmount);
			const updated = await approveWalletRequest(id, reviewedBy, body.reviewNote, creditedAmount);
			return Response.json(serializeWalletRequest(updated));
		}

		if (status === 'REJECTED') {
			const updated = await rejectWalletRequest(id, reviewedBy, body.reviewNote);
			return Response.json(serializeWalletRequest(updated));
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Could not update request';

		if (message === 'Request not found') {
			return notFound(message);
		}

		return badRequest(message);
	}

	return badRequest('Status must be APPROVED or REJECTED');
}
