export function playerAccountChip(player: {
	status: string;
	emailVerified?: boolean;
	ageVerified?: boolean;
	country?: string | null;
}) {
	if (player.status === 'SUSPENDED') {
		return { label: 'Suspended', color: 'error' as const };
	}

	if (!player.emailVerified) {
		return { label: 'Unverified', color: 'warning' as const };
	}

	if (!player.ageVerified) {
		return { label: 'Age not verified', color: 'warning' as const };
	}

	return { label: player.country || 'Active', color: 'success' as const };
}
