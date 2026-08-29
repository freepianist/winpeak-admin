import { User } from '@auth/user';

declare module 'next-auth' {
	interface Session {
		accessToken?: string;
		db: User;
	}
	interface JWT {
		accessToken?: string;
		role?: string;
		partnerId?: string;
		staffId?: string;
		settings?: unknown;
		shortcuts?: string[];
	}
}
