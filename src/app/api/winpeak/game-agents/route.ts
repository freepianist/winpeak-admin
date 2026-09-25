import { prisma } from '@/lib/db';
import { badRequest, requireAdmin, unauthorized } from '@/lib/admin-auth';
import { encryptAgentSecret, isAgentSecretKeyConfigured } from '@/lib/games/agent-secrets';

type AgentInput = {
	id?: string;
	label?: string;
	source?: string;
	currency?: string;
	apiBaseUrl?: string;
	language?: string;
	clientId?: string;
	proxyUrl?: string;
	/** Write-only. Blank keeps the stored value. */
	apiToken?: string;
	/** Write-only. Blank keeps the stored value. */
	clientSecret?: string;
	enabled?: boolean;
};

function playerSiteUrl() {
	return (process.env.WINPEAK_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '');
}

function isHttpUrl(value: string) {
	try {
		const url = new URL(value);
		return url.protocol === 'https:' || url.protocol === 'http:';
	} catch {
		return false;
	}
}

async function readAgents() {
	const rows = await prisma.gameAgent.findMany({
		include: {
			scorpioCountries: { select: { country: true } },
			oroplayCountries: { select: { country: true } }
		},
		orderBy: [{ source: 'asc' }, { currency: 'asc' }, { label: 'asc' }]
	});
	const site = playerSiteUrl();

	return {
		keyConfigured: isAgentSecretKeyConfigured(),
		scorpioCallbackUrl: site ? `${site}/api/scorpio/callback` : '',
		oroplayCallbackBase: site ? `${site}/api` : '',
		agents: rows.map((row) => ({
			id: row.id,
			label: row.label,
			source: row.source,
			currency: row.currency,
			apiBaseUrl: row.apiBaseUrl,
			language: row.language || '',
			clientId: row.clientId || '',
			proxyUrl: row.proxyUrl || '',
			hasApiToken: Boolean(row.apiTokenEnc),
			hasClientSecret: Boolean(row.clientSecretEnc),
			enabled: row.enabled,
			countries: [...row.scorpioCountries, ...row.oroplayCountries].map((entry) => entry.country).sort(),
			updatedBy: row.updatedBy || '',
			updatedAt: row.updatedAt.toISOString()
		}))
	};
}

export async function GET() {
	const session = await requireAdmin();

	if (!session) {
		return unauthorized();
	}

	return Response.json(await readAgents());
}

