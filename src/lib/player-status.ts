export function playerAccountChip(player: { status: string; emailVerified?: boolean }) {
	if (player.status === 'SUSPENDED') {
		return { label: 'suspended', color: 'error' as const };
	}

	if (!player.emailVerified) {
		return { label: 'unverified', color: 'warning' as const };
	}

	return { label: 'active', color: 'success' as const };
}
