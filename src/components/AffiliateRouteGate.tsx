'use client';

import { ReactNode, useEffect } from 'react';
import FuseLoading from '@fuse/core/FuseLoading';
import usePathname from '@fuse/hooks/usePathname';
import useNavigate from '@fuse/hooks/useNavigate';
import useUser from '@auth/useUser';

const PARTNER_PREFIXES = ['/dashboards/partner', '/apps/partner'];
const MARKETING_PREFIXES = ['/dashboards/marketing', '/apps/partners', '/apps/commissions', '/apps/payouts'];
const SUPPORT_PREFIXES = ['/apps/support'];

function matchesPrefix(pathname: string, prefixes: string[]) {
	return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function AffiliateRouteGate({ children }: { children: ReactNode }) {
	const { data: user } = useUser();
	const pathname = usePathname();
	const navigate = useNavigate();
	const roles = Array.isArray(user?.role) ? user.role : user?.role ? [user.role] : [];
	const isAffiliateOnly = roles.includes('affiliate') && !roles.includes('admin');
	const isManagerOnly =
		roles.includes('affiliate_manager') && !roles.includes('admin') && !roles.includes('affiliate');
	const isSupportOnly = roles.includes('support_agent') && !roles.includes('admin');
	const home = isAffiliateOnly ? '/dashboards/partner' : isSupportOnly ? '/apps/support' : '/dashboards/marketing';
	const blocked =
		(isAffiliateOnly && !matchesPrefix(pathname, PARTNER_PREFIXES)) ||
		(isManagerOnly && !matchesPrefix(pathname, MARKETING_PREFIXES)) ||
		(isSupportOnly && !matchesPrefix(pathname, SUPPORT_PREFIXES));

	useEffect(() => {
		if (blocked) {
			navigate(home);
		}
	}, [blocked, home, navigate]);

	if (blocked) {
		return <FuseLoading />;
	}

	return children;
}

export default AffiliateRouteGate;
