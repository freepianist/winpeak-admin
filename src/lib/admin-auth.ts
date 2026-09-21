import { auth } from '@auth/authJs';
import { prisma } from '@/lib/db';

function rolesOf(role: string[] | string | null | undefined) {
	if (!role) return [];

	return Array.isArray(role) ? role : [role];
}

export async function requireAdmin() {
	const session = await auth();
	const roles = rolesOf(session?.db?.role);

	if (!session?.db || !roles.includes('admin')) {
		return null;
	}

	return session;
}

export async function requireMarketing() {
	const session = await auth();
	const roles = rolesOf(session?.db?.role);

	if (!session?.db || (!roles.includes('admin') && !roles.includes('affiliate_manager'))) {
		return null;
	}

	return session;
}

export async function requireSupport() {
	const session = await auth();
	const roles = rolesOf(session?.db?.role);

	if (!session?.db || (!roles.includes('admin') && !roles.includes('support_agent'))) {
		return null;
	}

	return session;
}

export async function requireAffiliate() {
	const session = await auth();
	const roles = rolesOf(session?.db?.role);

	if (!session?.db || !roles.includes('affiliate')) {
		return null;
	}

	const email = session.db.email || session.user?.email;

	if (!email) {
		return null;
	}

	const partner = await prisma.affiliatePartner.findUnique({
		where: { email: email.toLowerCase() }
	});

	if (!partner || partner.status !== 'ACTIVE') {
		return null;
	}

	return { session, partner };
}

export async function requireAdminOrAffiliate() {
	const marketing = await requireMarketing();

	if (marketing) {
		return { session: marketing, partner: null, isAdmin: true as const };
	}

	const affiliate = await requireAffiliate();

	if (affiliate) {
		return { ...affiliate, isAdmin: false as const };
	}

	return null;
}

export function unauthorized() {
	return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

export function badRequest(message: string) {
	return Response.json({ error: message }, { status: 400 });
}

export function notFound(message = 'Not found') {
	return Response.json({ error: message }, { status: 404 });
}
