export function statusLabel(value: string | null | undefined) {
	const text = String(value || '')
		.replace(/_/g, ' ')
		.trim()
		.toLowerCase();

	if (!text) return '';
	return text.charAt(0).toUpperCase() + text.slice(1);
}
