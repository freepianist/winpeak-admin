import '@/lib/env-bootstrap';
import NextAuth, { CredentialsSignin } from 'next-auth';
import { createStorage } from 'unstorage';
import memoryDriver from 'unstorage/drivers/memory';
import vercelKVDriver from 'unstorage/drivers/vercel-kv';
import { UnstorageAdapter } from '@auth/unstorage-adapter';
import type { NextAuthConfig } from 'next-auth';
import type { Provider } from 'next-auth/providers';
import Credentials from 'next-auth/providers/credentials';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';
import { readEnv } from '@/lib/env';
import { verifyAffiliatePassword } from '@/lib/affiliates';
import type { User } from '@auth/user';

const STAFF_ROLES = new Set(['admin', 'affiliate_manager', 'affiliate']);

function secretsEqual(left: string, right: string) {
	const a = Buffer.from(left);
	const b = Buffer.from(right);
	const size = Math.max(a.length, b.length, 1);
	const leftPad = Buffer.alloc(size);
	const rightPad = Buffer.alloc(size);
	a.copy(leftPad);
	b.copy(rightPad);
	return timingSafeEqual(leftPad, rightPad) && a.length === b.length;
}

function credentialValue(value: unknown) {
	if (Array.isArray(value)) {
		return String(value[0] ?? '');
	}

	return String(value ?? '');
}

class AccountPendingError extends CredentialsSignin {
	code = 'AccountPending';
}

const storage = createStorage({
	driver: process.env.VERCEL
		? vercelKVDriver({
				url: process.env.AUTH_KV_REST_API_URL,
				token: process.env.AUTH_KV_REST_API_TOKEN,
				env: false
			})
		: memoryDriver()
});

export const providers: Provider[] = [
	Credentials({
		credentials: {
			email: { label: 'Email', type: 'email' },
			password: { label: 'Password', type: 'password' },
			formType: { label: 'Form type', type: 'text' }
		},
		async authorize(formInput) {
			const formType = credentialValue(formInput?.formType) || 'signin';

			if (formType !== 'signin') {
				return null;
			}

			const email = credentialValue(formInput?.email).trim().toLowerCase();
			const password = credentialValue(formInput?.password);
			const adminEmail = readEnv('ADMIN_EMAIL')?.trim().toLowerCase();
			const adminPassword = readEnv('ADMIN_PASSWORD')?.trim();

			if (adminEmail && adminPassword && email && password && email === adminEmail && secretsEqual(password, adminPassword)) {
				return {
					email: adminEmail,
					name: 'WinPeak Admin',
					role: 'admin'
				};
			}

			const managerEmail = readEnv('AFFILIATE_MANAGER_EMAIL')?.trim().toLowerCase();
			const managerPassword = readEnv('AFFILIATE_MANAGER_PASSWORD')?.trim();

			if (
				managerEmail &&
				managerPassword &&
				email &&
				password &&
				email === managerEmail &&
				secretsEqual(password, managerPassword)
			) {
				return {
					email: managerEmail,
					name: 'Affiliate Manager',
					role: 'affiliate_manager'
				};
			}

			if (!email || !password) {
				return null;
			}

			try {
				const staff = await prisma.staffAccount.findUnique({
					where: { email }
				});

				if (
					staff?.passwordHash &&
					staff.status === 'ACTIVE' &&
					staff.role === 'AFFILIATE_MANAGER' &&
					(await verifyAffiliatePassword(password, staff.passwordHash))
				) {
					return {
						email: staff.email,
						name: staff.name,
						role: 'affiliate_manager',
						staffId: staff.id
					};
				}
			} catch (error) {
				console.error('Staff login failed', error);
			}

			try {
				const partner = await prisma.affiliatePartner.findUnique({
					where: { email }
				});

				if (partner?.passwordHash && (await verifyAffiliatePassword(password, partner.passwordHash))) {
					if (partner.status === 'INVITED') {
						throw new AccountPendingError();
					}

					if (partner.status !== 'ACTIVE') {
						return null;
					}

					return {
						email: partner.email,
						name: partner.name,
						role: 'affiliate',
						partnerId: partner.id
					};
				}
			} catch (error) {
				if (error instanceof AccountPendingError) {
					throw error;
				}

				console.error('Affiliate login failed', error);
			}

			return null;
		}
	})
];

