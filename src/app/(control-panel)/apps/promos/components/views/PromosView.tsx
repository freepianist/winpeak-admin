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
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import MenuItem from '@mui/material/MenuItem';
import Link from '@fuse/core/Link';
import { format } from 'date-fns';
import { enqueueSnackbar } from 'notistack';
import AdminPageHeader from '@/app/(control-panel)/ops/components/AdminPageHeader';
import { useForfeitBonus, usePromos, useRunCashback, useUpdatePromo } from '@/app/(control-panel)/ops/api/hooks/usePromos';
import type { PlayerBonus, PromoOffer } from '@/app/(control-panel)/ops/api/types';
import { formatMoney } from '@/lib/money';
import { statusLabel } from '@/lib/status-label';

const Root = styled(FusePageCarded)(() => ({
	'& .container': {
		maxWidth: '100%!important'
	}
}));

function PromosView() {
	const { data, isLoading } = usePromos();
	const updatePromo = useUpdatePromo();
	const runCashback = useRunCashback();
	const forfeitBonus = useForfeitBonus();
	const [editing, setEditing] = useState<PromoOffer | null>(null);

	const offerColumns = useMemo<MRT_ColumnDef<PromoOffer>[]>(
		() => [
			{ accessorKey: 'name', header: 'Offer' },
			{ accessorKey: 'kind', header: 'Kind' },
			{ accessorKey: 'headline', header: 'Headline' },
			{
				accessorKey: 'status',
				header: 'Status',
				Cell: ({ row }) => (
					<Chip
						size="small"
						label={statusLabel(row.original.status)}
						color={row.original.status === 'ACTIVE' ? 'success' : 'default'}
						variant="outlined"
					/>
				)
			},
			{
				id: 'actions',
				header: 'Actions',
				Cell: ({ row }) => (
					<div className="flex gap-1">
						<Button
							size="small"
							onClick={() => setEditing(row.original)}
						>
							Edit
						</Button>
						<Button
							size="small"
							onClick={() =>
								void updatePromo.mutateAsync({
									id: row.original.id,
									status: row.original.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
								})
							}
						>
							{row.original.status === 'ACTIVE' ? 'Pause' : 'Activate'}
						</Button>
					</div>
				)
			}
		],
		[updatePromo]
	);

	const bonusColumns = useMemo<MRT_ColumnDef<PlayerBonus>[]>(
		() => [
			{
				accessorKey: 'playerName',
				header: 'Player',
				Cell: ({ row }) => (
					<div>
						<Typography
							component={Link}
							to={`/apps/players/${row.original.userId}`}
						>
							<u>{row.original.playerName || row.original.playerEmail}</u>
						</Typography>
						<Typography
							className="text-sm"
							color="text.secondary"
						>
							{row.original.playerEmail}
						</Typography>
					</div>
				)
			},
			{ accessorKey: 'offerName', header: 'Offer' },
			{
				accessorKey: 'bonusAmount',
				header: 'Bonus',
				Cell: ({ cell }) => formatMoney(cell.getValue<number>())
			},
			{
				accessorKey: 'wagerRemaining',
				header: 'Wager left',
				Cell: ({ row }) =>
					`${formatMoney(row.original.wagerRemaining)} / ${formatMoney(row.original.wagerRequired)}`
			},
			{
				accessorKey: 'status',
				header: 'Status',
				Cell: ({ cell }) => statusLabel(cell.getValue<string>())
			},
			{
				accessorKey: 'grantedAt',
				header: 'Granted',
				Cell: ({ cell }) => format(new Date(cell.getValue<string>()), 'MMM d, yyyy HH:mm')
			},
			{
				id: 'forfeit',
				header: '',
				Cell: ({ row }) =>
					row.original.status === 'ACTIVE' ? (
						<Button
							size="small"
							color="error"
							onClick={() => void forfeitBonus.mutateAsync(row.original.id)}
						>
							Forfeit
						</Button>
					) : null
			}
		],
		[forfeitBonus]
	);

	if (isLoading) {
		return <FuseLoading />;
	}

	const offers = data?.offers || [];
	const bonuses = data?.bonuses || [];

	return (
		<Root
			header={
				<AdminPageHeader
					title="Promotions"
					subtitle="Welcome match, reloads, weekly cashback, and friend referrals"
					action={
						<Button
							variant="contained"
							color="secondary"
							disabled={runCashback.isPending}
							onClick={() =>
								void runCashback
									.mutateAsync()
									.then((result) => {
										enqueueSnackbar(
											`Cashback credited ${result.credited} players (${formatMoney(result.amount)})`,
											{ variant: 'success' }
										);
									})
									.catch((error: unknown) => {
										enqueueSnackbar(
											error instanceof Error ? error.message : 'Cashback run failed',
											{ variant: 'error' }
										);
									})
							}
						>
							Run weekly cashback
						</Button>
					}
				/>
			}
			content={
				<div className="flex flex-col gap-6 p-4 sm:p-6">
					<Typography color="text.secondary">
						{data?.cashback.lastCount || 0} cashback payouts issued totalling{' '}
						{formatMoney(data?.cashback.lastAmount || 0)}. Players also receive last
						week&apos;s cashback automatically when they open Account.
					</Typography>
					<Paper
						className="overflow-hidden rounded-xl"
						elevation={1}
					>
						<DataTable
							data={offers}
							columns={offerColumns}
							enableRowActions={false}
							enableRowSelection={false}
						/>
					</Paper>
					<Typography className="text-lg font-semibold">Granted bonuses</Typography>
					<Paper
						className="overflow-hidden rounded-xl"
						elevation={1}
					>
						<DataTable
							data={bonuses}
							columns={bonusColumns}
							enableRowActions={false}
							enableRowSelection={false}
						/>
					</Paper>
					<Dialog
						open={Boolean(editing)}
						onClose={() => setEditing(null)}
						fullWidth
						maxWidth="sm"
					>
						<DialogTitle>Edit {editing?.name}</DialogTitle>
						<DialogContent className="flex flex-col gap-3 pt-4">
							<TextField
								label="Headline"
								value={editing?.headline || ''}
								onChange={(event) =>
									setEditing((current) =>
										current ? { ...current, headline: event.target.value } : current
									)
								}
								fullWidth
							/>
							<TextField
								label="Details"
								value={editing?.details || ''}
								onChange={(event) =>
									setEditing((current) =>
										current ? { ...current, details: event.target.value } : current
									)
								}
								multiline
								minRows={3}
								fullWidth
							/>
							<TextField
								label="Match %"
								type="number"
								value={editing?.matchPercent ?? 0}
								onChange={(event) =>
									setEditing((current) =>
										current ? { ...current, matchPercent: Number(event.target.value) } : current
									)
								}
							/>
							<TextField
								label="Max / cap amount"
								type="number"
								value={editing?.maxAmount ?? 0}
								onChange={(event) =>
									setEditing((current) =>
										current ? { ...current, maxAmount: Number(event.target.value) } : current
									)
								}
							/>
							<TextField
								label="Min deposit"
								type="number"
								value={editing?.minDeposit ?? 0}
								onChange={(event) =>
									setEditing((current) =>
										current ? { ...current, minDeposit: Number(event.target.value) } : current
									)
								}
							/>
							<TextField
								label="Wager multiplier"
								type="number"
								value={editing?.wagerMultiplier ?? 0}
								onChange={(event) =>
									setEditing((current) =>
										current
											? { ...current, wagerMultiplier: Number(event.target.value) }
											: current
									)
								}
							/>
							<TextField
								label="Max bet"
								type="number"
								value={editing?.maxBet ?? 0}
								onChange={(event) =>
									setEditing((current) =>
										current ? { ...current, maxBet: Number(event.target.value) } : current
									)
								}
							/>
							<TextField
								label="Reward amount"
								type="number"
								value={editing?.rewardAmount ?? 0}
								onChange={(event) =>
									setEditing((current) =>
										current ? { ...current, rewardAmount: Number(event.target.value) } : current
									)
								}
							/>
							<TextField
								select
								label="Status"
								value={editing?.status || 'ACTIVE'}
								onChange={(event) =>
									setEditing((current) =>
										current
											? { ...current, status: event.target.value as PromoOffer['status'] }
											: current
									)
								}
							>
								<MenuItem value="ACTIVE">Active</MenuItem>
								<MenuItem value="PAUSED">Paused</MenuItem>
							</TextField>
						</DialogContent>
						<DialogActions>
							<Button onClick={() => setEditing(null)}>Cancel</Button>
							<Button
								variant="contained"
								disabled={!editing || updatePromo.isPending}
								onClick={() => {
									if (!editing) return;
									void updatePromo.mutateAsync(editing).then(() => setEditing(null));
								}}
							>
								Save
							</Button>
						</DialogActions>
					</Dialog>
				</div>
			}
		/>
	);
}

export default PromosView;
