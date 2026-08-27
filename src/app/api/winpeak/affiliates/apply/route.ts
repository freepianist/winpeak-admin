import { prisma } from '@/lib/db';
import { badRequest } from '@/lib/admin-auth';
import { hashAffiliatePassword, makeAffiliateCode } from '@/lib/affiliates';
import { rateLimited, requestIp } from '@/lib/rate-limit';

export async function POST(request: Request) {
	if (rateLimited(`affiliate-apply:${requestIp(request)}`, 5, 60 * 60 * 1000)) {
		return Response.json({ error: 'Too many applications. Try again later.' }, { status: 429 });
	}

	const body = (await request.json()) as {
		name?: string;
		email?: string;
		password?: string;
		notes?: string;
	};

	const name = String(body.name || '').trim();
	const email = String(body.email || '')
		.trim()
		.toLowerCase();
	const password = String(body.password || '');
	const notes = String(body.notes || '').trim();
	const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

	if (!name || !email || !password) {
		return badRequest('Name, email, and password are required');
	}

	if (password.length < 8) {
		return badRequest('Password must be at least 8 characters');
	}

	if (adminEmail && email === adminEmail) {
		return badRequest('Use the staff sign-in for that email');
	}

	const existing = await prisma.affiliatePartner.findUnique({ where: { email } });

	if (existing) {
		if (existing.status === 'INVITED') {
			return badRequest('This email is already waiting for staff approval');
		}

		return badRequest('An account with this email already exists');
	}

	let code = makeAffiliateCode(name);

	while (await prisma.affiliatePartner.findUnique({ where: { code } })) {
		code = makeAffiliateCode(name);
	}

	await prisma.affiliatePartner.create({
		data: {
			name,
			email,
			code,
			dealType: 'HYBRID',
			cpaAmount: 0,
			revSharePercent: 0,
			notes: notes || 'Self-signup. Set deal terms before or after approval.',
			passwordHash: await hashAffiliatePassword(password),
			status: 'INVITED'
		}
	});

	return Response.json({
		ok: true,
		message: 'Application submitted. A staff admin must approve your account before you can sign in.'
	});
}
