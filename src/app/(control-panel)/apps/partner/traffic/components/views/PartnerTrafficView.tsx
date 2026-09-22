'use client';

import { useMemo, useState } from 'react';
import {
	type MRT_ColumnDef,
	type MRT_ColumnFiltersState,
	type MRT_PaginationState,
	type MRT_SortingState,
	type MRT_Updater
} from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import FusePageCarded from '@fuse/core/FusePageCarded';
import { styled } from '@mui/material/styles';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import { format } from 'date-fns';
import AdminPageHeader from '@/app/(control-panel)/ops/components/AdminPageHeader';
import { useMyAffiliate, useMyAffiliateClicks } from '@/app/(control-panel)/ops/api/hooks/useAffiliates';
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
	const { data } = useMyAffiliate();
	const stats = data?.stats;
	const total = stats?.clicks || 0;
	const unique = stats?.uniqueClicks || 0;
	const refresh = stats?.refreshClicks || 0;
	const repeat = stats?.repeatClicks ?? Math.max(0, total - unique - refresh);

	const [pagination, setPagination] = useState<MRT_PaginationState>({ pageIndex: 0, pageSize: 15 });
	const [sorting, setSorting] = useState<MRT_SortingState>([{ id: 'createdAt', desc: true }]);
	const [globalFilter, setGlobalFilter] = useState('');
	const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>([]);

	const visitType = columnFilters.find((filter) => filter.id === 'visitType')?.value as string | undefined;

	const clicksQuery = useMyAffiliateClicks({
		page: pagination.pageIndex,
		pageSize: pagination.pageSize,
		visitType: visitType || undefined,
		search: globalFilter || undefined,
		sort: sorting[0]?.desc === false ? 'asc' : 'desc'
	});

	const resetPage = () => setPagination((prev) => ({ ...prev, pageIndex: 0 }));

	const columns = useMemo<MRT_ColumnDef<AffiliateClick>[]>(
		() => [
			{
				accessorKey: 'createdAt',
				header: 'When',
				enableColumnFilter: false,
				Cell: ({ cell }) => format(new Date(cell.getValue<string>()), 'MMM d, yyyy h:mm a')
			},
			{
				accessorKey: 'visitType',
				header: 'Visit type',
				enableSorting: false,
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
				enableSorting: false,
				enableColumnFilter: false,
				Cell: ({ row }) => visitCountLabel(row.original)
			},
			{
				accessorKey: 'visitorLabel',
				header: 'Visitor',
				enableSorting: false,
				enableColumnFilter: false,
				Cell: ({ cell }) => cell.getValue<string>() || '—'
			},
			{
				id: 'device',
				header: 'Device',
				enableSorting: false,
				enableColumnFilter: false,
				accessorFn: (row) => deviceLabel(row),
				Cell: ({ row }) => deviceLabel(row.original)
			},
			{
				id: 'location',
				header: 'Location',
				enableSorting: false,
				enableColumnFilter: false,
				accessorFn: (row) => locationLabel(row),
				Cell: ({ row }) => locationLabel(row.original)
			},
			{
				accessorKey: 'landingPath',
				header: 'Landing page',
				enableSorting: false,
				enableColumnFilter: false,
				Cell: ({ cell }) => {
					const path = cell.getValue<string>();
					return !path || path === '/' ? 'Home' : path;
				}
			},
			{
				accessorKey: 'source',
				header: 'Came from',
				enableSorting: false,
				enableColumnFilter: false,
				Cell: ({ cell }) => cell.getValue<string>() || 'Direct'
			}
		],
		[]
	);

	return (
		<Root
			header={
				<AdminPageHeader
					title="My traffic"
					subtitle={
						stats
							? `${total.toLocaleString()} visits · ${unique.toLocaleString()} unique · ${repeat.toLocaleString()} repeat · ${refresh.toLocaleString()} refresh · ${stats.signups || 0} signups · ${stats.ftds || 0} first deposits`
							: undefined
					}
				/>
			}
			content={
				<Paper
					className="flex w-full min-w-0 flex-col rounded-b-none"
					elevation={2}
				>
					<DataTable
						data={clicksQuery.data?.rows || []}
						columns={columns}
						getRowId={(row) => row.id}
						enableRowActions={false}
						enableRowSelection={false}
						enableGrouping={false}
						enableFacetedValues={false}
						enableColumnFilterModes={false}
						enableMultiSort={false}
						manualPagination
						manualSorting
						manualFiltering
						rowCount={clicksQuery.data?.total ?? 0}
						onPaginationChange={setPagination}
						onSortingChange={(updater: MRT_Updater<MRT_SortingState>) => {
							setSorting(updater);
							resetPage();
						}}
						onGlobalFilterChange={(value: string | undefined) => {
							setGlobalFilter(value || '');
							resetPage();
						}}
						onColumnFiltersChange={(updater: MRT_Updater<MRT_ColumnFiltersState>) => {
							setColumnFilters(updater);
							resetPage();
						}}
						state={{
							pagination,
							sorting,
							globalFilter,
							columnFilters,
							isLoading: clicksQuery.isLoading,
							showProgressBars: clicksQuery.isFetching,
							showAlertBanner: clicksQuery.isError
						}}
						muiToolbarAlertBannerProps={
							clicksQuery.isError ? { color: 'error', children: 'Could not load traffic. Try again.' } : undefined
						}
					/>
				</Paper>
			}
		/>
	);
}

export default PartnerTrafficView;
