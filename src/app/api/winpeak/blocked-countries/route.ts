import { prisma } from '@/lib/db';
import { badRequest, requireAdmin, unauthorized } from '@/lib/admin-auth';
import { countryLabel, normalizeCountry } from '@/lib/countries';

function serializeBlockedCountry(row: { code: string; note: string | null; createdAt: Date; updatedAt: Date }) {
	return {
		code: row.code,
		name: countryLabel(row.code),
		note: row.note || '',
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString()
	};
}

export async function GET() {
	const session = await requireAdmin();

	if (!session) {
		return unauthorized();
	}

	const countries = await prisma.blockedCountry.findMany({
		orderBy: { code: 'asc' }
	});

	return Response.json(countries.map(serializeBlockedCountry));
}

export async function POST(request: Request) {
	const session = await requireAdmin();

	if (!session) {
		return unauthorized();
	}

	const body = (await request.json()) as { code?: string; note?: string };
	const code = normalizeCountry(body.code);

	if (!code) {
		return badRequest('Enter a valid ISO country code, for example US or GB');
	}

	const existing = await prisma.blockedCountry.findUnique({ where: { code } });

	if (existing) {
		return badRequest(`${countryLabel(code)} is already blocked`);
	}

	const note = body.note?.trim() || countryLabel(code) || null;
	const created = await prisma.blockedCountry.create({
		data: { code, note }
	});

	return Response.json(serializeBlockedCountry(created));
}
