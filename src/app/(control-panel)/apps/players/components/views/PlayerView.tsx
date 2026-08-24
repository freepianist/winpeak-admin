'use client';

import { useEffect, useMemo, useState } from 'react';
import FuseLoading from '@fuse/core/FuseLoading';
import FusePageCarded from '@fuse/core/FusePageCarded';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import useParams from '@fuse/hooks/useParams';
import Link from '@fuse/core/Link';
import { motion } from 'motion/react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import AdminPageHeader from '@/app/(control-panel)/ops/components/AdminPageHeader';
import {
	usePlayer,
	useResetPassword,
	useUpdatePlayer,
	useUpdateWalletRequest,
	useWalletRequests
} from '@/app/(control-panel)/ops/api/hooks/usePlayers';
import type { LedgerItem, WalletRequest } from '@/app/(control-panel)/ops/api/types';
import { formatMoney } from '@/lib/money';
import { playerAccountChip } from '@/lib/player-status';
import { format } from 'date-fns';
import { enqueueSnackbar } from 'notistack';

const schema = z.object({
	firstName: z.string().min(1, 'First name is required'),
	lastName: z.string().min(1, 'Last name is required'),
	email: z.string().email('Enter a valid email'),
	status: z.enum(['ACTIVE', 'SUSPENDED']),
	notes: z.string().optional()
});

type FormType = z.infer<typeof schema>;

