'use client';

import { useMemo, useState } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import FuseLoading from '@fuse/core/FuseLoading';
import FusePageCarded from '@fuse/core/FusePageCarded';
import { styled } from '@mui/material/styles';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Link from '@fuse/core/Link';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import { format } from 'date-fns';
import AdminPageHeader from '@/app/(control-panel)/ops/components/AdminPageHeader';
import { useInvitePartner, usePartners, useReviewPartner } from '@/app/(control-panel)/ops/api/hooks/useAffiliates';
import type { AffiliateDealType, AffiliatePartner } from '@/app/(control-panel)/ops/api/types';
import { formatMoney } from '@/lib/money';
import { statusLabel } from '@/lib/status-label';

const Root = styled(FusePageCarded)(() => ({
	'& .container': {
		maxWidth: '100%!important'
	}
}));

const emptyForm = {
	name: '',
	email: '',
	dealType: 'HYBRID' as AffiliateDealType,
	cpaAmount: '50',
	revSharePercent: '25',
	minFtdAmount: '20',
	notes: '',
	password: ''
};

function PartnersView() {
	const { data: partners = [], isLoading } = usePartners();
	const invite = useInvitePartner();
	const review = useReviewPartner();
	const rows = useMemo(
		() =>
			[...partners].sort((a, b) => Number(b.status === 'INVITED') - Number(a.status === 'INVITED')),
		[partners]
	);
	const [open, setOpen] = useState(false);
	const [form, setForm] = useState(emptyForm);
	const [created, setCreated] = useState<AffiliatePartner | null>(null);

	const columns = useMemo<MRT_ColumnDef<AffiliatePartner>[]>(
		() => [
			{
				accessorKey: 'name',
				header: 'Partner',
				Cell: ({ row }) => (
					<div>
						<Typography
							component={Link}
							to={`/apps/partners/${row.original.id}`}
							className="font-medium"
						>
							<u>{row.original.name}</u>
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
			{ accessorKey: 'code', header: 'Code' },
			{
				accessorKey: 'dealType',
				header: 'Deal',
				Cell: ({ row }) => {
					const deal = row.original;
					const floor = deal.minFtdAmount > 0 ? ` · FTD ${formatMoney(deal.minFtdAmount)}+` : '';
					if (deal.dealType === 'CPA') return `CPA ${formatMoney(deal.cpaAmount)}${floor}`;
					if (deal.dealType === 'REVSHARE') return `${deal.revSharePercent}% RS${floor}`;
					return `CPA ${formatMoney(deal.cpaAmount)} + ${deal.revSharePercent}% RS${floor}`;
				}
			},
			{
				accessorKey: 'status',
				header: 'Status',
				Cell: ({ row }) => (
					<Chip
						size="small"
						label={row.original.status === 'INVITED' ? 'Pending approval' : statusLabel(row.original.status)}
						color={
							row.original.status === 'ACTIVE'
								? 'success'
								: row.original.status === 'INVITED' || row.original.status === 'PAUSED'
									? 'warning'
									: 'default'
						}
						variant="outlined"
					/>
				)
			},
			{
				id: 'signups',
				header: 'Invited',
				accessorFn: (row) => row.stats?.signups || 0
			},
			{
				id: 'ftds',
				header: 'Qualified',
				accessorFn: (row) => row.stats?.ftds || 0
			},
			{
				id: 'expected',
				header: 'Expected',
				accessorFn: (row) => (row.stats?.bookedCpa || 0) + (row.stats?.estimatedRevShare || 0),
				Cell: ({ row }) =>
					formatMoney((row.original.stats?.bookedCpa || 0) + (row.original.stats?.estimatedRevShare || 0))
			},
			{
				id: 'pending',
				header: 'Pending',
				accessorFn: (row) => row.stats?.pending || 0,
				Cell: ({ row }) => formatMoney(row.original.stats?.pending || 0)
			},
			{
				accessorKey: 'createdAt',
				header: 'Applied',
				Cell: ({ cell }) => format(new Date(cell.getValue<string>()), 'MMM d, yyyy')
			},
			{
				id: 'review',
				header: 'Review',
				enableSorting: false,
				Cell: ({ row }) =>
					row.original.status === 'INVITED' ? (
						<div className="flex gap-2">
							<Button
								size="small"
								variant="contained"
								color="secondary"
								disabled={review.isPending}
								onClick={() => void review.mutateAsync({ id: row.original.id, status: 'ACTIVE' })}
							>
								Approve
							</Button>
							<Button
								size="small"
								disabled={review.isPending}
								onClick={() => void review.mutateAsync({ id: row.original.id, status: 'CLOSED' })}
							>
								Decline
							</Button>
						</div>
					) : null
			}
		],
		[review.isPending]
	);

	async function handleInvite() {
		const partner = await invite.mutateAsync({
			name: form.name,
			email: form.email,
			dealType: form.dealType,
			cpaAmount: Number(form.cpaAmount || 0),
			revSharePercent: Number(form.revSharePercent || 0),
			minFtdAmount: Number(form.minFtdAmount || 0),
			notes: form.notes,
			password: form.password || undefined
		});
		setCreated(partner);
	}

	if (isLoading) {
		return <FuseLoading />;
	}

	return (
		<Root
			header={
				<AdminPageHeader
					title="Affiliate partners"
					subtitle="Approve sign-ups, invite partners, and set deal terms"
					action={
						<Button
							variant="contained"
							color="secondary"
							startIcon={<FuseSvgIcon>lucide:plus</FuseSvgIcon>}
							onClick={() => {
								setCreated(null);
								setForm(emptyForm);
								setOpen(true);
							}}
						>
							Invite partner
						</Button>
					}
				/>
			}
			content={
				<Paper
					className="flex min-w-0 w-full flex-col rounded-b-none"
					elevation={2}
				>
					<DataTable
						data={rows}
						columns={columns}
						enableRowActions={false}
						enableRowSelection={false}
					/>
					<Dialog
						open={open}
						onClose={() => setOpen(false)}
						fullWidth
						maxWidth="sm"
					>
						<DialogTitle>{created ? 'Partner invited' : 'Invite affiliate partner'}</DialogTitle>
						<DialogContent className="flex flex-col gap-4 pt-2">
							{created ? (
								<>
									<Alert severity="success">
										Share these credentials once. The partner signs in to this admin with their own portal.
									</Alert>
									<TextField
										label="Tracking link"
										value={created.trackingLink}
										fullWidth
										slotProps={{ input: { readOnly: true } }}
									/>
									<TextField
										label="Email"
										value={created.email}
										fullWidth
										slotProps={{ input: { readOnly: true } }}
									/>
									<TextField
										label="Temporary password"
										value={created.temporaryPassword || ''}
										fullWidth
										slotProps={{ input: { readOnly: true } }}
									/>
								</>
							) : (
								<>
									<TextField
										label="Name"
										value={form.name}
										onChange={(event) => setForm({ ...form, name: event.target.value })}
										fullWidth
									/>
									<TextField
										label="Email"
										type="email"
										value={form.email}
										onChange={(event) => setForm({ ...form, email: event.target.value })}
										fullWidth
									/>
									<TextField
										select
										label="Deal type"
										value={form.dealType}
										onChange={(event) =>
											setForm({ ...form, dealType: event.target.value as AffiliateDealType })
										}
										fullWidth
									>
										<MenuItem value="CPA">CPA — fixed payout on first deposit</MenuItem>
										<MenuItem value="REVSHARE">Rev share — percent of referred GGR</MenuItem>
										<MenuItem value="HYBRID">Hybrid — CPA plus rev share</MenuItem>
									</TextField>
									{form.dealType !== 'REVSHARE' && (
										<TextField
											label="CPA amount"
											type="number"
											value={form.cpaAmount}
											onChange={(event) => setForm({ ...form, cpaAmount: event.target.value })}
											fullWidth
										/>
									)}
									{form.dealType !== 'CPA' && (
										<TextField
											label="Rev share %"
											type="number"
											value={form.revSharePercent}
											onChange={(event) => setForm({ ...form, revSharePercent: event.target.value })}
											fullWidth
										/>
									)}
									<TextField
										label="FTD floor"
										type="number"
										value={form.minFtdAmount}
										onChange={(event) => setForm({ ...form, minFtdAmount: event.target.value })}
										helperText="Minimum first deposit to qualify. 0 means any deposit counts."
										fullWidth
									/>
									<TextField
										label="Portal password (optional)"
										helperText="Leave blank to generate one"
										value={form.password}
										onChange={(event) => setForm({ ...form, password: event.target.value })}
										fullWidth
									/>
									<TextField
										label="Internal notes"
										value={form.notes}
										onChange={(event) => setForm({ ...form, notes: event.target.value })}
										multiline
										minRows={2}
										fullWidth
									/>
									{invite.isError && (
										<Alert severity="error">
											{invite.error instanceof Error ? invite.error.message : 'Invite failed'}
										</Alert>
									)}
								</>
							)}
						</DialogContent>
						<DialogActions>
							<Button onClick={() => setOpen(false)}>{created ? 'Done' : 'Cancel'}</Button>
							{!created && (
								<Button
									variant="contained"
									color="secondary"
									onClick={() => void handleInvite()}
									disabled={invite.isPending || !form.name || !form.email}
								>
									Invite
								</Button>
							)}
						</DialogActions>
					</Dialog>
				</Paper>
			}
		/>
	);
}

export default PartnersView;
