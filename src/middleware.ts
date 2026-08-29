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
	/^\/api\/winpeak(\/|$)/
];

const PUBLIC_WHEN_ANON = [
	/^\/$/,
	/^\/401\/?$/,
	/^\/404\/?$/,
	/^\/sign-in(\/|$)/,
	/^\/sign-up(\/|$)/,
	/^\/sign-out(\/|$)/,
	/^\/auth(\/|$)/,
	/^\/api\/winpeak\/affiliates\/apply\/?$/
];

function hasAuthCookie(request: NextRequest) {
	return request.cookies.getAll().some((cookie) => /(?:^|\.)((?:__Secure-)?(?:authjs|next-auth)\.session-token)/.test(cookie.name));
}

export function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	if (!ALLOWED.some((pattern) => pattern.test(pathname))) {
		return NextResponse.redirect(new URL('/404', request.url));
	}

	if (!PUBLIC_WHEN_ANON.some((pattern) => pattern.test(pathname)) && !hasAuthCookie(request)) {
		if (pathname.startsWith('/api/')) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}
		return NextResponse.redirect(new URL('/sign-in', request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ['/((?!_next/static|_next/image|favicon.png|assets/|images/|uploads/|card.png|manifest.json).*)']
};
