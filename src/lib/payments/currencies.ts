/**
 * The networks players can deposit and withdraw on. Mirrors `PAY_CURRENCIES` in
 * the player site's `lib/payments/config.ts` — the two lists have to agree, or
 * staff would configure a receiving wallet for a coin no wallet form offers.
 *
 * Safe to import from client components: no server-only dependencies.
 */

export const PAY_CURRENCIES = [
	{ id: 'usdttrc20', label: 'USDT (TRC20)' },
	{ id: 'usdterc20', label: 'USDT (ERC20)' },
	{ id: 'btc', label: 'Bitcoin' },
	{ id: 'eth', label: 'Ethereum' },
	{ id: 'ltc', label: 'Litecoin' }
] as const;

export type PayCurrency = (typeof PAY_CURRENCIES)[number]['id'];

export function isPayCurrency(value: string): value is PayCurrency {
	return PAY_CURRENCIES.some((coin) => coin.id === value);
}

export function payCurrencyLabel(id: string) {
	return PAY_CURRENCIES.find((coin) => coin.id === id)?.label || id.toUpperCase();
}
