import { prisma } from '@/lib/db';
import { requireAdmin, unauthorized } from '@/lib/admin-auth';
import { serializeWalletRequest } from '@/lib/serializers';

export async function GET(request: Request) {
	const session = await requireAdmin();

	if (!session) {
		return unauthorized();
	}

	const { searchParams } = new URL(request.url);
	const status = searchParams.get('status')?.toUpperCase();
	const userId = searchParams.get('userId') || undefined;

	const rows = await prisma.walletRequest.findMany({
		where: {
			...(status === 'PENDING' || status === 'PROCESSING' || status === 'APPROVED' || status === 'REJECTED'
				? { status: status as 'PENDING' | 'PROCESSING' | 'APPROVED' | 'REJECTED' }
				: {}),
			...(userId ? { userId } : {})
		},
		orderBy: { createdAt: 'desc' },
		take: 200,
		include: {
			user: {
				select: {
					firstName: true,
					lastName: true,
					email: true,
					wallet: { select: { currency: true } }
				}
			}
		}
	});

	return Response.json(rows.map(serializeWalletRequest));
}
