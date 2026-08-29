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
import { useDeleteSubscribers, useSubscribers } from '@/app/(control-panel)/ops/api/hooks/useContent';
import type { Subscriber } from '@/app/(control-panel)/ops/api/types';

const Root = styled(FusePageCarded)(() => ({
	'& .container': {
		maxWidth: '100%!important'
	}
}));

function SubscribersView() {
	const { data: subscribers = [], isLoading } = useSubscribers();
	const { mutate: deleteSubscribers } = useDeleteSubscribers();

	const columns = useMemo<MRT_ColumnDef<Subscriber>[]>(
		() => [
			{ accessorKey: 'email', header: 'Email' },
			{
				accessorKey: 'createdAt',
				header: 'Subscribed',
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
					title="Subscribers"
					subtitle="Newsletter signups from WinPeak"
				/>
			}
			content={
				<Paper
					className="flex min-w-0 w-full flex-col rounded-b-none"
					elevation={2}
				>
					<DataTable
						data={subscribers}
						columns={columns}
						renderRowActionMenuItems={({ closeMenu, row, table }) => [
							<MenuItem
								key="delete"
								onClick={() => {
									deleteSubscribers([row.original.id]);
									closeMenu();
									table.resetRowSelection();
								}}
							>
								<ListItemIcon>
									<FuseSvgIcon>lucide:trash</FuseSvgIcon>
								</ListItemIcon>
								Remove
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
										deleteSubscribers(selected.map((row) => row.original.id));
										table.resetRowSelection();
									}}
								>
									Remove selected
								</Button>
							);
						}}
					/>
				</Paper>
			}
		/>
	);
}

export default SubscribersView;
