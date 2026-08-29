'use client';

import { useEffect } from 'react';
import FuseLoading from '@fuse/core/FuseLoading';
import FusePageCarded from '@fuse/core/FusePageCarded';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import useParams from '@fuse/hooks/useParams';
import useNavigate from '@fuse/hooks/useNavigate';
import Link from '@fuse/core/Link';
import { enqueueSnackbar } from 'notistack';
import AdminPageHeader from '@/app/(control-panel)/ops/components/AdminPageHeader';
import ImageUploadField from '@/app/(control-panel)/ops/components/ImageUploadField';
import { useCreateStory, useDeleteStory, useStory, useUpdateStory } from '@/app/(control-panel)/ops/api/hooks/useContent';

const schema = z.object({
	authorName: z.string().min(1, 'Author is required'),
	role: z.string().min(1, 'Role is required'),
	content: z.string().min(8, 'Quote is required'),
	image: z.string().min(1, 'Image is required'),
	rating: z.number().min(1).max(5)
});

type FormType = z.infer<typeof schema>;

function StoryView() {
	const { storyId } = useParams() as { storyId: string };
	const isNew = storyId === 'new';
	const navigate = useNavigate();
	const { data: story, isLoading, isError } = useStory(storyId);
	const { mutateAsync: createStory, isPending: creating } = useCreateStory();
	const { mutateAsync: updateStory, isPending: saving } = useUpdateStory(storyId);
	const { mutate: deleteStory } = useDeleteStory();

	const { control, handleSubmit, reset, formState } = useForm<FormType>({
		mode: 'onChange',
		resolver: zodResolver(schema),
		defaultValues: {
			authorName: '',
			role: 'Player',
			content: '',
			image: '/images/avatar/one.png',
			rating: 5
		}
	});

	useEffect(() => {
		if (story) {
			reset({
				authorName: story.authorName,
				role: story.role,
				content: story.content,
				image: story.image,
				rating: story.rating
			});
		}
	}, [story, reset]);

	if (!isNew && isLoading) {
		return <FuseLoading />;
	}

	if (!isNew && isError) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4">
				<Typography variant="h5">Story not found</Typography>
				<Button
					component={Link}
					to="/apps/stories"
					variant="outlined"
				>
					Back to stories
				</Button>
			</div>
		);
	}

	async function onSave(values: FormType) {
		try {
			if (isNew) {
				const created = await createStory(values);
				enqueueSnackbar('Story added', { variant: 'success' });
				navigate(`/apps/stories/${created.id}`);
				return;
			}

			await updateStory(values);
			enqueueSnackbar('Story saved', { variant: 'success' });
		} catch (error) {
			enqueueSnackbar(error instanceof Error ? error.message : 'Could not save story', { variant: 'error' });
		}
	}

	return (
		<FusePageCarded
			header={
				<AdminPageHeader
					title={isNew ? 'New success story' : story?.authorName || 'Story'}
					subtitle="Shown in testimonials on WinPeak"
					action={
						<div className="flex gap-2">
							{!isNew && (
								<Button
									color="error"
									variant="outlined"
									onClick={() => {
										deleteStory(storyId);
										navigate('/apps/stories');
									}}
								>
									Delete
								</Button>
							)}
							<Button
								variant="contained"
								color="secondary"
								disabled={creating || saving || !formState.isValid}
								onClick={handleSubmit(onSave)}
							>
								{isNew ? 'Add' : 'Save'}
							</Button>
						</div>
					}
				/>
			}
			content={
				<div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 sm:p-6">
					<div className="grid gap-4 sm:grid-cols-2">
						<Controller
							name="authorName"
							control={control}
							render={({ field, fieldState }) => (
								<TextField
									{...field}
									label="Author"
									error={!!fieldState.error}
									helperText={fieldState.error?.message}
									fullWidth
								/>
							)}
						/>
						<Controller
							name="role"
							control={control}
							render={({ field }) => (
								<TextField
									{...field}
									label="Role"
									fullWidth
								/>
							)}
						/>
					</div>
					<Controller
						name="content"
						control={control}
						render={({ field, fieldState }) => (
							<TextField
								{...field}
								label="Quote"
								error={!!fieldState.error}
								helperText={fieldState.error?.message}
								multiline
								minRows={5}
								fullWidth
							/>
						)}
					/>
					<Controller
						name="rating"
						control={control}
						render={({ field }) => (
							<TextField
								{...field}
								label="Rating"
								type="number"
								inputProps={{ min: 1, max: 5 }}
								onChange={(event) => field.onChange(Number(event.target.value))}
								fullWidth
							/>
						)}
					/>
					<Controller
						name="image"
						control={control}
						render={({ field, fieldState }) => (
							<ImageUploadField
								label="Player photo"
								value={field.value || ''}
								folder="stories"
								variant="avatar"
								error={fieldState.error?.message}
								onChange={field.onChange}
							/>
						)}
					/>
				</div>
			}
		/>
	);
}

export default StoryView;
