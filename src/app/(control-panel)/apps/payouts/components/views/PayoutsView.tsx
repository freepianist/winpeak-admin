'use client';

import { useMemo, useState } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import FuseLoading from '@fuse/core/FuseLoading';
import FusePageCarded from '@fuse/core/FusePageCarded';
import { styled } from '@mui/material/styles';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Link from '@fuse/core/Link';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import { format } from 'date-fns';
import { statusLabel } from '@/lib/status-label';
import { enqueueSnackbar } from 'notistack';
import AdminPageHeader from '@/app/(control-panel)/ops/components/AdminPageHeader';
import {
	useCommissions,
	useCreatePayout,
	usePartners,
	usePayouts,
	useUpdatePayout
} from '@/app/(control-panel)/ops/api/hooks/useAffiliates';
import type { AffiliateCommission, AffiliatePayout } from '@/app/(control-panel)/ops/api/types';
import { formatMoney } from '@/lib/money';

const Root = styled(FusePageCarded)(() => ({
	'& .container': {
		maxWidth: '100%!important'
	}
}));

function PayoutsView() {
	const { data: payouts = [], isLoading } = usePayouts();
	const { data: partners = [] } = usePartners();
	const { data: commissions = [] } = useCommissions();
	const create = useCreatePayout();
	const update = useUpdatePayout();
	const [open, setOpen] = useState(false);
	const [partnerId, setPartnerId] = useState('');
	const [selected, setSelected] = useState<string[]>([]);
	const [note, setNote] = useState('');

	const approvedByPartner = useMemo(() => {
		const result = new Map<string, AffiliateCommission[]>();
		commissions
			.filter((row) => row.status === 'APPROVED' && !row.payoutId)
			.forEach((row) => result.set(row.partnerId, [...(result.get(row.partnerId) || []), row]));
		return result;
	}, [commissions]);

	const approved = approvedByPartner.get(partnerId) || [];
	const total = approved.filter((row) => selected.includes(row.id)).reduce((sum, row) => sum + row.amount, 0);
	const allSelected = approved.length > 0 && selected.length === approved.length;

	const sortedPartners = useMemo(
		() =>
			[...partners].sort(
				(a, b) => (approvedByPartner.get(b.id)?.length || 0) - (approvedByPartner.get(a.id)?.length || 0)
			),
		[partners, approvedByPartner]
	);

	const choosePartner = (id: string) => {
		setPartnerId(id);
		setSelected((approvedByPartner.get(id) || []).map((row) => row.id));
	};

	const toggle = (id: string) =>
		setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));

	const close = () => {
		setOpen(false);
		setPartnerId('');
		setSelected([]);
		setNote('');
	};

	const columns = useMemo<MRT_ColumnDef<AffiliatePayout>[]>(
		() => [
			{
				accessorKey: 'partnerName',
				header: 'Partner',
				Cell: ({ row }) => (
					<Typography
						component={Link}
						to={`/apps/partners/${row.original.partnerId}`}
					>
						<u>{row.original.partnerName || row.original.partnerCode}</u>
					</Typography>
				)
			},
			{
				accessorKey: 'amount',
				header: 'Amount',
				Cell: ({ row }) => formatMoney(row.original.amount)
			},
			{
				accessorKey: 'commissionCount',
				header: 'Commissions',
				Cell: ({ row }) => row.original.commissionCount || '—'
			},
			{
				accessorKey: 'status',
				header: 'Status',
				Cell: ({ row }) => (
					<Chip
						size="small"
						label={statusLabel(row.original.status)}
						color={row.original.status === 'SENT' ? 'success' : 'default'}
						variant="outlined"
					/>
				)
			},
			{ accessorKey: 'note', header: 'Reference' },
			{
				accessorKey: 'createdAt',
				header: 'When',
				Cell: ({ cell }) => format(new Date(cell.getValue<string>()), 'MMM d, yyyy')
			},
			{
				id: 'actions',
				header: 'Actions',
				Cell: ({ row }) =>
					row.original.status === 'PENDING' ? (
						<Button
							size="small"
							onClick={() =>
								void update
									.mutateAsync({ id: row.original.id, status: 'SENT' })
									.then(() => enqueueSnackbar('Payout marked sent', { variant: 'success' }))
							}
						>
							Mark sent
						</Button>
					) : null
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
					title="Affiliate payouts"
					subtitle="Pay a partner's approved commissions. Recording a payout marks them paid, and the partner sees it in their earnings."
					action={
						<Button
							variant="contained"
							color="secondary"
							startIcon={<FuseSvgIcon>lucide:plus</FuseSvgIcon>}
							onClick={() => setOpen(true)}
						>
							Record payout
						</Button>
					}
				/>
			}
			content={
				<Paper
					className="flex w-full min-w-0 flex-col rounded-b-none"
					elevation={2}
				>
					<DataTable
						data={payouts}
						columns={columns}
						enableRowActions={false}
						enableRowSelection={false}
					/>
					<Dialog
						open={open}
						onClose={close}
						fullWidth
						maxWidth="sm"
					>
						<DialogTitle>Record payout</DialogTitle>
						<DialogContent className="flex flex-col gap-4 pt-2">
							<TextField
								select
								label="Partner"
								value={partnerId}
								onChange={(event) => choosePartner(event.target.value)}
								fullWidth
							>
								{sortedPartners.map((partner) => {
									const rows = approvedByPartner.get(partner.id) || [];
									return (
										<MenuItem
											key={partner.id}
											value={partner.id}
											disabled={rows.length === 0}
										>
											<div className="flex w-full items-center justify-between gap-4">
												<span className="truncate">
													{partner.name} · {partner.code}
												</span>
												<Typography
													className="shrink-0 text-sm"
													color="text.secondary"
												>
													{rows.length
														? `${formatMoney(rows.reduce((sum, row) => sum + row.amount, 0))} approved`
														: 'Nothing approved'}
												</Typography>
											</div>
										</MenuItem>
									);
								})}
							</TextField>

							{partnerId && (
								<div className="border-divider overflow-hidden rounded-lg border border-solid">
									<div className="border-divider flex items-center justify-between gap-3 border-b border-solid py-1 pr-4 pl-1">
										<div className="flex items-center">
											<Checkbox
												size="small"
												checked={allSelected}
												indeterminate={selected.length > 0 && !allSelected}
												onChange={() =>
													setSelected(allSelected ? [] : approved.map((row) => row.id))
												}
											/>
											<Typography className="text-sm font-medium">
												Approved commissions
											</Typography>
										</div>
										<Typography
											className="text-sm"
											color="text.secondary"
										>
											{selected.length} of {approved.length} selected
										</Typography>
									</div>
									<div className="max-h-64 overflow-y-auto">
										{approved.map((row) => (
											<label
												key={row.id}
												className="hover:bg-action-hover flex cursor-pointer items-center justify-between gap-3 py-1 pr-4 pl-1"
											>
												<div className="flex min-w-0 items-center">
													<Checkbox
														size="small"
														checked={selected.includes(row.id)}
														onChange={() => toggle(row.id)}
													/>
													<div className="min-w-0">
														<Typography className="text-sm font-medium">
															{row.kind === 'CPA' ? 'CPA' : 'Rev share'}
														</Typography>
														<Typography
															className="truncate text-xs"
															color="text.secondary"
														>
															{[
																row.playerEmail,
																format(new Date(row.createdAt), 'MMM d, yyyy')
															]
																.filter(Boolean)
																.join(' · ')}
														</Typography>
													</div>
												</div>
												<Typography className="shrink-0 text-sm font-semibold">
													{formatMoney(row.amount)}
												</Typography>
											</label>
										))}
									</div>
								</div>
							)}

							<TextField
								label="Reference"
								value={note}
								onChange={(event) => setNote(event.target.value)}
								helperText="Transaction hash, payment method, or anything the partner should see."
								fullWidth
							/>

							<div className="flex items-center justify-between">
								<Typography color="text.secondary">Payout total</Typography>
								<Typography className="text-2xl font-semibold tracking-tight">
									{formatMoney(total)}
								</Typography>
							</div>
						</DialogContent>
						<DialogActions>
							<Button onClick={close}>Cancel</Button>
							<Button
								variant="contained"
								color="secondary"
								disabled={create.isPending || !partnerId || selected.length === 0}
								onClick={() =>
									void create
										.mutateAsync({ partnerId, commissionIds: selected, note })
										.then(() => {
											enqueueSnackbar('Payout recorded', { variant: 'success' });
											close();
										})
										.catch((error: Error) => enqueueSnackbar(error.message, { variant: 'error' }))
								}
							>
								{selected.length ? `Pay ${formatMoney(total)}` : 'Pay'}
							</Button>
						</DialogActions>
					</Dialog>
				</Paper>
			}
		/>
	);
}

export default PayoutsView;
