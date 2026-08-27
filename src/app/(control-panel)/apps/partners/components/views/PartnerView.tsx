'use client';

import { useEffect, useState } from 'react';
import FuseLoading from '@fuse/core/FuseLoading';
import FusePageSimple from '@fuse/core/FusePageSimple';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import useParams from '@fuse/hooks/useParams';
import Link from '@fuse/core/Link';
import { format } from 'date-fns';
import { enqueueSnackbar } from 'notistack';
import useUser from '@auth/useUser';
import AdminPageHeader from '@/app/(control-panel)/ops/components/AdminPageHeader';
import { useBookRevShare, usePartner, useUpdatePartner } from '@/app/(control-panel)/ops/api/hooks/useAffiliates';
import type { AffiliateDealType, AffiliateStatus } from '@/app/(control-panel)/ops/api/types';
import { statusLabel } from '@/lib/status-label';
import { formatMoney } from '@/lib/money';

function PartnerView() {
	const { partnerId } = useParams() as { partnerId: string };
	const { data: viewer } = useUser();
	const roles = Array.isArray(viewer?.role) ? viewer.role : viewer?.role ? [viewer.role] : [];
	const canOpenPlayers = roles.includes('admin');
	const { data, isLoading, isError } = usePartner(partnerId);
	const update = useUpdatePartner(partnerId);
	const bookRevShare = useBookRevShare(partnerId);
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [dealType, setDealType] = useState<AffiliateDealType>('HYBRID');
	const [cpaAmount, setCpaAmount] = useState('0');
	const [revSharePercent, setRevSharePercent] = useState('0');
	const [minFtdAmount, setMinFtdAmount] = useState('0');
	const [status, setStatus] = useState<AffiliateStatus>('ACTIVE');
	const [notes, setNotes] = useState('');
	const [password, setPassword] = useState('');

	useEffect(() => {
		if (!data) {
			return;
		}

		setName(data.partner.name);
		setEmail(data.partner.email);
		setDealType(data.partner.dealType);
		setCpaAmount(String(data.partner.cpaAmount || 0));
		setRevSharePercent(String(data.partner.revSharePercent || 0));
		setMinFtdAmount(String(data.partner.minFtdAmount || 0));
		setStatus(data.partner.status);
		setNotes(data.partner.notes || '');
	}, [data]);

	if (isLoading) {
		return <FuseLoading />;
	}

	if (isError || !data) {
		return (
			<div className="p-8">
				<Typography variant="h5">Partner not found</Typography>
				<Button
					component={Link}
					to="/apps/partners"
				>
					Back to partners
				</Button>
			</div>
		);
	}

	async function save() {
		await update.mutateAsync({
			name,
			email,
			dealType,
			cpaAmount: Number(cpaAmount || 0),
			revSharePercent: Number(revSharePercent || 0),
			minFtdAmount: Number(minFtdAmount || 0),
			status,
			notes,
			password: password || undefined
		});
		setPassword('');
		enqueueSnackbar('Partner updated', { variant: 'success' });
	}

	async function bookShare() {
		try {
			await bookRevShare.mutateAsync();
			enqueueSnackbar('Rev share booked as a pending commission', { variant: 'success' });
		} catch (error) {
			enqueueSnackbar(error instanceof Error ? error.message : 'Could not book rev share', { variant: 'error' });
		}
	}

	const stats = data.stats;

	return (
		<FusePageSimple
			header={
				<AdminPageHeader
					title={data.partner.name}
					subtitle={`${data.partner.dealType} · ${data.partner.code}`}
					action={
						<Button
							component={Link}
							to="/apps/partners"
						>
							All partners
						</Button>
					}
				/>
			}
			content={
				<div className="grid w-full gap-4 px-4 pt-4 pb-8 md:px-8 xl:grid-cols-3">
					<Paper className="flex flex-col gap-4 rounded-xl p-6 shadow-sm xl:col-span-2">
						<div className="grid gap-4 sm:grid-cols-2">
							<TextField
								label="Name"
								value={name}
								onChange={(event) => setName(event.target.value)}
								fullWidth
							/>
							<TextField
								label="Email"
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								fullWidth
							/>
							<TextField
								select
								label="Deal type"
								value={dealType}
								onChange={(event) => setDealType(event.target.value as AffiliateDealType)}
								fullWidth
							>
								<MenuItem value="CPA">CPA</MenuItem>
								<MenuItem value="REVSHARE">Rev share</MenuItem>
								<MenuItem value="HYBRID">Hybrid</MenuItem>
							</TextField>
							<TextField
								select
								label="Status"
								value={status}
								onChange={(event) => setStatus(event.target.value as AffiliateStatus)}
								fullWidth
							>
								<MenuItem value="INVITED">Pending approval</MenuItem>
								<MenuItem value="ACTIVE">Active</MenuItem>
								<MenuItem value="PAUSED">Paused</MenuItem>
								<MenuItem value="CLOSED">Closed</MenuItem>
							</TextField>
							{dealType !== 'REVSHARE' && (
								<TextField
									label="CPA amount"
									type="number"
									value={cpaAmount}
									onChange={(event) => setCpaAmount(event.target.value)}
									fullWidth
								/>
							)}
							{dealType !== 'CPA' && (
								<TextField
									label="Rev share %"
									type="number"
									value={revSharePercent}
									onChange={(event) => setRevSharePercent(event.target.value)}
									fullWidth
								/>
							)}
							<TextField
								label="FTD floor"
								type="number"
								value={minFtdAmount}
								onChange={(event) => setMinFtdAmount(event.target.value)}
								helperText="Minimum first deposit to qualify. 0 means any deposit counts."
								fullWidth
							/>
							<TextField
								label="Reset portal password"
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								fullWidth
							/>
							<TextField
								label="Tracking link"
								value={data.partner.trackingLink}
								fullWidth
								slotProps={{ input: { readOnly: true } }}
							/>
						</div>
						<TextField
							label="Internal notes"
							value={notes}
							onChange={(event) => setNotes(event.target.value)}
							multiline
							minRows={3}
							fullWidth
						/>
						<div className="flex flex-wrap gap-2">
							<Button
								variant="contained"
								color="secondary"
								onClick={() => void save()}
								disabled={update.isPending}
							>
								Save deal
							</Button>
							{dealType !== 'CPA' && (
								<Button
									variant="outlined"
									onClick={() => void bookShare()}
									disabled={bookRevShare.isPending}
								>
									Book current rev share
								</Button>
							)}
						</div>
					</Paper>

					<Paper className="flex flex-col gap-3 rounded-xl p-6 shadow-sm">
						<Typography className="text-lg font-semibold">Book</Typography>
						{[
							['Invited players', String(stats.signups)],
							['Qualified (FTD)', String(stats.ftds)],
							['Expected income', formatMoney((stats.bookedCpa || 0) + (stats.estimatedRevShare || 0))],
							['Referred GGR', formatMoney(stats.ggr)],
							['CPA booked', formatMoney(stats.bookedCpa)],
							['RS estimate', formatMoney(stats.estimatedRevShare)],
							['Pending', formatMoney(stats.pending)],
							['Paid out', formatMoney(stats.paidOut)]
						].map(([label, value]) => (
							<div
								key={label}
								className="flex items-center justify-between"
							>
								<Typography color="text.secondary">{label}</Typography>
								<Typography className="font-semibold">{value}</Typography>
							</div>
						))}
					</Paper>

					<Paper className="rounded-xl p-6 shadow-sm xl:col-span-3">
						<Typography className="mb-4 text-lg font-semibold">Referred players</Typography>
						{data.players.length === 0 && <Typography color="text.secondary">No attributed signups yet.</Typography>}
						<div className="flex flex-col gap-3">
							{data.players.map((player) => (
								<div
									key={player.id}
									className="flex items-center justify-between gap-3"
								>
									<div>
										{canOpenPlayers ? (
											<Typography
												component={Link}
												to={`/apps/players/${player.id}`}
												className="font-medium"
											>
												<u>{player.displayName}</u>
											</Typography>
										) : (
											<Typography className="font-medium">{player.displayName}</Typography>
										)}
										<Typography
											className="text-sm"
											color="text.secondary"
										>
											{player.email}
										</Typography>
									</div>
									<Chip
										size="small"
										label={player.qualified ? 'FTD' : 'Signup'}
										color={player.qualified ? 'success' : 'default'}
										variant="outlined"
									/>
								</div>
							))}
						</div>
					</Paper>

					<Paper className="rounded-xl p-6 shadow-sm xl:col-span-2">
						<Typography className="mb-4 text-lg font-semibold">Commissions</Typography>
						{data.commissions.length === 0 && <Alert severity="info">No commissions booked yet.</Alert>}
						{data.commissions.map((row) => (
							<div
								key={row.id}
								className="mb-3 flex items-center justify-between"
							>
								<div>
									<Typography className="font-medium">
										{row.kind} · {formatMoney(row.amount)}
									</Typography>
									<Typography
										className="text-sm"
										color="text.secondary"
									>
										{row.playerEmail || 'Booked rev share'} · {format(new Date(row.createdAt), 'MMM d, yyyy')}
									</Typography>
								</div>
								<Chip
									size="small"
									label={statusLabel(row.status)}
									variant="outlined"
								/>
							</div>
						))}
					</Paper>

					<Paper className="rounded-xl p-6 shadow-sm">
						<Typography className="mb-4 text-lg font-semibold">Payouts</Typography>
						{data.payouts.length === 0 && <Typography color="text.secondary">No payouts yet.</Typography>}
						{data.payouts.map((row) => (
							<div
								key={row.id}
								className="mb-3 flex items-center justify-between"
							>
								<Typography className="font-medium">{formatMoney(row.amount)}</Typography>
								<Chip
									size="small"
									label={statusLabel(row.status)}
									variant="outlined"
								/>
							</div>
						))}
					</Paper>
				</div>
			}
		/>
	);
}

export default PartnerView;
