import { v2 as cloudinary } from 'cloudinary';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
export const UPLOAD_FOLDERS = new Set(['blog', 'authors', 'stories']);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type UploadFolder = 'blog' | 'authors' | 'stories';

export function isCloudinaryConfigured() {
	return Boolean(
		process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
			process.env.CLOUDINARY_API_KEY?.trim() &&
			process.env.CLOUDINARY_API_SECRET?.trim()
	);
}

function requireCloudinaryConfig() {
	const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
	const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
	const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

	if (!cloudName || !apiKey || !apiSecret) {
		throw new Error(
			'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.'
		);
	}

	cloudinary.config({
		cloud_name: cloudName,
		api_key: apiKey,
		api_secret: apiSecret
	});
}

export async function uploadImageToCloudinary(file: File, folder: string) {
	if (!UPLOAD_FOLDERS.has(folder)) {
		throw new Error('Invalid upload folder');
	}

	if (!IMAGE_TYPES.has(file.type)) {
		throw new Error('Use a JPG, PNG, WEBP, or GIF image');
	}

	if (file.size > MAX_UPLOAD_BYTES) {
		throw new Error('Image must be 5MB or smaller');
	}

	requireCloudinaryConfig();

	const buffer = Buffer.from(await file.arrayBuffer());

	const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
		const stream = cloudinary.uploader.upload_stream(
			{
				folder: `winpeak/${folder}`,
				resource_type: 'image',
				unique_filename: true
			},
			(error, uploaded) => {
				if (error || !uploaded?.secure_url) {
					reject(error || new Error('Could not upload image'));
					return;
				}

				resolve({ secure_url: uploaded.secure_url });
			}
		);

		stream.end(buffer);
	});

	return result.secure_url;
}
