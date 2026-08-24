'use client';

import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import FuseLoading from '@fuse/core/FuseLoading';
import { Chip, Paper } from '@mui/material';
import Typography from '@mui/material/Typography';
import Link from '@fuse/core/Link';
import { format } from 'date-fns';
import { usePlayers } from '@/app/(control-panel)/ops/api/hooks/usePlayers';
import type { Player } from '@/app/(control-panel)/ops/api/types';
import { formatMoney } from '@/lib/money';
import { playerAccountChip } from '@/lib/player-status';

function PlayersTable() {
	const { data: players = [], isLoading } = usePlayers();

	const columns = useMemo<MRT_ColumnDef<Player>[]>(
		() => [
			{
				accessorKey: 'displayName',
				header: 'Player',
				Cell: ({ row }) => (
					<div>
						<Typography
							component={Link}
							to={`/apps/players/${row.original.id}`}
							className="font-medium"
						>
							<u>{row.original.displayName}</u>
						</Typography>
						<Typography
							className="text-sm"
							color="text.secondary"
						>
							{row.original.email}
						</Typography>
					</div>
				)
			},
			{
				accessorKey: 'balance',
				header: 'Balance',
				Cell: ({ row }) => formatMoney(row.original.balance, row.original.currency)
			},
			{
				accessorKey: 'status',
				header: 'Status',
				Cell: ({ row }) => {
					const chip = playerAccountChip(row.original);
					return (
						<Chip
							size="small"
							label={chip.label}
							color={chip.color}
							variant="outlined"
						/>
					);
				}
			},
			{
				accessorKey: 'ledgerCount',
				header: 'Txns'
			},
			{
				accessorKey: 'scorpioPlayerCode',
				header: 'Scorpio ID',
				Cell: ({ cell }) => cell.getValue<number | null>() || '—'
			},
			{
				accessorKey: 'createdAt',
				header: 'Joined',
				Cell: ({ cell }) => format(new Date(cell.getValue<string>()), 'MMM d, yyyy')
			}
		],
		[]
	);

	if (isLoading) {
		return <FuseLoading />;
	}

	return (
		<Paper
			className="flex h-full w-full flex-auto flex-col overflow-hidden rounded-b-none"
			elevation={2}
		>
			<DataTable
				data={players}
				columns={columns}
				enableRowActions={false}
				enableRowSelection={false}
			/>
		</Paper>
	);
}

export default PlayersTable;
