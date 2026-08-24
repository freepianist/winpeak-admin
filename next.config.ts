import type { NextConfig } from 'next';
import { getSiteUrl, normalizeSiteUrl } from './src/lib/env';

const isTurbopack = process.env.TURBOPACK === '1';
const siteUrl = getSiteUrl();

// Auth.js reads AUTH_URL via process.env. Do this here — Next.js inlines
// process.env.AUTH_URL in app code, so assignments there become `"host" = ...`.
process.env.AUTH_URL = siteUrl;

if (process.env.NEXTAUTH_URL) {
	process.env.NEXTAUTH_URL = normalizeSiteUrl(process.env.NEXTAUTH_URL);
}

if (process.env.NEXT_PUBLIC_BASE_URL) {
	process.env.NEXT_PUBLIC_BASE_URL = siteUrl;
}

// Conditionally add webpack configuration only when NOT using turbopack
const nextConfig: NextConfig = {
	reactStrictMode: false,
	poweredByHeader: false,
	serverExternalPackages: ['@prisma/client', 'prisma', 'pg', '@prisma/adapter-pg', 'bcryptjs', 'cloudinary'],
	typescript: {
		// Dangerously allow production builds to successfully complete even if
		// your project has type errors.
		// ignoreBuildErrors: true
	},
	turbopack: {
		root: __dirname,
		rules: {}
	},
	...(!isTurbopack && {
		webpack: (config) => {
			if (config.module && config.module.rules) {
				config.module.rules.push({
					test: /\.(json|js|ts|tsx|jsx)$/,
					resourceQuery: /raw/,
					use: 'raw-loader'
				});
			}

			return config;
		}
	})
};

export default nextConfig;
