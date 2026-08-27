'use client';

import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import FuseLoading from '@fuse/core/FuseLoading';
import FusePageCarded from '@fuse/core/FusePageCarded';
import { styled } from '@mui/material/styles';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Link from '@fuse/core/Link';
import { format } from 'date-fns';
import { enqueueSnackbar } from 'notistack';
import AdminPageHeader from '@/app/(control-panel)/ops/components/AdminPageHeader';
import { useCommissions, useUpdateCommission } from '@/app/(control-panel)/ops/api/hooks/useAffiliates';
import type { AffiliateCommission } from '@/app/(control-panel)/ops/api/types';
import { formatMoney } from '@/lib/money';
import { statusLabel } from '@/lib/status-label';

const Root = styled(FusePageCarded)(() => ({
	'& .container': {
		maxWidth: '100%!important'
	}
}));

function CommissionsView() {
	const { data: commissions = [], isLoading } = useCommissions();
	const update = useUpdateCommission();

	const columns = useMemo<MRT_ColumnDef<AffiliateCommission>[]>(
		() => [
			{
				accessorKey: 'partnerName',
				header: 'Partner',
				Cell: ({ row }) => (
					<div>
						<Typography
							component={Link}
							to={`/apps/partners/${row.original.partnerId}`}
							className="font-medium"
						>
							<u>{row.original.partnerName || row.original.partnerCode}</u>
						</Typography>
						<Typography
							className="text-sm"
							color="text.secondary"
						>
							{row.original.partnerCode}
						</Typography>
					</div>
				)
			},
			{ accessorKey: 'kind', header: 'Kind' },
			{
				accessorKey: 'playerEmail',
				header: 'Player',
				Cell: ({ row }) => row.original.playerEmail || '—'
			},
			{
				accessorKey: 'amount',
				header: 'Amount',
				Cell: ({ row }) => formatMoney(row.original.amount)
			},
			{
				accessorKey: 'status',
				header: 'Status',
				Cell: ({ row }) => (
					<Chip
						size="small"
						label={statusLabel(row.original.status)}
						color={
							row.original.status === 'PAID'
								? 'success'
								: row.original.status === 'VOID'
									? 'error'
									: row.original.status === 'APPROVED'
										? 'info'
										: 'default'
						}
						variant="outlined"
					/>
				)
			},
			{
				accessorKey: 'createdAt',
				header: 'When',
				Cell: ({ cell }) => format(new Date(cell.getValue<string>()), 'MMM d, yyyy')
			},
			{
				id: 'actions',
				header: 'Actions',
				Cell: ({ row }) => (
					<div className="flex gap-1">
						{row.original.status === 'PENDING' && (
							<Button
								size="small"
								onClick={() =>
									void update
										.mutateAsync({ id: row.original.id, status: 'APPROVED' })
										.then(() => enqueueSnackbar('Commission approved', { variant: 'success' }))
								}
							>
								Approve
							</Button>
						)}
						{row.original.status !== 'VOID' && row.original.status !== 'PAID' && (
							<Button
								size="small"
								color="error"
								onClick={() =>
									void update
										.mutateAsync({ id: row.original.id, status: 'VOID' })
										.then(() => enqueueSnackbar('Commission voided', { variant: 'success' }))
								}
							>
								Void
							</Button>
						)}
						{(row.original.status === 'APPROVED' || row.original.status === 'PENDING') && (
							<Button
								size="small"
								onClick={() =>
									void update
										.mutateAsync({ id: row.original.id, status: 'PAID' })
										.then(() => enqueueSnackbar('Marked paid', { variant: 'success' }))
								}
							>
								Mark paid
							</Button>
						)}
					</div>
				)
			}
		],
		[update]
	);

	if (isLoading) {
		return <FuseLoading />;
	}

	return (
		<Root
			header={
				<AdminPageHeader
					title="Commissions"
					subtitle="CPA hits on first deposit. Book rev share from a partner page, then approve or pay."
				/>
			}
			content={
				<Paper
					className="flex min-w-0 w-full flex-col rounded-b-none"
					elevation={2}
				>
					<DataTable
						data={commissions}
						columns={columns}
						enableRowActions={false}
						enableRowSelection={false}
					/>
				</Paper>
			}
		/>
	);
}

export default CommissionsView;
