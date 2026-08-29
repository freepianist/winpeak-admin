'use client';

import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import FuseLoading from '@fuse/core/FuseLoading';
import FusePageCarded from '@fuse/core/FusePageCarded';
import { Chip, ListItemIcon, MenuItem, Paper } from '@mui/material';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import { format } from 'date-fns';
import { styled } from '@mui/material/styles';
import AdminPageHeader from '@/app/(control-panel)/ops/components/AdminPageHeader';
import { useDeleteInbox, useInbox, useUpdateInbox } from '@/app/(control-panel)/ops/api/hooks/useContent';
import type { InboxMessage } from '@/app/(control-panel)/ops/api/types';

const Root = styled(FusePageCarded)(() => ({
	'& .container': {
		maxWidth: '100%!important'
	}
}));

function InboxView() {
	const { data: messages = [], isLoading } = useInbox();
	const { mutate: updateInbox } = useUpdateInbox();
	const { mutate: deleteInbox } = useDeleteInbox();

	const columns = useMemo<MRT_ColumnDef<InboxMessage>[]>(
		() => [
			{
				accessorKey: 'read',
				header: 'Status',
				Cell: ({ cell }) => (
					<Chip
						size="small"
						label={cell.getValue<boolean>() ? 'Read' : 'New'}
						color={cell.getValue<boolean>() ? 'default' : 'secondary'}
						variant="outlined"
					/>
				)
			},
			{ accessorKey: 'name', header: 'From' },
			{ accessorKey: 'email', header: 'Email' },
			{ accessorKey: 'phone', header: 'Phone' },
			{ accessorKey: 'message', header: 'Message' },
			{
				accessorKey: 'createdAt',
				header: 'Received',
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
					title="Inbox"
					subtitle="Contact form messages from WinPeak"
				/>
			}
			content={
				<Paper
					className="flex min-w-0 w-full flex-col rounded-b-none"
					elevation={2}
				>
					<DataTable
						data={messages}
						columns={columns}
						enableRowSelection={false}
						renderRowActionMenuItems={({ closeMenu, row }) => [
							<MenuItem
								key="read"
								onClick={() => {
									updateInbox({ id: row.original.id, read: !row.original.read });
									closeMenu();
								}}
							>
								<ListItemIcon>
									<FuseSvgIcon>{row.original.read ? 'lucide:mail' : 'lucide:mail-open'}</FuseSvgIcon>
								</ListItemIcon>
								{row.original.read ? 'Mark unread' : 'Mark read'}
							</MenuItem>,
							<MenuItem
								key="delete"
								onClick={() => {
									deleteInbox(row.original.id);
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

export default InboxView;
