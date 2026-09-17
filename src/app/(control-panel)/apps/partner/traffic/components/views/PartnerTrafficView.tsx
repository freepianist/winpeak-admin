'use client';

import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import FuseLoading from '@fuse/core/FuseLoading';
import FusePageCarded from '@fuse/core/FusePageCarded';
import { styled } from '@mui/material/styles';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import { format } from 'date-fns';
import AdminPageHeader from '@/app/(control-panel)/ops/components/AdminPageHeader';
import { useMyAffiliate } from '@/app/(control-panel)/ops/api/hooks/useAffiliates';
import type { AffiliateClick } from '@/app/(control-panel)/ops/api/types';
import {
	AFFILIATE_VISIT_FILTERS,
	deviceLabel,
	locationLabel,
	visitCountLabel,
	visitTypeColor,
	visitTypeLabel,
	visitTypeOf
} from '@/lib/affiliate-traffic';

const Root = styled(FusePageCarded)(() => ({
	'& .container': {
		maxWidth: '100%!important'
	}
}));

function PartnerTrafficView() {
	const { data, isLoading } = useMyAffiliate();
	const clicks = data?.clicks || [];
	const stats = data?.stats;
	const total = stats?.clicks || 0;
	const unique = stats?.uniqueClicks || 0;
	const refresh = stats?.refreshClicks || 0;
	const repeat = stats?.repeatClicks ?? Math.max(0, total - unique - refresh);

	const columns = useMemo<MRT_ColumnDef<AffiliateClick>[]>(
		() => [
			{
				accessorKey: 'createdAt',
				header: 'When',
				Cell: ({ cell }) => format(new Date(cell.getValue<string>()), 'MMM d, yyyy h:mm a')
			},
			{
				accessorKey: 'visitType',
				header: 'Visit type',
				filterVariant: 'select',
				filterSelectOptions: AFFILIATE_VISIT_FILTERS,
				Cell: ({ row }) => {
					const visitType = visitTypeOf(row.original);
					return (
						<Chip
							size="small"
							variant="outlined"
							color={visitTypeColor(visitType)}
							label={visitTypeLabel(visitType)}
						/>
					);
				}
			},
			{
				accessorKey: 'visitNumber',
				header: 'Visit #',
				Cell: ({ row }) => visitCountLabel(row.original)
			},
			{
				accessorKey: 'visitorLabel',
				header: 'Visitor',
				Cell: ({ cell }) => cell.getValue<string>() || '—'
			},
			{
				id: 'device',
				header: 'Device',
				accessorFn: (row) => deviceLabel(row),
				Cell: ({ row }) => deviceLabel(row.original)
			},
			{
				id: 'location',
				header: 'Location',
				accessorFn: (row) => locationLabel(row),
				Cell: ({ row }) => locationLabel(row.original)
			},
			{
				accessorKey: 'landingPath',
				header: 'Landing page',
				Cell: ({ cell }) => {
					const path = cell.getValue<string>();
					return !path || path === '/' ? 'Home' : path;
				}
			},
			{
				accessorKey: 'source',
				header: 'Came from',
				Cell: ({ cell }) => cell.getValue<string>() || 'Direct'
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
					title="My traffic"
					subtitle={`${total.toLocaleString()} visits · ${unique.toLocaleString()} unique · ${repeat.toLocaleString()} repeat · ${refresh.toLocaleString()} refresh · ${stats?.signups || 0} signups · ${stats?.ftds || 0} first deposits`}
				/>
			}
			content={
				<Paper
					className="flex w-full min-w-0 flex-col rounded-b-none"
					elevation={2}
				>
					<DataTable
						data={clicks}
						columns={columns}
						enableRowActions={false}
						enableRowSelection={false}
					/>
				</Paper>
			}
		/>
	);
}

export default PartnerTrafficView;
