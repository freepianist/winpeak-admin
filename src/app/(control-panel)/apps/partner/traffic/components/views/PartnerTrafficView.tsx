'use client';

import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import FuseLoading from '@fuse/core/FuseLoading';
import FusePageCarded from '@fuse/core/FusePageCarded';
import { styled } from '@mui/material/styles';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { format } from 'date-fns';
import AdminPageHeader from '@/app/(control-panel)/ops/components/AdminPageHeader';
import { useMyAffiliate } from '@/app/(control-panel)/ops/api/hooks/useAffiliates';
import type { AffiliateClick } from '@/app/(control-panel)/ops/api/types';

const Root = styled(FusePageCarded)(() => ({
	'& .container': {
		maxWidth: '100%!important'
	}
}));

function PartnerTrafficView() {
	const { data, isLoading } = useMyAffiliate();
	const clicks = data?.clicks || [];
	const stats = data?.stats;

	const columns = useMemo<MRT_ColumnDef<AffiliateClick>[]>(
		() => [
			{
				accessorKey: 'createdAt',
				header: 'When',
				Cell: ({ cell }) => format(new Date(cell.getValue<string>()), 'MMM d, yyyy h:mm a')
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
					subtitle={`${(stats?.clicks || 0).toLocaleString()} clicks · ${(stats?.uniqueClicks || 0).toLocaleString()} unique visitors · ${stats?.signups || 0} signups · ${stats?.ftds || 0} first deposits`}
				/>
			}
			content={
				<Paper
					className="flex min-w-0 w-full flex-col rounded-b-none"
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
