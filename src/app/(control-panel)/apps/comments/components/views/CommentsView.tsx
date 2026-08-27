'use client';

import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import FuseLoading from '@fuse/core/FuseLoading';
import FusePageCarded from '@fuse/core/FusePageCarded';
import Button from '@mui/material/Button';
import { ListItemIcon, MenuItem, Paper } from '@mui/material';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import { format } from 'date-fns';
import { styled } from '@mui/material/styles';
import AdminPageHeader from '@/app/(control-panel)/ops/components/AdminPageHeader';
import { useComments, useDeleteComments } from '@/app/(control-panel)/ops/api/hooks/useContent';
import type { BlogComment } from '@/app/(control-panel)/ops/api/types';

const Root = styled(FusePageCarded)(() => ({
	'& .container': {
		maxWidth: '100%!important'
	}
}));

function CommentsView() {
	const { data: comments = [], isLoading } = useComments();
	const { mutate: deleteComments } = useDeleteComments();

	const columns = useMemo<MRT_ColumnDef<BlogComment>[]>(
		() => [
			{ accessorKey: 'postTitle', header: 'Post' },
			{ accessorKey: 'authorName', header: 'Author' },
			{ accessorKey: 'authorEmail', header: 'Email' },
			{ accessorKey: 'content', header: 'Comment' },
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
					title="Comments"
					subtitle="Moderate blog comments from the public site"
				/>
			}
			content={
				<Paper
					className="flex min-w-0 w-full flex-col rounded-b-none"
					elevation={2}
				>
					<DataTable
						data={comments}
						columns={columns}
						renderRowActionMenuItems={({ closeMenu, row, table }) => [
							<MenuItem
								key="delete"
								onClick={() => {
									deleteComments([row.original.id]);
									closeMenu();
									table.resetRowSelection();
								}}
							>
								<ListItemIcon>
									<FuseSvgIcon>lucide:trash</FuseSvgIcon>
								</ListItemIcon>
								Delete
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
										deleteComments(selected.map((row) => row.original.id));
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

export default CommentsView;