export async function PATCH(request: Request) {
	const session = await requireAdmin();

	if (!session) {
		return unauthorized();
	}

	const body = (await request.json()) as { agents?: AgentInput[] };
	const submitted = Array.isArray(body.agents) ? body.agents : [];
	const updatedBy = session.db?.email || session.user?.email || 'admin';

	const existing = await prisma.gameAgent.findMany({
		include: {
			scorpioCountries: { select: { country: true, currency: true } },
			oroplayCountries: { select: { country: true, currency: true } }
		}
	});
	const byId = new Map(existing.map((row) => [row.id, row]));
	const oroplayClientIds = new Set<string>();

	type Prepared = {
		id?: string;
		data: {
			label: string;
			source: 'scorpio' | 'oroplay';
			currency: string;
			apiBaseUrl: string;
			language: string | null;
			clientId: string | null;
			proxyUrl: string | null;
			enabled: boolean;
			updatedBy: string;
			apiTokenEnc?: string | null;
			clientSecretEnc?: string | null;
		};
	};
	const prepared: Prepared[] = [];

	for (const entry of submitted) {
		const current = entry.id ? byId.get(entry.id) : undefined;

		if (entry.id && !current) {
			return badRequest('An agent was removed by someone else. Reload and try again.');
		}

		const label = (entry.label || '').trim().slice(0, 80);

		if (!label) {
			return badRequest('Every agent needs a name');
		}

		const source = entry.source === 'scorpio' || entry.source === 'oroplay' ? entry.source : null;

		if (!source) {
			return badRequest(`Choose Scorpio or Oroplay for ${label}`);
		}

		const currency = (entry.currency || '').trim().toUpperCase();

		if (!/^[A-Z]{3}$/.test(currency)) {
			return badRequest(`Enter a three-letter currency code for ${label}`);
		}

		const apiBaseUrl = (entry.apiBaseUrl || '').trim().replace(/\/+$/, '');

		if (!isHttpUrl(apiBaseUrl)) {
			return badRequest(`Enter the API base URL for ${label}`);
		}

		const proxyUrl = (entry.proxyUrl || '').trim();

		if (proxyUrl && !isHttpUrl(proxyUrl)) {
			return badRequest(`The proxy for ${label} must be an http(s) URL`);
		}

		const assigned = current ? [...current.scorpioCountries, ...current.oroplayCountries] : [];

		if (current && current.source !== source && assigned.length) {
			return badRequest(`${label} is assigned to ${assigned.map((row) => row.country).join(', ')}, so its aggregator cannot change`);
		}

		const mismatch = assigned.find((row) => row.currency.toUpperCase() !== currency);

		if (mismatch) {
			return badRequest(`${label} is assigned to ${mismatch.country}, which runs in ${mismatch.currency}`);
		}

		const enabled = entry.enabled !== false;

		if (!enabled && assigned.length) {
			return badRequest(`${label} is assigned to ${assigned.map((row) => row.country).join(', ')}. Assign another agent there before turning it off.`);
		}

		const apiToken = (entry.apiToken || '').trim();
		const clientSecret = entry.clientSecret || '';
		const clientId = source === 'oroplay' ? (entry.clientId || '').trim() : '';

		if ((apiToken || clientSecret) && !isAgentSecretKeyConfigured()) {
			return badRequest('Set GAME_AGENT_SECRET_KEY on admin and the player site before saving agent credentials');
		}

		const data: Prepared['data'] = {
			label,
			source,
			currency,
			apiBaseUrl,
			language: (entry.language || '').trim().slice(0, 10) || null,
			clientId: clientId || null,
			proxyUrl: source === 'oroplay' ? proxyUrl || null : null,
			enabled,
			updatedBy
		};

		if (source === 'scorpio') {
			if (!apiToken && !current?.apiTokenEnc) {
				return badRequest(`Enter the API token for ${label}`);
			}

			if (apiToken) data.apiTokenEnc = encryptAgentSecret(apiToken);

			data.clientSecretEnc = null;
		} else {
			if (!clientId) {
				return badRequest(`Enter the client id for ${label}`);
			}

			// Callbacks identify the calling agent by client id, so two agents
			// sharing one could credit each other's players.
			if (oroplayClientIds.has(clientId) || clientId === (process.env.OROPLAY_CLIENT_ID || '').trim()) {
				return badRequest(`Client id ${clientId} is already used by another agent`);
			}

			oroplayClientIds.add(clientId);

			if (!clientSecret && !current?.clientSecretEnc) {
				return badRequest(`Enter the client secret for ${label}`);
			}

			if (clientSecret) data.clientSecretEnc = encryptAgentSecret(clientSecret);

			data.apiTokenEnc = null;
		}

		prepared.push({ id: current?.id, data });
	}

	const keep = new Set(prepared.map((row) => row.id).filter(Boolean));
	const removed = existing.filter((row) => !keep.has(row.id));
	const stillAssigned = removed.find((row) => row.scorpioCountries.length || row.oroplayCountries.length);

	if (stillAssigned) {
		const countries = [...stillAssigned.scorpioCountries, ...stillAssigned.oroplayCountries].map((row) => row.country);
		return badRequest(`${stillAssigned.label} is assigned to ${countries.join(', ')}. Assign another agent there before removing it.`);
	}

	await prisma.$transaction([
		prisma.gameAgent.deleteMany({ where: { id: { in: removed.map((row) => row.id) } } }),
		...prepared.map((row) =>
			row.id
				? prisma.gameAgent.update({ where: { id: row.id }, data: row.data })
				: prisma.gameAgent.create({ data: row.data })
		)
	]);

	return Response.json(await readAgents());
}
