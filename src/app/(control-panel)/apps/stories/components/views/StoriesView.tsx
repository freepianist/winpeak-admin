'use client';

import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import FuseLoading from '@fuse/core/FuseLoading';
import FusePageCarded from '@fuse/core/FusePageCarded';
import Button from '@mui/material/Button';
import { ListItemIcon, MenuItem, Paper } from '@mui/material';
import Typography from '@mui/material/Typography';
import Link from '@fuse/core/Link';
import NavLinkAdapter from '@fuse/core/NavLinkAdapter';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import { format } from 'date-fns';
import { styled } from '@mui/material/styles';
import AdminPageHeader from '@/app/(control-panel)/ops/components/AdminPageHeader';
import { useDeleteStory, useStories } from '@/app/(control-panel)/ops/api/hooks/useContent';
import type { SuccessStory } from '@/app/(control-panel)/ops/api/types';

const Root = styled(FusePageCarded)(() => ({
	'& .container': {
		maxWidth: '100%!important'
	}
}));

function StoriesView() {
	const { data: stories = [], isLoading } = useStories();
	const { mutate: deleteStory } = useDeleteStory();

	const columns = useMemo<MRT_ColumnDef<SuccessStory>[]>(
		() => [
			{
				accessorKey: 'authorName',
				header: 'Author',
				Cell: ({ row }) => (
					<div>
						<Typography
							component={Link}
							to={`/apps/stories/${row.original.id}`}
						>
							<u>{row.original.authorName}</u>
						</Typography>
						<Typography
							className="text-sm"
							color="text.secondary"
						>
							{row.original.role}
						</Typography>
					</div>
				)
			},
			{ accessorKey: 'content', header: 'Quote' },
			{ accessorKey: 'rating', header: 'Rating' },
			{
				accessorKey: 'createdAt',
				header: 'Added',
				Cell: ({ cell }) => format(new Date(cell.getValue<string>()), 'MMM d, yyyy')
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
					title="Success stories"
					subtitle="Testimonials shown on the public site"
					action={
						<Button
							variant="contained"
							color="secondary"
							component={NavLinkAdapter}
							to="/apps/stories/new"
							startIcon={<FuseSvgIcon>lucide:plus</FuseSvgIcon>}
						>
							New story
						</Button>
					}
				/>
			}
			content={
				<Paper
					className="flex min-w-0 w-full flex-col rounded-b-none"
					elevation={2}
				>
					<DataTable
						data={stories}
						columns={columns}
						enableRowSelection={false}
						renderRowActionMenuItems={({ closeMenu, row }) => [
							<MenuItem
								key="delete"
								onClick={() => {
									deleteStory(row.original.id);
									closeMenu();
								}}
							>
								<ListItemIcon>
									<FuseSvgIcon>lucide:trash</FuseSvgIcon>
								</ListItemIcon>
								Delete
							</MenuItem>
						]}
					/>
				</Paper>
			}
		/>
	);
}

export default StoriesView;
