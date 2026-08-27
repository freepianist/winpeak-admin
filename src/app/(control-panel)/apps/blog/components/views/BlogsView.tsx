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
import { useBlogs, useDeleteBlog } from '@/app/(control-panel)/ops/api/hooks/useBlogs';
import type { BlogPost } from '@/app/(control-panel)/ops/api/types';

const Root = styled(FusePageCarded)(() => ({
	'& .container': {
		maxWidth: '100%!important'
	}
}));

function BlogsView() {
	const { data: posts = [], isLoading } = useBlogs();
	const { mutate: deleteBlog } = useDeleteBlog();

	const columns = useMemo<MRT_ColumnDef<BlogPost>[]>(
		() => [
			{
				accessorKey: 'title',
				header: 'Title',
				Cell: ({ row }) => (
					<div>
						<Typography
							component={Link}
							to={`/apps/blog/${row.original.id}`}
						>
							<u>{row.original.title}</u>
						</Typography>
						<Typography
							className="text-sm"
							color="text.secondary"
						>
							/{row.original.slug}
						</Typography>
					</div>
				)
			},
			{ accessorKey: 'tag', header: 'Tag' },
			{ accessorKey: 'author', header: 'Author' },
			{ accessorKey: 'commentCount', header: 'Comments' },
			{
				accessorKey: 'publishedAt',
				header: 'Published',
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
					title="Blog"
					subtitle="Posts that appear on the WinPeak site"
					action={
						<Button
							variant="contained"
							color="secondary"
							component={NavLinkAdapter}
							to="/apps/blog/new"
							startIcon={<FuseSvgIcon>lucide:plus</FuseSvgIcon>}
						>
							New post
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
						data={posts}
						columns={columns}
						enableRowSelection={false}
						renderRowActionMenuItems={({ closeMenu, row }) => [
							<MenuItem
								key="delete"
								onClick={() => {
									deleteBlog(row.original.id);
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

export default BlogsView;
