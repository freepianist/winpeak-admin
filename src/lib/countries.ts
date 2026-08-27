const COUNTRY_NAMES: Record<string, string> = {
	AE: 'United Arab Emirates',
	AF: 'Afghanistan',
	AL: 'Albania',
	AR: 'Argentina',
	AT: 'Austria',
	AU: 'Australia',
	BE: 'Belgium',
	BG: 'Bulgaria',
	BR: 'Brazil',
	BY: 'Belarus',
	CA: 'Canada',
	CH: 'Switzerland',
	CL: 'Chile',
	CN: 'China',
	CO: 'Colombia',
	CU: 'Cuba',
	CY: 'Cyprus',
	CZ: 'Czechia',
	DE: 'Germany',
	DK: 'Denmark',
	EE: 'Estonia',
	ES: 'Spain',
	FI: 'Finland',
	FR: 'France',
	GB: 'United Kingdom',
	GR: 'Greece',
	HK: 'Hong Kong',
	HR: 'Croatia',
	HU: 'Hungary',
	ID: 'Indonesia',
	IE: 'Ireland',
	IL: 'Israel',
	IN: 'India',
	IR: 'Iran',
	IT: 'Italy',
	JP: 'Japan',
	KP: 'North Korea',
	KR: 'South Korea',
	LT: 'Lithuania',
	LU: 'Luxembourg',
	LV: 'Latvia',
	MX: 'Mexico',
	MY: 'Malaysia',
	NL: 'Netherlands',
	NO: 'Norway',
	NZ: 'New Zealand',
	PH: 'Philippines',
	PL: 'Poland',
	PT: 'Portugal',
	RO: 'Romania',
	RU: 'Russia',
	SE: 'Sweden',
	SG: 'Singapore',
	SI: 'Slovenia',
	SK: 'Slovakia',
	SY: 'Syria',
	TH: 'Thailand',
	TR: 'Turkey',
	UA: 'Ukraine',
	US: 'United States',
	VN: 'Vietnam',
	ZA: 'South Africa'
};

export const COUNTRY_OPTIONS = Object.entries(COUNTRY_NAMES)
	.map(([code, name]) => ({ code, name, label: `${name} (${code})` }))
	.sort((a, b) => a.name.localeCompare(b.name));

export function normalizeCountry(value: string | null | undefined) {
	const code = value?.trim().toUpperCase();
	if (!code || !/^[A-Z]{2}$/.test(code)) return null;
	return code;
}

export function countryLabel(code: string | null | undefined) {
	if (!code) return '';
	return COUNTRY_NAMES[code] || code;
}