const config = {
	theme: { logo: '/assets/images/logo/winpeak-logo.png' },
	adapter: UnstorageAdapter(storage),
	pages: {
		signIn: '/sign-in'
	},
	providers,
	basePath: '/auth',
	trustHost: true,
	callbacks: {
		authorized({ request, auth }) {
			const path = request.nextUrl.pathname;
			if (
				path.startsWith('/sign-in') ||
				path.startsWith('/sign-up') ||
				path.startsWith('/sign-out') ||
				path.startsWith('/auth') ||
				path.startsWith('/api/winpeak/affiliates/apply')
			) {
				return true;
			}
			return Boolean(auth);
		},
		jwt({ token, trigger, account, user }) {
			if (user && trigger !== 'update') {
				const signedIn = user as {
					role?: string;
					partnerId?: string;
					staffId?: string;
					name?: string | null;
				};
				token.role = signedIn.role && STAFF_ROLES.has(signedIn.role) ? signedIn.role : '';
				token.partnerId = signedIn.partnerId;
				token.staffId = signedIn.staffId;
				token.name = signedIn.name || token.name;
			}

			if (trigger === 'update' && user) {
				const patch = user as {
					name?: string | null;
					displayName?: string;
					settings?: unknown;
					shortcuts?: string[];
				};
				if (patch.name) token.name = patch.name;
				if (patch.displayName) token.name = patch.displayName;
				if (patch.settings) token.settings = patch.settings;
				if (patch.shortcuts) token.shortcuts = patch.shortcuts;
			}

			if (account?.provider === 'keycloak') {
				return { ...token, accessToken: account.access_token };
			}

			return token;
		},
		async session({ session, token }) {
			if (token.accessToken && typeof token.accessToken === 'string') {
				session.accessToken = token.accessToken;
			}

			const settings = ((token.settings as User['settings']) || {}) as User['settings'];
			const shortcuts = Array.isArray(token.shortcuts) ? (token.shortcuts as string[]) : [];

			if (token.role === 'affiliate') {
				session.db = {
					id: String(token.partnerId || ''),
					role: ['affiliate'],
					displayName: String(token.name || 'Partner'),
					email: session.user.email,
					photoURL: '',
					shortcuts,
					settings,
					loginRedirectUrl: '/dashboards/partner'
				};
				return session;
			}

			if (token.role === 'affiliate_manager') {
				session.db = {
					id: String(token.staffId || token.email || 'affiliate-manager'),
					role: ['affiliate_manager'],
					displayName: String(token.name || 'Affiliate manager'),
					email: session.user.email,
					photoURL: '',
					shortcuts: shortcuts.length ? shortcuts : ['dashboards.marketing', 'apps.partners'],
					settings,
					loginRedirectUrl: '/dashboards/marketing'
				};
				return session;
			}

			if (token.role === 'admin') {
				session.db = {
					id: String(token.email || token.sub || 'admin'),
					role: ['admin'],
					displayName: String(token.name || 'WinPeak Admin'),
					email: session.user.email,
					photoURL: '',
					shortcuts: shortcuts.length
						? shortcuts
						: ['dashboards.winpeak', 'apps.players', 'apps.ledger'],
					settings,
					loginRedirectUrl: '/dashboards/winpeak'
				};
				return session;
			}

			session.db = {
				id: '',
				role: [],
				displayName: 'Guest',
				email: session.user?.email,
				photoURL: '',
				shortcuts: [],
				settings: {},
				loginRedirectUrl: '/sign-in'
			};

			return session;
		}
	},
	session: {
		strategy: 'jwt',
		maxAge: 30 * 24 * 60 * 60 // 30 days
	},
	debug: process.env.NODE_ENV !== 'production'
} satisfies NextAuthConfig;

export type { AuthJsProvider } from './authJsProviders';
export { authJsProviderMap } from './authJsProviders';

export const { handlers, auth, signIn, signOut } = NextAuth(config);
