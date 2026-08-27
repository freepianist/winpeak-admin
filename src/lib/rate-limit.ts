type Bucket = { count: number; resetAt: number };

const hits = new Map<string, Bucket>();

function firstForwardedIp(value: string | null) {
	const raw = value?.split(",")[0]?.trim();
	return raw || null;
}

export function requestIp(request: Request) {
	const source = request.headers;
	return (
		source.get("cf-connecting-ip") ||
		source.get("true-client-ip") ||
		source.get("x-real-ip") ||
		firstForwardedIp(source.get("x-forwarded-for")) ||
		"unknown"
	);
}

export function rateLimited(key: string, limit: number, windowMs: number) {
	const now = Date.now();
	if (hits.size > 4000) {
		for (const [entry, bucket] of hits) {
			if (bucket.resetAt <= now) hits.delete(entry);
		}
	}
	const bucket = hits.get(key);
	if (!bucket || bucket.resetAt <= now) {
		hits.set(key, { count: 1, resetAt: now + windowMs });
		return false;
	}
	if (bucket.count >= limit) return true;
	bucket.count += 1;
	return false;
}
