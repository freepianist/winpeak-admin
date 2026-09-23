import { requireAffiliate, unauthorized } from '@/lib/admin-auth';
import { getClicksPage } from '@/lib/affiliates';

export async function GET(request: Request) {
	const access = await requireAffiliate();

	if (!access) {
		return unauthorized();
	}

	const { searchParams } = new URL(request.url);

	const result = await getClicksPage(access.partner.id, {
		page: Number(searchParams.get('page')),
		pageSize: Number(searchParams.get('pageSize')),
		visitType: searchParams.get('visitType') || undefined,
		search: searchParams.get('search') || undefined,
		sort: searchParams.get('sort') === 'asc' ? 'asc' : 'desc'
	});

	return Response.json(result);
}
