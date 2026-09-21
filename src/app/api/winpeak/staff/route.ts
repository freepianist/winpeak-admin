import { prisma } from '@/lib/db';
import { badRequest, requireAdmin, unauthorized } from '@/lib/admin-auth';
import { hashAffiliatePassword, makeTempPassword } from '@/lib/affiliates';

function serializeStaff(
	row: {
		id: string;
		email: string;
		name: string;
		role: string;
		status: string;
		createdAt: Date;
		updatedAt: Date;
	},
	extras: Record<string, unknown> = {}
) {
	return {
		id: row.id,
		email: row.email,
		name: row.name,
		role: row.role,
		status: row.status,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		...extras
	};
}

export async function GET() {
	const session = await requireAdmin();

	if (!session) {
		return unauthorized();
	}

	const rows = await prisma.staffAccount.findMany({
		orderBy: { createdAt: 'desc' }
	});

	return Response.json(rows.map((row) => serializeStaff(row)));
}

export async function POST(request: Request) {
	const session = await requireAdmin();

	if (!session) {
		return unauthorized();
	}

	const body = (await request.json()) as {
		name?: string;
		email?: string;
		password?: string;
		role?: string;
	};
	const name = String(body.name || '').trim();
	const email = String(body.email || '')
		.trim()
		.toLowerCase();
	const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

	if (!name || !email) {
		return badRequest('Name and email are required');
	}

	if (adminEmail && email === adminEmail) {
		return badRequest('That email is reserved for the staff admin');
	}

	const role = String(body.role || 'AFFILIATE_MANAGER').toUpperCase();

	if (role !== 'AFFILIATE_MANAGER' && role !== 'SUPPORT_AGENT') {
		return badRequest('Role must be AFFILIATE_MANAGER or SUPPORT_AGENT');
	}

	const existing = await prisma.staffAccount.findUnique({ where: { email } });

	if (existing) {
		return badRequest('A staff member with this email already exists');
	}

	const partner = await prisma.affiliatePartner.findUnique({ where: { email } });

	if (partner) {
		return badRequest('That email already belongs to an affiliate partner');
	}

	const password = String(body.password || '').trim() || makeTempPassword();

	if (password.length < 8) {
		return badRequest('Password must be at least 8 characters');
	}

	const staff = await prisma.staffAccount.create({
		data: {
			name,
			email,
			passwordHash: await hashAffiliatePassword(password),
			role,
			status: 'ACTIVE'
		}
	});

	return Response.json(serializeStaff(staff, { temporaryPassword: password }));
}