function PlayerView() {
	const { playerId } = useParams() as { playerId: string };
	const { data: player, isLoading, isError } = usePlayer(playerId);
	const { data: walletRequests = [] } = useWalletRequests({ userId: playerId });
	const { mutateAsync: updatePlayer, isPending: saving } = useUpdatePlayer(playerId);
	const { mutateAsync: resetPassword, isPending: resetting } = useResetPassword(playerId);
	const updateRequest = useUpdateWalletRequest();
	const [password, setPassword] = useState('');

	const methods = useForm<FormType>({
		mode: 'onChange',
		resolver: zodResolver(schema),
		defaultValues: {
			firstName: '',
			lastName: '',
			email: '',
			status: 'ACTIVE',
			notes: ''
		}
	});

	const { control, handleSubmit, reset, formState } = methods;

	useEffect(() => {
		if (player) {
			reset({
				firstName: player.firstName,
				lastName: player.lastName,
				email: player.email,
				status: player.status,
				notes: player.notes || ''
			});
		}
	}, [player, reset]);

	const columns = useMemo<MRT_ColumnDef<LedgerItem>[]>(
		() => [
			{
				accessorKey: 'createdAt',
				header: 'When',
				Cell: ({ cell }) => format(new Date(cell.getValue<string>()), 'MMM d, yyyy HH:mm')
			},
			{ accessorKey: 'kind', header: 'Kind' },
			{
				accessorKey: 'amount',
				header: 'Amount',
				Cell: ({ row }) => formatMoney(row.original.amount, player?.currency)
			},
			{
				accessorKey: 'balanceAfter',
				header: 'Balance after',
				Cell: ({ row }) => formatMoney(row.original.balanceAfter, player?.currency)
			},
			{ accessorKey: 'gameCode', header: 'Game', Cell: ({ cell }) => cell.getValue<string>() || '—' }
		],
		[player?.currency]
	);

	const requestColumns = useMemo<MRT_ColumnDef<WalletRequest>[]>(
		() => [
			{ accessorKey: 'type', header: 'Type' },
			{
				accessorKey: 'amount',
				header: 'Amount',
				Cell: ({ row }) => formatMoney(row.original.amount, player?.currency)
			},
			{
				accessorKey: 'status',
				header: 'Status',
				Cell: ({ row }) => (
					<Chip
						size="small"
						label={row.original.status.toLowerCase()}
						color={
							row.original.status === 'APPROVED'
								? 'success'
								: row.original.status === 'REJECTED'
									? 'error'
									: 'warning'
						}
						variant="outlined"
					/>
				)
			},
			{
				accessorKey: 'createdAt',
				header: 'When',
				Cell: ({ cell }) => format(new Date(cell.getValue<string>()), 'MMM d, yyyy HH:mm')
			},
			{
				id: 'actions',
				header: 'Actions',
				Cell: ({ row }) =>
					row.original.status === 'PENDING' ? (
						<div className="flex gap-1">
							<Button
								size="small"
								color="secondary"
								onClick={() =>
									void updateRequest
										.mutateAsync({ id: row.original.id, status: 'APPROVED' })
										.then(() => enqueueSnackbar('Request approved', { variant: 'success' }))
										.catch((error: unknown) =>
											enqueueSnackbar(
												error instanceof Error ? error.message : 'Could not approve',
												{ variant: 'error' }
											)
										)
								}
							>
								Approve
							</Button>
							<Button
								size="small"
								color="error"
								onClick={() =>
									void updateRequest
										.mutateAsync({ id: row.original.id, status: 'REJECTED' })
										.then(() => enqueueSnackbar('Request rejected', { variant: 'success' }))
										.catch((error: unknown) =>
											enqueueSnackbar(
												error instanceof Error ? error.message : 'Could not reject',
												{ variant: 'error' }
											)
										)
								}
							>
								Reject
							</Button>
						</div>
					) : (
						<span>—</span>
					)
			}
		],
		[player?.currency, updateRequest]
	);

	if (isLoading) {
		return <FuseLoading />;
	}

	if (isError || !player) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4">
				<Typography variant="h5">Player not found</Typography>
				<Button
					component={Link}
					to="/apps/players"
					variant="outlined"
				>
					Back to players
				</Button>
			</div>
		);
	}

	async function onSave(values: FormType) {
		try {
			await updatePlayer(values);
			enqueueSnackbar('Player updated', { variant: 'success' });
		} catch (error) {
			enqueueSnackbar(error instanceof Error ? error.message : 'Could not save player', { variant: 'error' });
		}
	}

	async function onResetPassword() {
		if (password.length < 8) {
			enqueueSnackbar('Password must be at least 8 characters', { variant: 'warning' });
			return;
		}

		try {
			await resetPassword(password);
			setPassword('');
			enqueueSnackbar('Password reset', { variant: 'success' });
		} catch (error) {
			enqueueSnackbar(error instanceof Error ? error.message : 'Could not reset password', { variant: 'error' });
		}
	}

	return (
		<FusePageCarded
			header={
				<AdminPageHeader
					title={player.displayName}
					subtitle={player.email}
					action={
						<Button
							variant="contained"
							color="secondary"
							disabled={saving || !formState.isValid}
							onClick={handleSubmit(onSave)}
						>
							Save player
						</Button>
					}
				/>
			}
			content={
				<div className="flex flex-col gap-6 p-4 sm:p-6">
					<div className="grid gap-4 md:grid-cols-3">
						<Paper className="rounded-xl p-5 shadow-sm">
							<Typography color="text.secondary">Available balance</Typography>
							<Typography className="mt-1 text-3xl font-semibold">
								{formatMoney(player.balance, player.currency)}
							</Typography>
							{player.heldBalance > 0 ? (
								<Typography
									className="mt-2 text-sm"
									color="text.secondary"
								>
									{formatMoney(player.heldBalance, player.currency)} held
								</Typography>
							) : null}
							<Chip
								className="mt-3"
								size="small"
								label={playerAccountChip(player).label}
								color={playerAccountChip(player).color}
							/>
						</Paper>
						<Paper className="rounded-xl p-5 shadow-sm">
							<Typography color="text.secondary">Scorpio player</Typography>
							<Typography className="mt-1 text-2xl font-semibold">
								{player.scorpioPlayerCode || 'Not linked'}
							</Typography>
							<Typography
								className="mt-2 text-sm"
								color="text.secondary"
							>
								{player.ledgerCount} ledger entries
							</Typography>
						</Paper>
						<Paper className="rounded-xl p-5 shadow-sm">
							<Typography color="text.secondary">Joined</Typography>
							<Typography className="mt-1 text-2xl font-semibold">
								{format(new Date(player.createdAt), 'MMM d, yyyy')}
							</Typography>
							<Typography
								className="mt-2 text-sm"
								color="text.secondary"
							>
								{player.reviewCount} reviews
							</Typography>
						</Paper>
					</div>

					<div className="grid gap-6 xl:grid-cols-2">
						<Paper className="flex flex-col gap-4 rounded-xl p-6 shadow-sm">
							<Typography className="text-lg font-semibold">Profile</Typography>
							<div className="grid gap-4 sm:grid-cols-2">
								<Controller
									name="firstName"
									control={control}
									render={({ field, fieldState }) => (
										<TextField
											{...field}
											label="First name"
											error={!!fieldState.error}
											helperText={fieldState.error?.message}
											fullWidth
										/>
									)}
								/>
								<Controller
									name="lastName"
									control={control}
									render={({ field, fieldState }) => (
										<TextField
											{...field}
											label="Last name"
											error={!!fieldState.error}
											helperText={fieldState.error?.message}
											fullWidth
										/>
									)}
								/>
							</div>
							<Controller
								name="email"
								control={control}
								render={({ field, fieldState }) => (
									<TextField
										{...field}
										label="Email"
										error={!!fieldState.error}
										helperText={fieldState.error?.message}
										fullWidth
									/>
								)}
							/>
							<Controller
								name="status"
								control={control}
								render={({ field }) => (
									<TextField
										{...field}
										select
										label="Account status"
										helperText={
											player.emailVerified
												? 'Email is verified'
												: 'Email is not verified yet'
										}
										fullWidth
									>
										<MenuItem value="ACTIVE">Active</MenuItem>
										<MenuItem value="SUSPENDED">Suspended</MenuItem>
									</TextField>
								)}
							/>
							<Controller
								name="notes"
								control={control}
								render={({ field }) => (
									<TextField
										{...field}
										label="Internal notes"
										multiline
										minRows={3}
										fullWidth
									/>
								)}
							/>
						</Paper>

						<Paper className="flex flex-col gap-4 rounded-xl p-6 shadow-sm">
							<Typography className="text-lg font-semibold">Reset password</Typography>
							<TextField
								label="New password"
								type="password"
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								fullWidth
							/>
							<Button
								variant="outlined"
								disabled={resetting}
								onClick={onResetPassword}
							>
								Set password
							</Button>
							<Typography
								className="text-sm"
								color="text.secondary"
							>
								Wallet changes happen only by approving player deposit/withdraw requests.
							</Typography>
							<Button
								component={Link}
								to="/apps/wallet-requests"
								variant="text"
								size="small"
							>
								Open wallet requests
							</Button>
						</Paper>
					</div>

					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
					>
						<Typography className="mb-3 text-lg font-semibold">Wallet requests</Typography>
						<Paper
							className="overflow-hidden rounded-xl"
							elevation={1}
						>
							<DataTable
								data={walletRequests}
								columns={requestColumns}
								enableRowActions={false}
								enableRowSelection={false}
							/>
						</Paper>
					</motion.div>

					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
					>
						<Typography className="mb-3 text-lg font-semibold">Recent activity</Typography>
						<Paper
							className="overflow-hidden rounded-xl"
							elevation={1}
						>
							<DataTable
								data={player.ledger || []}
								columns={columns}
								enableRowActions={false}
								enableRowSelection={false}
							/>
						</Paper>
					</motion.div>
				</div>
			}
		/>
	);
}

export default PlayerView;
