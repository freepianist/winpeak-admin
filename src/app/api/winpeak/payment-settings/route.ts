import { prisma } from '@/lib/db';
import { badRequest, requireAdmin, unauthorized } from '@/lib/admin-auth';
import { PAY_CURRENCIES, isPayCurrency, payCurrencyLabel } from '@/lib/payments/currencies';

type WalletInput = {
	payCurrency?: string;
	address?: string;
	qrImageUrl?: string;
	enabled?: boolean;
};

type SettingsInput = {
	manualMode?: boolean;
	manualMinDeposit?: number;
	manualMinWithdraw?: number;
	wallets?: WalletInput[];
};

type WalletRow = {
	payCurrency: string;
	address: string;
	qrImageUrl: string | null;
	enabled: boolean;
	updatedAt: Date;
};

/**
 * A floor of zero would let a player deposit a cent, and one in the millions is
 * a typo rather than a policy, so both ends are refused here.
 */
const MAX_MIN_USD = 100_000;

/**
 * Every supported network is returned, configured or not, so the page can render
 * one card per coin without having to know the list itself.
 */
function serializeWallets(rows: WalletRow[]) {
	const byCurrency = new Map(rows.map((row) => [row.payCurrency, row]));

	return PAY_CURRENCIES.map((coin) => {
		const row = byCurrency.get(coin.id);
		return {
			payCurrency: coin.id,
			label: coin.label,
			address: row?.address || '',
			qrImageUrl: row?.qrImageUrl || '',
			enabled: row ? row.enabled : true,
			updatedAt: row ? row.updatedAt.toISOString() : null
		};
	});
}

async function readSettings() {
	const [settings, wallets] = await Promise.all([
		prisma.paymentSettings.findUnique({ where: { id: 'default' } }),
		prisma.manualWallet.findMany()
	]);

	return {
		manualMode: Boolean(settings?.manualMode),
		manualMinDeposit: settings?.manualMinDeposit ?? 20,
		manualMinWithdraw: settings?.manualMinWithdraw ?? 20,
		updatedBy: settings?.updatedBy || '',
		updatedAt: settings ? settings.updatedAt.toISOString() : null,
		wallets: serializeWallets(wallets)
	};
}

export async function GET() {
	const session = await requireAdmin();

	if (!session) {
		return unauthorized();
	}

	return Response.json(await readSettings());
}

export async function PATCH(request: Request) {
	const session = await requireAdmin();

	if (!session) {
		return unauthorized();
	}

	const body = (await request.json()) as SettingsInput;

	const minimums: Record<'manualMinDeposit' | 'manualMinWithdraw', number> = {
		manualMinDeposit: 0,
		manualMinWithdraw: 0
	};

	for (const [key, label] of [
		['manualMinDeposit', 'deposit'],
		['manualMinWithdraw', 'withdrawal']
	] as const) {
		const value = Number(body[key]);

		if (!Number.isFinite(value) || value <= 0 || value > MAX_MIN_USD) {
			return badRequest(`Enter a minimum ${label} between 0 and ${MAX_MIN_USD.toLocaleString('en-US')} USD`);
		}

		// Stored to the cent: the player-facing figure is money, and a floor of
		// 20.005 would round to something they cannot actually type.
		minimums[key] = Math.round(value * 100) / 100;
	}

	const submitted = Array.isArray(body.wallets) ? body.wallets : [];
	const wallets: {
		payCurrency: string;
		address: string;
		qrImageUrl: string | null;
		enabled: boolean;
	}[] = [];

	for (const entry of submitted) {
		const payCurrency = (entry.payCurrency || '').trim().toLowerCase();

		if (!isPayCurrency(payCurrency)) {
			return badRequest(`${entry.payCurrency || 'That coin'} is not a supported network`);
		}

		const address = (entry.address || '').trim();

		// A wallet with no address is not a configuration, it is the absence of
		// one, and storing it would let a player reach a card with nothing to copy.
		if (!address) {
			continue;
		}

		if (/\s/.test(address)) {
			return badRequest(`The ${payCurrencyLabel(payCurrency)} address cannot contain spaces`);
		}

		wallets.push({
			payCurrency,
			address,
			qrImageUrl: (entry.qrImageUrl || '').trim() || null,
			enabled: entry.enabled !== false
		});
	}

	const manualMode = Boolean(body.manualMode);

	// Turning the rail on with nothing to pay to would leave every player looking
	// at a deposit form that cannot be completed, so it is refused here rather
	// than discovered by the first player who tries.
	if (manualMode && !wallets.some((wallet) => wallet.enabled)) {
		return badRequest('Add and enable at least one receiving wallet before turning manual mode on');
	}

	const updatedBy = session.db?.email || session.user?.email || 'admin';
	const keep = wallets.map((wallet) => wallet.payCurrency);

	await prisma.$transaction([
		prisma.paymentSettings.upsert({
			where: { id: 'default' },
			create: { id: 'default', manualMode, updatedBy, ...minimums },
			update: { manualMode, updatedBy, ...minimums }
		}),
		// Coins the form cleared are deleted rather than blanked, so "configured"
		// stays the same question as "has a row".
		prisma.manualWallet.deleteMany({
			where: keep.length ? { payCurrency: { notIn: keep } } : {}
		}),
		...wallets.map((wallet) =>
			prisma.manualWallet.upsert({
				where: { payCurrency: wallet.payCurrency },
				create: wallet,
				update: {
					address: wallet.address,
					qrImageUrl: wallet.qrImageUrl,
					enabled: wallet.enabled
				}
			})
		)
	]);

	return Response.json(await readSettings());
}
