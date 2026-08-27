'use client';

import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import FuseLoading from '@fuse/core/FuseLoading';
import FusePageCarded from '@fuse/core/FusePageCarded';
import { styled } from '@mui/material/styles';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { format } from 'date-fns';
import AdminPageHeader from '@/app/(control-panel)/ops/components/AdminPageHeader';
import { useMyAffiliate } from '@/app/(control-panel)/ops/api/hooks/useAffiliates';
import type { AffiliatePlayer } from '@/app/(control-panel)/ops/api/types';

const Root = styled(FusePageCarded)(() => ({
	'& .container': {
		maxWidth: '100%!important'
	}
}));

function PartnerPlayersView() {
	const { data, isLoading } = useMyAffiliate();
	const players = data?.players || [];

	const columns = useMemo<MRT_ColumnDef<AffiliatePlayer>[]>(
		() => [
			{
				accessorKey: 'label',
				header: 'Player',
				Cell: ({ row }) => (
					<div>
						<Typography className="font-medium">{row.original.label || row.original.displayName}</Typography>
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
				accessorKey: 'qualified',
				header: 'Status',
				Cell: ({ row }) => (
					<Chip
						size="small"
						label={row.original.qualified ? 'First deposit' : 'Registered'}
						color={row.original.qualified ? 'success' : 'default'}
						variant="outlined"
					/>
				)
			},
			{
				accessorKey: 'joinedAt',
				header: 'Joined',
				Cell: ({ cell }) => format(new Date(cell.getValue<string>()), 'MMM d, yyyy')
			},
			{
				accessorKey: 'firstDepositAt',
				header: 'First deposit',
				Cell: ({ cell }) => {
					const value = cell.getValue<string | null>();
					return value ? format(new Date(value), 'MMM d, yyyy') : '—';
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
					title="My players"
					subtitle="Players who registered through your link. Emails are masked and balances stay hidden."
				/>
			}
			content={
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
			}
		/>
	);
}

export default PartnerPlayersView;
