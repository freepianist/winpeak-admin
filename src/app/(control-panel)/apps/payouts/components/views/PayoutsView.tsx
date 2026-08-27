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
import Link from '@fuse/core/Link';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import { format } from 'date-fns';
import { statusLabel } from '@/lib/status-label';
import { enqueueSnackbar } from 'notistack';
import AdminPageHeader from '@/app/(control-panel)/ops/components/AdminPageHeader';
import { useCreatePayout, usePartners, usePayouts, useUpdatePayout } from '@/app/(control-panel)/ops/api/hooks/useAffiliates';
import type { AffiliatePayout } from '@/app/(control-panel)/ops/api/types';
import { formatMoney } from '@/lib/money';

const Root = styled(FusePageCarded)(() => ({
	'& .container': {
		maxWidth: '100%!important'
	}
}));

function PayoutsView() {
	const { data: payouts = [], isLoading } = usePayouts();
	const { data: partners = [] } = usePartners();
	const create = useCreatePayout();
	const update = useUpdatePayout();
	const [open, setOpen] = useState(false);
	const [partnerId, setPartnerId] = useState('');
	const [amount, setAmount] = useState('');
	const [note, setNote] = useState('');

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
			{ accessorKey: 'note', header: 'Note' },
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
					subtitle="Record money you sent a partner. They can see these, but cannot create them."
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
					className="flex min-w-0 w-full flex-col rounded-b-none"
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
						onClose={() => setOpen(false)}
						fullWidth
						maxWidth="sm"
					>
						<DialogTitle>Record payout</DialogTitle>
						<DialogContent className="flex flex-col gap-4 pt-2">
							<TextField
								select
								label="Partner"
								value={partnerId}
								onChange={(event) => setPartnerId(event.target.value)}
								fullWidth
							>
								{partners.map((partner) => (
									<MenuItem
										key={partner.id}
										value={partner.id}
									>
										{partner.name} · {partner.code}
									</MenuItem>
								))}
							</TextField>
							<TextField
								label="Amount"
								type="number"
								value={amount}
								onChange={(event) => setAmount(event.target.value)}
								fullWidth
							/>
							<TextField
								label="Note"
								value={note}
								onChange={(event) => setNote(event.target.value)}
								fullWidth
							/>
						</DialogContent>
						<DialogActions>
							<Button onClick={() => setOpen(false)}>Cancel</Button>
							<Button
								variant="contained"
								color="secondary"
								disabled={create.isPending || !partnerId || !amount}
								onClick={() =>
									void create
										.mutateAsync({ partnerId, amount: Number(amount), note, status: 'SENT' })
										.then(() => {
											enqueueSnackbar('Payout recorded', { variant: 'success' });
											setOpen(false);
											setAmount('');
											setNote('');
										})
								}
							>
								Save
							</Button>
						</DialogActions>
					</Dialog>
				</Paper>
			}
		/>
	);
}

export default PayoutsView;
