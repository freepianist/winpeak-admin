'use client';

import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import FuseLoading from '@fuse/core/FuseLoading';
import FusePageCarded from '@fuse/core/FusePageCarded';
import { Paper } from '@mui/material';
import { styled } from '@mui/material/styles';
import AdminPageHeader from '@/app/(control-panel)/ops/components/AdminPageHeader';
import { useGames } from '@/app/(control-panel)/ops/api/hooks/useContent';
import type { GameStat } from '@/app/(control-panel)/ops/api/types';
import { formatMoney } from '@/lib/money';

const Root = styled(FusePageCarded)(() => ({
	'& .container': {
		maxWidth: '100%!important'
	}
}));

function GamesView() {
	const { data: games = [], isLoading } = useGames();

	const columns = useMemo<MRT_ColumnDef<GameStat>[]>(
		() => [
			{ accessorKey: 'gameCode', header: 'Game' },
			{
				accessorKey: 'providerId',
				header: 'Provider',
				Cell: ({ cell }) => cell.getValue<number | null>() || '—'
			},
			{ accessorKey: 'rounds', header: 'Rounds' },
			{
				accessorKey: 'bets',
				header: 'Wagered',
				Cell: ({ cell }) => formatMoney(cell.getValue<number>())
			},
			{
				accessorKey: 'wins',
				header: 'Paid out',
				Cell: ({ cell }) => formatMoney(cell.getValue<number>())
			},
			{
				accessorKey: 'ggr',
				header: 'GGR',
				Cell: ({ cell }) => formatMoney(cell.getValue<number>())
			},
			{ accessorKey: 'reviews', header: 'Reviews' },
			{
				accessorKey: 'avgRating',
				header: 'Avg rating',
				Cell: ({ cell }) => {
					const value = cell.getValue<number>();
					return value ? value.toFixed(1) : '—';
				}
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
					title="Games"
					subtitle="Performance from live bets, wins, and reviews"
				/>
			}
			content={
				<Paper
					className="flex min-w-0 w-full flex-col rounded-b-none"
					elevation={2}
				>
					<DataTable
						data={games}
						columns={columns}
						enableRowActions={false}
						enableRowSelection={false}
					/>
				</Paper>
			}
		/>
	);
}

export default GamesView;
