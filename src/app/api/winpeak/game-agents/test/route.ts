import { ProxyAgent, fetch as proxiedFetch } from 'undici';
import { prisma } from '@/lib/db';
import { badRequest, notFound, requireAdmin, unauthorized } from '@/lib/admin-auth';
import { decryptAgentSecret } from '@/lib/games/agent-secrets';

const TIMEOUT_MS = 15_000;

async function call(url: string, init: { method?: string; body?: unknown; token?: string; proxyUrl?: string | null }) {
	const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' };

	if (init.token) headers.Authorization = `Bearer ${init.token}`;

	const options = {
		method: init.method || 'GET',
		headers,
		body: init.body === undefined ? undefined : JSON.stringify(init.body),
		signal: AbortSignal.timeout(TIMEOUT_MS)
	};
	const response = init.proxyUrl
		? await proxiedFetch(url, { ...options, dispatcher: new ProxyAgent(init.proxyUrl) })
		: await fetch(url, { ...options, cache: 'no-store' });
	const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
	return { status: response.status, ok: response.ok, payload };
}

/** One read-only call per aggregator, proving the credentials and (for Oroplay) the proxy IP are accepted. */
export async function POST(request: Request) {
	const session = await requireAdmin();

	if (!session) {
		return unauthorized();
	}

	const { id } = (await request.json().catch(() => ({}))) as { id?: string };

	if (!id) {
		return badRequest('Save the agent before testing it');
	}

	const agent = await prisma.gameAgent.findUnique({ where: { id } });

	if (!agent) {
		return notFound('Agent not found');
	}

	try {
		if (agent.source === 'scorpio') {
			const result = await call(`${agent.apiBaseUrl}/v1/provider/list`, {
				token: decryptAgentSecret(agent.apiTokenEnc)
			});

			if (!result.ok || result.payload?.success === false) {
				return Response.json({
					ok: false,
					message: String(result.payload?.message || result.payload?.error || `Scorpio answered HTTP ${result.status}`)
				});
			}

			const providers = Array.isArray(result.payload?.data) ? result.payload.data.length : 0;
			return Response.json({ ok: true, message: `Connected. ${providers} providers available.` });
		}

		const auth = await call(`${agent.apiBaseUrl}/auth/createtoken`, {
			method: 'POST',
			body: { clientId: agent.clientId, clientSecret: decryptAgentSecret(agent.clientSecretEnc) },
			proxyUrl: agent.proxyUrl
		});
		const token = typeof auth.payload?.token === 'string' ? auth.payload.token : '';

		if (!auth.ok || !token) {
			return Response.json({
				ok: false,
				message: `Oroplay refused the credentials (HTTP ${auth.status}). Check the client id, secret and that the proxy IP is whitelisted.`
			});
		}

		const balance = await call(`${agent.apiBaseUrl}/agent/balance`, { token, proxyUrl: agent.proxyUrl });

		if (!balance.ok || balance.payload?.success === false) {
			return Response.json({ ok: false, message: `Signed in, but the balance call failed (errorCode ${String(balance.payload?.errorCode ?? balance.status)})` });
		}

		return Response.json({
			ok: true,
			message: `Connected. Agent balance ${Number(balance.payload?.message || 0).toLocaleString('en-US')} ${agent.currency}.`
		});
	} catch (error) {
		return Response.json({ ok: false, message: error instanceof Error ? error.message : 'Could not reach the aggregator' });
	}
}
