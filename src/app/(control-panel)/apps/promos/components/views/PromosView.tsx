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
import {
	useCreatePromo,
	useDeletePromo,
	useForfeitBonus,
	usePromos,
	useRunCashback,
	useUpdatePromo
} from '@/app/(control-panel)/ops/api/hooks/usePromos';
import type {
	NewPromoOffer,
	PlayerBonus,
	PromoKind,
	PromoMarket,
	PromoOffer
} from '@/app/(control-panel)/ops/api/types';
import { formatMoney } from '@/lib/money';
import { statusLabel } from '@/lib/status-label';

const Root = styled(FusePageCarded)(() => ({
	'& .container': {
		maxWidth: '100%!important'
	}
}));

/** The offer every market falls back to, kept out of the market codes' namespace. */
const HOUSE = 'HOUSE';

const KINDS: { value: PromoKind; label: string }[] = [
	{ value: 'WELCOME', label: 'Welcome match' },
	{ value: 'RELOAD', label: 'Reload' },
	{ value: 'CASHBACK', label: 'Weekly cashback' },
	{ value: 'REFERRAL', label: 'Refer a friend' }
];

/** A market's own offer replaces the house one; anything it skips falls back. */
const BLANK: NewPromoOffer = {
	market: null,
	kind: 'WELCOME',
	name: '',
	headline: '',
	details: '',
	depositNumber: 1,
	status: 'ACTIVE',
	matchPercent: 100,
	maxAmount: 100,
	minDeposit: 20,
	wagerMultiplier: 30,
	expireDays: 14,
	maxBet: 5,
	rewardAmount: 0
};

type Draft = NewPromoOffer & { id?: string };

function marketName(market: string | null) {
	return market || 'All markets';
}

function errorMessage(error: unknown, fallback: string) {
	return error instanceof Error ? error.message : fallback;
}

