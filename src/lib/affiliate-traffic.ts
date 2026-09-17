import type { AffiliateClick, AffiliateVisitType } from '@/app/(control-panel)/ops/api/types';
import type { ChipProps } from '@mui/material/Chip';

const COUNTRY_NAMES: Record<string, string> = {
	AE: 'United Arab Emirates',
	AU: 'Australia',
	BR: 'Brazil',
	CA: 'Canada',
	CN: 'China',
	DE: 'Germany',
	ES: 'Spain',
	FR: 'France',
	GB: 'United Kingdom',
	IN: 'India',
	IT: 'Italy',
	JP: 'Japan',
	KR: 'South Korea',
	NL: 'Netherlands',
	PH: 'Philippines',
	SG: 'Singapore',
	TR: 'Turkey',
	UA: 'Ukraine',
	US: 'United States',
	VN: 'Vietnam'
};

const VISIT_TYPES: AffiliateVisitType[] = ['unique', 'repeat', 'refresh', 'new_tab', 'same_tab', 'back'];

export const AFFILIATE_VISIT_FILTERS = [
	{ label: 'Unique', value: 'unique' },
	{ label: 'Repeat', value: 'repeat' },
	{ label: 'Refresh', value: 'refresh' },
	{ label: 'New tab', value: 'new_tab' },
	{ label: 'Same tab', value: 'same_tab' },
	{ label: 'Back', value: 'back' }
];

export function visitTypeOf(row: AffiliateClick): AffiliateVisitType {
	if (VISIT_TYPES.includes(row.visitType)) {
		return row.visitType;
	}

	return row.visitNumber > 1 ? 'repeat' : 'unique';
}

export function visitTypeLabel(type: string) {
	switch (type) {
		case 'refresh':
			return 'Refresh';
		case 'new_tab':
			return 'New tab';
		case 'same_tab':
			return 'Same tab';
		case 'back':
			return 'Back';
		case 'repeat':
			return 'Repeat';
		default:
			return 'Unique';
	}
}

export function visitTypeColor(type: string): ChipProps['color'] {
	switch (type) {
		case 'refresh':
			return 'info';
		case 'new_tab':
			return 'secondary';
		case 'same_tab':
			return 'default';
		case 'back':
			return 'default';
		case 'repeat':
			return 'warning';
		default:
			return 'success';
	}
}

export function visitCountLabel(row: AffiliateClick) {
	const visitNumber = row.visitNumber || 1;
	const visitorVisits = row.visitorVisits || visitNumber;
	const type = visitTypeOf(row);

	if (type === 'unique' || visitNumber <= 1) {
		return 'First visit';
	}

	if (type === 'refresh') {
		return `Refresh · ${visitNumber} of ${visitorVisits}`;
	}

	return `${visitNumber} of ${visitorVisits}`;
}

export function deviceLabel(row: Pick<AffiliateClick, 'deviceType' | 'os' | 'browser'>) {
	const software = [row.browser, row.os].filter(Boolean).join(' on ');

	if (row.deviceType && software) {
		return `${row.deviceType} · ${software}`;
	}

	return row.deviceType || software || '—';
}

export function locationLabel(row: Pick<AffiliateClick, 'city' | 'region' | 'country'>) {
	const country = row.country ? COUNTRY_NAMES[row.country] || row.country : '';
	const parts = [row.city, row.region, country].filter(Boolean);

	if (row.city && country) {
		return `${row.city}, ${country}`;
	}

	return parts[0] ? parts.join(', ') : '—';
}
