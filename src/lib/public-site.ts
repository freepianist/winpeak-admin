import fs from 'fs';
import path from 'path';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const UPLOAD_FOLDERS = new Set(['blog', 'authors', 'stories']);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export function findPublicSiteRoot() {
	const configured = process.env.WINPEAK_PUBLIC_ROOT?.trim();

	if (configured && fs.existsSync(configured)) {
		return configured;
	}

	const parent = path.resolve(process.cwd(), '..');
	const self = path.basename(process.cwd());

	if (!fs.existsSync(parent)) {
		return null;
	}

	for (const name of fs.readdirSync(parent)) {
		if (name === self || name.startsWith('.')) {
			continue;
		}

		const root = path.join(parent, name);

		if (fs.existsSync(path.join(root, 'prisma', 'schema.prisma'))) {
			return root;
		}
	}

	return null;
}

function publicRoots() {
	const roots = [path.join(process.cwd(), 'public')];
	const siteRoot = findPublicSiteRoot();

	if (siteRoot) {
		roots.unshift(path.join(siteRoot, 'public'));
	}

	return roots;
}

function isInside(root: string, target: string) {
	const relative = path.relative(root, target);
	return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

export function resolvePublicAsset(requestPath: string) {
	const decoded = decodeURIComponent(requestPath).replace(/\\/g, '/');

	if (!decoded.startsWith('/') || decoded.includes('..')) {
		return null;
	}

	if (!decoded.startsWith('/images/') && !decoded.startsWith('/uploads/')) {
		return null;
	}

	if (!IMAGE_EXTENSIONS.has(path.extname(decoded).toLowerCase())) {
		return null;
	}

	for (const root of publicRoots()) {
		const absolute = path.resolve(root, decoded.slice(1));

		if (isInside(root, absolute) && fs.existsSync(absolute)) {
			return absolute;
		}
	}

	return null;
}

export async function savePublicUpload(file: File, folder: string) {
	if (!UPLOAD_FOLDERS.has(folder)) {
		throw new Error('Invalid upload folder');
	}

	if (!IMAGE_TYPES.has(file.type)) {
		throw new Error('Use a JPG, PNG, WEBP, or GIF image');
	}

	if (file.size > MAX_UPLOAD_BYTES) {
		throw new Error('Image must be 5MB or smaller');
	}

	const ext = path.extname(file.name).toLowerCase() || '.jpg';

	if (!IMAGE_EXTENSIONS.has(ext)) {
		throw new Error('Use a JPG, PNG, WEBP, or GIF image');
	}

	const safeName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
	const publicUrl = `/uploads/${folder}/${safeName}`;
	const buffer = Buffer.from(await file.arrayBuffer());
	const destinations = publicRoots().map((root) => path.join(root, 'uploads', folder, safeName));

	for (const destination of destinations) {
		fs.mkdirSync(path.dirname(destination), { recursive: true });
		fs.writeFileSync(destination, buffer);
	}

	return publicUrl;
}
