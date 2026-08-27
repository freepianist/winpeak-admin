import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ALLOWED = [
	/^\/$/,
	/^\/401\/?$/,
	/^\/404\/?$/,
	/^\/sign-in(\/|$)/,
	/^\/sign-up(\/|$)/,
	/^\/sign-out(\/|$)/,
	/^\/auth(\/|$)/,
	/^\/dashboards\/?$/,
	/^\/dashboards\/(winpeak|marketing|partner)(\/|$)/,
	/^\/apps\/(players|wallet-requests|ledger|games|blog|comments|reviews|stories|inbox|subscribers|partners|commissions|payouts|partner|managers|promos|blocked-countries)(\/|$)/,
	/^\/api\/winpeak(\/|$)/,
	/^\/api\/mock\/auth(\/|$)/,
	/^\/api\/mock\/users(\/|$)/
];

export function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	if (ALLOWED.some((pattern) => pattern.test(pathname))) {
		return NextResponse.next();
	}

	return NextResponse.redirect(new URL('/404', request.url));
}

export const config = {
	matcher: ['/((?!_next/static|_next/image|favicon.png|assets/|images/|uploads/|card.png|manifest.json).*)']
};
