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
import { useUpdateWalletRequest, useWalletRequests } from '@/app/(control-panel)/ops/api/hooks/usePlayers';
import type { WalletRequest } from '@/app/(control-panel)/ops/api/types';
import { formatMoney } from '@/lib/money';
import { statusLabel } from '@/lib/status-label';

function requestStatusColor(status: WalletRequest['status']) {
	if (status === 'APPROVED') return 'success';
	if (status === 'REJECTED') return 'error';
	if (status === 'PROCESSING') return 'info';
	return 'warning';
}

function shortAddress(value: string) {
	if (!value) return '—';
	if (value.length <= 16) return value;
	return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

const Root = styled(FusePageCarded)(() => ({
	'& .container': {
		maxWidth: '100%!important'
	}
}));

function WalletRequestsView() {
	const { data: requests = [], isLoading } = useWalletRequests();
	const update = useUpdateWalletRequest();

	const columns = useMemo<MRT_ColumnDef<WalletRequest>[]>(
		() => [
			{
				accessorKey: 'playerName',
				header: 'Player',
				Cell: ({ row }) => (
					<div>
						<Typography
							component={Link}
							to={`/apps/players/${row.original.userId}`}
							className="font-medium"
						>
							<u>{row.original.playerName || row.original.playerEmail}</u>
						</Typography>
						<Typography
							className="text-sm"
							color="text.secondary"
						>
							{row.original.playerEmail}
						</Typography>
					</div>
				)
			},
			{ accessorKey: 'type', header: 'Type' },
			{
				accessorKey: 'amount',
				header: 'Amount',
				Cell: ({ row }) => formatMoney(row.original.amount, row.original.currency)
			},
			{
				id: 'destination',
				header: 'Destination',
				Cell: ({ row }) => (
					<div>
						<Typography className="text-sm">{row.original.payCurrency || '—'}</Typography>
						<Typography
							className="text-sm"
							color="text.secondary"
							title={row.original.payoutAddress || row.original.invoiceUrl}
						>
							{row.original.type === 'WITHDRAW'
								? shortAddress(row.original.payoutAddress)
								: row.original.invoiceUrl
									? 'Crypto invoice'
									: '—'}
						</Typography>
						{row.original.autoProcessed ? (
							<Chip
								size="small"
								label="auto"
								variant="outlined"
								sx={{ mt: 0.5 }}
							/>
						) : null}
					</div>
				)
			},
			{
				accessorKey: 'status',
				header: 'Status',
				Cell: ({ row }) => (
					<Chip
						size="small"
						label={statusLabel(row.original.status)}
						color={requestStatusColor(row.original.status)}
						variant="outlined"
					/>
				)
			},
			{
				accessorKey: 'createdAt',
				header: 'Requested',
				Cell: ({ cell }) => format(new Date(cell.getValue<string>()), 'MMM d, yyyy HH:mm')
			},
			{
				accessorKey: 'reviewedBy',
				header: 'Reviewed by',
				Cell: ({ row }) => row.original.reviewedBy || '—'
			},
			{
				id: 'actions',
				header: 'Actions',
				Cell: ({ row }) =>
					row.original.status === 'PENDING' ? (
						<div className="flex gap-1">
							<Button
								size="small"
								color="secondary"
								onClick={() =>
									void update
										.mutateAsync({ id: row.original.id, status: 'APPROVED' })
										.then((row) =>
											enqueueSnackbar(
												row.status === 'PROCESSING' ? 'Payout submitted' : 'Request approved',
												{ variant: 'success' }
											)
										)
										.catch((error: unknown) =>
											enqueueSnackbar(
												error instanceof Error ? error.message : 'Could not approve',
												{ variant: 'error' }
											)
										)
								}
							>
								Approve
							</Button>
							<Button
								size="small"
								color="error"
								onClick={() =>
									void update
										.mutateAsync({ id: row.original.id, status: 'REJECTED' })
										.then(() => enqueueSnackbar('Request rejected', { variant: 'success' }))
										.catch((error: unknown) =>
											enqueueSnackbar(
												error instanceof Error ? error.message : 'Could not reject',
												{ variant: 'error' }
											)
										)
								}
							>
								Reject
							</Button>
						</div>
					) : (
						<span>—</span>
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
					title="Wallet requests"
					subtitle="Deposits credit after on-chain payment. Withdrawals within auto limits are sent immediately; the rest wait here. Do not reject a payout that is already sending."
				/>
			}
			content={
				<Paper
					className="flex min-w-0 w-full flex-col rounded-b-none"
					elevation={2}
				>
					<DataTable
						data={requests}
						columns={columns}
						enableRowActions={false}
						enableRowSelection={false}
					/>
				</Paper>
			}
		/>
	);
}

export default WalletRequestsView;
