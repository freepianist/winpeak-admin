'use client';

import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import FuseLoading from '@fuse/core/FuseLoading';
import FusePageCarded from '@fuse/core/FusePageCarded';
import { Chip, Paper } from '@mui/material';
import Typography from '@mui/material/Typography';
import Link from '@fuse/core/Link';
import { format } from 'date-fns';
import { styled } from '@mui/material/styles';
import AdminPageHeader from '@/app/(control-panel)/ops/components/AdminPageHeader';
import { useLedger } from '@/app/(control-panel)/ops/api/hooks/useLedger';
import type { LedgerItem } from '@/app/(control-panel)/ops/api/types';
import { formatMoney } from '@/lib/money';

const Root = styled(FusePageCarded)(() => ({
	'& .container': {
		maxWidth: '100%!important'
	}
}));

const kindColor: Record<string, 'default' | 'success' | 'error' | 'warning' | 'info'> = {
	BONUS: 'success',
	CASHBACK: 'info',
	REFERRAL: 'success',
	DEPOSIT: 'success',
	WITHDRAW: 'warning',
	WIN: 'info',
	BET: 'default',
	CANCEL: 'error'
};

function LedgerView() {
	const { data: entries = [], isLoading } = useLedger();

	const columns = useMemo<MRT_ColumnDef<LedgerItem>[]>(
		() => [
			{
				accessorKey: 'createdAt',
				header: 'When',
				Cell: ({ cell }) => format(new Date(cell.getValue<string>()), 'MMM d, yyyy HH:mm')
			},
			{
				accessorKey: 'playerName',
				header: 'Player',
				Cell: ({ row }) => (
					<div>
						<Typography
							component={Link}
							to={`/apps/players/${row.original.userId}`}
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
			{
				accessorKey: 'kind',
				header: 'Kind',
				Cell: ({ cell }) => {
					const kind = cell.getValue<string>();
					return (
						<Chip
							size="small"
							label={kind}
							color={kindColor[kind] || 'default'}
							variant="outlined"
						/>
					);
				}
			},
			{
				accessorKey: 'amount',
				header: 'Amount',
				Cell: ({ cell }) => formatMoney(cell.getValue<number>())
			},
			{
				accessorKey: 'balanceAfter',
				header: 'Balance after',
				Cell: ({ cell }) => formatMoney(cell.getValue<number>())
			},
			{
				accessorKey: 'gameCode',
				header: 'Game',
				Cell: ({ cell }) => cell.getValue<string>() || '—'
			},
			{
				accessorKey: 'roundId',
				header: 'Round',
				Cell: ({ cell }) => cell.getValue<string>() || '—'
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
					title="Ledger"
					subtitle="Deposits, withdrawals, bets, wins, and cancels"
				/>
			}
			content={
				<Paper
					className="flex min-w-0 w-full flex-col rounded-b-none"
					elevation={2}
				>
					<DataTable
						data={entries}
						columns={columns}
						enableRowActions={false}
						enableRowSelection={false}
					/>
				</Paper>
			}
		/>
	);
}

export default LedgerView;
