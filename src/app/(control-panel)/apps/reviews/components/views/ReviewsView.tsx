'use client';

import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import FuseLoading from '@fuse/core/FuseLoading';
import FusePageCarded from '@fuse/core/FusePageCarded';
import Button from '@mui/material/Button';
import { ListItemIcon, MenuItem, Paper, Typography } from '@mui/material';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import { format } from 'date-fns';
import { styled } from '@mui/material/styles';
import AdminPageHeader from '@/app/(control-panel)/ops/components/AdminPageHeader';
import { useDeleteReply, useDeleteReviews, useReviews } from '@/app/(control-panel)/ops/api/hooks/useContent';
import type { GameReview } from '@/app/(control-panel)/ops/api/types';

const Root = styled(FusePageCarded)(() => ({
	'& .container': {
		maxWidth: '100%!important'
	}
}));

function ReviewsView() {
	const { data: reviews = [], isLoading } = useReviews();
	const { mutate: deleteReviews } = useDeleteReviews();
	const { mutate: deleteReply } = useDeleteReply();

	const columns = useMemo<MRT_ColumnDef<GameReview>[]>(
		() => [
			{
				accessorKey: 'gameCode',
				header: 'Game',
				Cell: ({ row }) => (
					<div>
						<Typography className="font-medium">{row.original.gameCode}</Typography>
						<Typography
							className="text-sm"
							color="text.secondary"
						>
							Provider {row.original.providerId}
						</Typography>
					</div>
				)
			},
			{ accessorKey: 'playerName', header: 'Player' },
			{ accessorKey: 'rating', header: 'Rating' },
			{ accessorKey: 'content', header: 'Review' },
			{ accessorKey: 'replyCount', header: 'Replies' },
			{
				accessorKey: 'createdAt',
				header: 'When',
				Cell: ({ cell }) => format(new Date(cell.getValue<string>()), 'MMM d, yyyy HH:mm')
			}
		],
		[]
	);

	if (isLoading) {
		return <FuseLoading />;
	}

	return (
		<Root
			header={
				<AdminPageHeader
					title="Reviews"
					subtitle="Game reviews and replies from players"
				/>
			}
			content={
				<Paper
					className="flex min-w-0 w-full flex-col rounded-b-none"
					elevation={2}
				>
					<DataTable
						data={reviews}
						columns={columns}
						renderDetailPanel={({ row }) => (
							<div className="flex flex-col gap-3 p-4">
								{row.original.replies.length === 0 && (
									<Typography color="text.secondary">No replies</Typography>
								)}
								{row.original.replies.map((reply) => (
									<div
										key={reply.id}
										className="flex items-start justify-between gap-4 rounded-lg border px-3 py-2"
									>
										<div>
											<Typography className="font-medium">{reply.authorName}</Typography>
											<Typography color="text.secondary">{reply.content}</Typography>
										</div>
										<Button
											size="small"
											color="error"
											onClick={() => deleteReply(reply.id)}
										>
											Delete reply
										</Button>
									</div>
								))}
							</div>
						)}
						renderRowActionMenuItems={({ closeMenu, row, table }) => [
							<MenuItem
								key="delete"
								onClick={() => {
									deleteReviews([row.original.id]);
									closeMenu();
									table.resetRowSelection();
								}}
							>
								<ListItemIcon>
									<FuseSvgIcon>lucide:trash</FuseSvgIcon>
								</ListItemIcon>
								Delete review
							</MenuItem>
						]}
						renderTopToolbarCustomActions={({ table }) => {
							const selected = table.getSelectedRowModel().rows;

							if (!selected.length) {
								return null;
							}

							return (
								<Button
									variant="contained"
									size="small"
									color="secondary"
									onClick={() => {
										deleteReviews(selected.map((row) => row.original.id));
										table.resetRowSelection();
									}}
								>
									Delete selected
								</Button>
							);
						}}
					/>
				</Paper>
			}
		/>
	);
}

export default ReviewsView;
