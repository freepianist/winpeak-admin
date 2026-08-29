'use client';

import { useRef, useState } from 'react';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import { enqueueSnackbar } from 'notistack';
import { winpeakApi } from '@/app/(control-panel)/ops/api/apiService';

type ImageUploadFieldProps = {
	label: string;
	value: string;
	folder: 'blog' | 'authors' | 'stories';
	variant?: 'cover' | 'avatar';
	helperText?: string;
	error?: string;
	onChange: (url: string) => void;
};

function previewSrc(value: string) {
	if (!value) {
		return '';
	}

	if (value.startsWith('http') || value.startsWith('blob:') || value.startsWith('data:')) {
		return value;
	}

	return `/api/winpeak/media?path=${encodeURIComponent(value)}`;
}

function ImageUploadField(props: ImageUploadFieldProps) {
	const { label, value, folder, variant = 'cover', helperText, error, onChange } = props;
	const inputRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);
	const preview = previewSrc(value);
	const isAvatar = variant === 'avatar';

	async function handleFile(file?: File) {
		if (!file) {
			return;
		}

		setUploading(true);

		try {
			const uploaded = await winpeakApi.uploadImage(file, folder);
			onChange(uploaded.url);
		} catch (uploadError) {
			enqueueSnackbar(uploadError instanceof Error ? uploadError.message : 'Could not upload image', {
				variant: 'error'
			});
		} finally {
			setUploading(false);

			if (inputRef.current) {
				inputRef.current.value = '';
			}
		}
	}

	return (
		<div className="flex flex-col gap-2">
			<Typography
				variant="body2"
				color={error ? 'error' : 'text.secondary'}
			>
				{label}
			</Typography>
			<div
				className={`flex overflow-hidden rounded-lg border border-dashed ${
					isAvatar ? 'h-32 w-32 items-center justify-center' : 'min-h-40 w-full items-center justify-center'
				} bg-gray-50 dark:bg-gray-800`}
			>
				{preview ? (
					<img
						src={preview}
						alt={label}
						className={isAvatar ? 'h-full w-full object-cover' : 'max-h-56 w-full object-cover'}
					/>
				) : (
					<Typography color="text.disabled">No image</Typography>
				)}
			</div>
			<input
				ref={inputRef}
				type="file"
				accept="image/jpeg,image/png,image/webp,image/gif"
				className="hidden"
				onChange={(event) => handleFile(event.target.files?.[0])}
			/>
			<div>
				<Button
					variant="outlined"
					size="small"
					disabled={uploading}
					startIcon={<FuseSvgIcon size={16}>lucide:upload</FuseSvgIcon>}
					onClick={() => inputRef.current?.click()}
				>
					{uploading ? 'Uploading…' : value ? 'Replace image' : 'Upload image'}
				</Button>
			</div>
			<Typography
				variant="caption"
				color={error ? 'error' : 'text.secondary'}
			>
				{error || helperText || 'JPG, PNG, WEBP, or GIF up to 5MB. Stored on Cloudinary.'}
			</Typography>
		</div>
	);
}

export default ImageUploadField;
