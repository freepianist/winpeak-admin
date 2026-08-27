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
import { useBlockedCountries } from '@/app/(control-panel)/ops/api/hooks/useBlockedCountries';
import type { Player } from '@/app/(control-panel)/ops/api/types';
import { formatMoney } from '@/lib/money';
import { isPlayerCountryBlocked, playerAccountChip } from '@/lib/player-status';
import { countryLabel } from '@/lib/countries';

function PlayersTable() {
	const { data: players = [], isLoading } = usePlayers();
	const { data: blockedCountries = [] } = useBlockedCountries();
	const blockedCodes = useMemo(
		() => blockedCountries.map((row) => row.code),
		[blockedCountries]
	);

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
					const chip = playerAccountChip(row.original, blockedCodes);
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
				accessorKey: 'country',
				header: 'Country',
				Cell: ({ row }) => {
					const name = countryLabel(row.original.country) || '—';
					if (!isPlayerCountryBlocked(row.original.country, blockedCodes)) {
						return name;
					}

					return (
						<div className="flex items-center gap-1.5">
							<span>{name}</span>
							<Chip
								size="small"
								label="Blocked"
								color="error"
								variant="outlined"
							/>
						</div>
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
		[blockedCodes]
	);

	if (isLoading) {
		return <FuseLoading />;
	}

	return (
		<Paper
			className="flex min-w-0 w-full flex-col rounded-b-none"
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
