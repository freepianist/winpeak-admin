export function playerAccountChip(
	player: {
		status: string;
		emailVerified?: boolean;
		ageVerified?: boolean;
		country?: string | null;
	},
	blockedCountries: Iterable<string> = []
) {
	if (player.status === 'SUSPENDED') {
		return { label: 'Suspended', color: 'error' as const };
	}

	const blocked = new Set(
		[...blockedCountries].map((code) => code.trim().toUpperCase()).filter(Boolean)
	);
	const country = player.country?.trim().toUpperCase();

	if (country && blocked.has(country)) {
		return { label: 'Blocked region', color: 'error' as const };
	}

	if (!player.emailVerified) {
		return { label: 'Unverified', color: 'warning' as const };
	}

	if (!player.ageVerified) {
		return { label: 'Age not verified', color: 'warning' as const };
	}

	return { label: 'Active', color: 'success' as const };
}

export function isPlayerCountryBlocked(
	country: string | null | undefined,
	blockedCountries: Iterable<string> = []
) {
	const code = country?.trim().toUpperCase();
	if (!code) return false;
	return [...blockedCountries].some((item) => item.trim().toUpperCase() === code);
}