function PromosView() {
	const { data, isLoading } = usePromos();
	const createPromo = useCreatePromo();
	const updatePromo = useUpdatePromo();
	const deletePromo = useDeletePromo();
	const runCashback = useRunCashback();
	const forfeitBonus = useForfeitBonus();
	const [draft, setDraft] = useState<Draft | null>(null);

	const markets = useMemo(() => data?.markets || [], [data]);
	const marketByCode = useMemo(() => new Map(markets.map((market) => [market.country, market])), [markets]);

	const offerColumns = useMemo<MRT_ColumnDef<PromoOffer>[]>(
		() => [
			{
				accessorFn: (row) => marketName(row.market),
				id: 'market',
				header: 'Market',
				Cell: ({ row }) => {
					const market = row.original.market;
					const known = market ? marketByCode.get(market) : null;
					return (
						<Chip
							size="small"
							label={market ? `${market}${known?.currency ? ` · ${known.currency}` : ''}` : 'All markets'}
							color={market ? 'primary' : 'default'}
							variant={market && !known?.configured ? 'filled' : 'outlined'}
							title={
								market && !known?.configured
									? `${market} is no longer a configured market, so nobody is served this offer`
									: undefined
							}
						/>
					);
				}
			},
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
							onClick={() => setDraft({ ...row.original })}
						>
							Edit
						</Button>
						<Button
							size="small"
							onClick={() =>
								void updatePromo
									.mutateAsync({
										id: row.original.id,
										status: row.original.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
									})
									.catch((error: unknown) => {
										enqueueSnackbar(errorMessage(error, 'Could not change the offer'), {
											variant: 'error'
										});
									})
							}
						>
							{row.original.status === 'ACTIVE' ? 'Pause' : 'Activate'}
						</Button>
						<Button
							size="small"
							color="error"
							onClick={() =>
								void deletePromo
									.mutateAsync(row.original.id)
									.then(() => {
										enqueueSnackbar(`${row.original.name} deleted`, { variant: 'success' });
									})
									.catch((error: unknown) => {
										enqueueSnackbar(errorMessage(error, 'Could not delete the offer'), {
											variant: 'error'
										});
									})
							}
						>
							Delete
						</Button>
					</div>
				)
			}
		],
		[deletePromo, marketByCode, updatePromo]
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
			{
				accessorKey: 'offerName',
				header: 'Offer',
				Cell: ({ row }) => (
					<div>
						<Typography>{row.original.offerName}</Typography>
						<Typography
							className="text-sm"
							color="text.secondary"
						>
							{marketName(row.original.offerMarket)}
						</Typography>
					</div>
				)
			},
			{
				accessorKey: 'bonusAmount',
				header: 'Bonus',
				Cell: ({ cell, row }) => formatMoney(cell.getValue<number>(), row.original.currency)
			},
			{
				accessorKey: 'wagerRemaining',
				header: 'Wager left',
				Cell: ({ row }) =>
					`${formatMoney(row.original.wagerRemaining, row.original.currency)} / ${formatMoney(row.original.wagerRequired, row.original.currency)}`
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

	const draftMarket: PromoMarket | null = draft?.market ? marketByCode.get(draft.market) || null : null;
	const localPreview = (amount: number | undefined) => {
		if (!draftMarket?.fxRate || !amount) return 'USD';

		return `USD — about ${formatMoney(amount * draftMarket.fxRate, draftMarket.currency)} on ${draftMarket.country}`;
	};

	const save = () => {
		if (!draft) return;

		const { id, ...body } = draft;
		const request = id ? updatePromo.mutateAsync({ ...body, id }) : createPromo.mutateAsync(body);
		void request
			.then(() => {
				enqueueSnackbar(`${draft.name} saved to ${marketName(draft.market)}`, { variant: 'success' });
				setDraft(null);
			})
			.catch((error: unknown) => {
				enqueueSnackbar(errorMessage(error, 'Could not save the offer'), { variant: 'error' });
			});
	};

	return (
		<Root
			header={
				<AdminPageHeader
					title="Promotions"
					subtitle="Welcome match, reloads, weekly cashback, and friend referrals, per market"
					action={
						<div className="flex gap-2">
							<Button
								variant="contained"
								onClick={() => setDraft({ ...BLANK })}
							>
								New promotion
							</Button>
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
											enqueueSnackbar(errorMessage(error, 'Cashback run failed'), {
												variant: 'error'
											});
										})
								}
							>
								Run weekly cashback
							</Button>
						</div>
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
						open={Boolean(draft)}
						onClose={() => setDraft(null)}
						fullWidth
						maxWidth="sm"
					>
						<DialogTitle>{draft?.id ? `Edit ${draft.name}` : 'New promotion'}</DialogTitle>
						<DialogContent className="flex flex-col gap-3 pt-4">
							<TextField
								select
								label="Market"
								value={draft?.market || HOUSE}
								helperText="A market's own offer replaces the house one. Slots it skips fall back to the house set."
								onChange={(event) =>
									setDraft((current) =>
										current
											? {
													...current,
													market: event.target.value === HOUSE ? null : event.target.value
												}
											: current
									)
								}
							>
								<MenuItem value={HOUSE}>All markets (house offer)</MenuItem>
								{markets.map((market) => (
									<MenuItem
										key={market.country}
										value={market.country}
										disabled={!market.configured && draft?.market !== market.country}
									>
										{market.country}
										{market.currency ? ` · ${market.currency}` : ''}
										{market.configured ? '' : ' (removed)'}
									</MenuItem>
								))}
							</TextField>
							<TextField
								select
								label="Kind"
								value={draft?.kind || 'WELCOME'}
								disabled={Boolean(draft?.id)}
								helperText={
									draft?.id
										? 'Granted bonuses read their terms off the offer, so the kind is fixed.'
										: ' '
								}
								onChange={(event) =>
									setDraft((current) =>
										current
											? {
													...current,
													kind: event.target.value as PromoKind,
													depositNumber:
														event.target.value === 'WELCOME'
															? 1
															: event.target.value === 'RELOAD'
																? 2
																: null
												}
											: current
									)
								}
							>
								{KINDS.map((kind) => (
									<MenuItem
										key={kind.value}
										value={kind.value}
									>
										{kind.label}
									</MenuItem>
								))}
							</TextField>
							{draft?.kind === 'RELOAD' ? (
								<TextField
									select
									label="Granted on deposit"
									value={draft.depositNumber ?? 2}
									disabled={Boolean(draft.id)}
									onChange={(event) =>
										setDraft((current) =>
											current
												? { ...current, depositNumber: Number(event.target.value) }
												: current
										)
									}
								>
									<MenuItem value={2}>Second deposit</MenuItem>
									<MenuItem value={3}>Third deposit</MenuItem>
								</TextField>
							) : null}
							<TextField
								label="Name"
								value={draft?.name || ''}
								onChange={(event) =>
									setDraft((current) =>
										current ? { ...current, name: event.target.value } : current
									)
								}
								fullWidth
							/>
							<TextField
								label="Headline"
								value={draft?.headline || ''}
								onChange={(event) =>
									setDraft((current) =>
										current ? { ...current, headline: event.target.value } : current
									)
								}
								fullWidth
							/>
							<TextField
								label="Details"
								value={draft?.details || ''}
								onChange={(event) =>
									setDraft((current) =>
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
								value={draft?.matchPercent ?? 0}
								onChange={(event) =>
									setDraft((current) =>
										current ? { ...current, matchPercent: Number(event.target.value) } : current
									)
								}
							/>
							<TextField
								label="Max / cap amount"
								type="number"
								value={draft?.maxAmount ?? 0}
								helperText={localPreview(draft?.maxAmount)}
								onChange={(event) =>
									setDraft((current) =>
										current ? { ...current, maxAmount: Number(event.target.value) } : current
									)
								}
							/>
							<TextField
								label="Min deposit"
								type="number"
								value={draft?.minDeposit ?? 0}
								helperText={localPreview(draft?.minDeposit)}
								onChange={(event) =>
									setDraft((current) =>
										current ? { ...current, minDeposit: Number(event.target.value) } : current
									)
								}
							/>
							<TextField
								label="Wager multiplier"
								type="number"
								value={draft?.wagerMultiplier ?? 0}
								onChange={(event) =>
									setDraft((current) =>
										current
											? { ...current, wagerMultiplier: Number(event.target.value) }
											: current
									)
								}
							/>
							<TextField
								label="Max bet"
								type="number"
								value={draft?.maxBet ?? 0}
								helperText={localPreview(draft?.maxBet)}
								onChange={(event) =>
									setDraft((current) =>
										current ? { ...current, maxBet: Number(event.target.value) } : current
									)
								}
							/>
							<TextField
								label="Expires after (days)"
								type="number"
								value={draft?.expireDays ?? 0}
								onChange={(event) =>
									setDraft((current) =>
										current ? { ...current, expireDays: Number(event.target.value) } : current
									)
								}
							/>
							<TextField
								label="Reward amount"
								type="number"
								value={draft?.rewardAmount ?? 0}
								helperText={localPreview(draft?.rewardAmount)}
								onChange={(event) =>
									setDraft((current) =>
										current ? { ...current, rewardAmount: Number(event.target.value) } : current
									)
								}
							/>
							<TextField
								select
								label="Status"
								value={draft?.status || 'ACTIVE'}
								onChange={(event) =>
									setDraft((current) =>
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
							<Button onClick={() => setDraft(null)}>Cancel</Button>
							<Button
								variant="contained"
								disabled={!draft || createPromo.isPending || updatePromo.isPending}
								onClick={save}
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
