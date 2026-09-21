import type { Theme } from '@mui/material/styles';
import type { SupportStatus } from '@/app/(control-panel)/ops/api/types';

export const STATUS_LABEL: Record<SupportStatus, string> = {
	BOT: 'Bot',
	WAITING_AGENT: 'Waiting',
	AGENT: 'With agent',
	RESOLVED: 'Closed'
};

export const STATUS_COLOR: Record<SupportStatus, 'default' | 'warning' | 'info' | 'success'> = {
	BOT: 'default',
	WAITING_AGENT: 'warning',
	AGENT: 'info',
	RESOLVED: 'success'
};

/// Resolves the same status palette the chips use down to a raw colour, so avatars
/// and rails can tint themselves with `alpha()` instead of inventing a second scheme.
export function statusColor(theme: Theme, status: SupportStatus) {
	const key = STATUS_COLOR[status];
	return key === 'default' ? theme.palette.grey[500] : theme.palette[key].main;
}

/// The queue filters. An empty value is the default queue of waiting and claimed
/// threads; `urgent` marks the one count an agent is actually watching.
export const QUEUE_FILTERS = [
	{ value: '', label: 'Open', countKey: 'OPEN', icon: 'lucide:inbox', urgent: false },
	{ value: 'WAITING_AGENT', label: 'Waiting', countKey: 'WAITING_AGENT', icon: 'lucide:clock', urgent: true },
	{ value: 'AGENT', label: 'Mine', countKey: 'AGENT', icon: 'lucide:headset', urgent: false },
	{ value: 'BOT', label: 'Bot', countKey: 'BOT', icon: 'lucide:bot', urgent: false },
	{ value: 'RESOLVED', label: 'Closed', countKey: 'RESOLVED', icon: 'lucide:circle-check', urgent: false }
] as const;

/** Lets the queue column title itself after whichever filter is active. */
export function activeFilter(value: string) {
	return QUEUE_FILTERS.find((option) => option.value === value) ?? QUEUE_FILTERS[0];
}
