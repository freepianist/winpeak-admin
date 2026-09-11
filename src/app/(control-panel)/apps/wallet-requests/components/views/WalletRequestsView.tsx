'use client';

import { useMemo, useState } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import FuseLoading from '@fuse/core/FuseLoading';
import FusePageCarded from '@fuse/core/FusePageCarded';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import { styled } from '@mui/material/styles';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Link from '@fuse/core/Link';
import { format } from 'date-fns';
import { enqueueSnackbar } from 'notistack';
import AdminPageHeader from '@/app/(control-panel)/ops/components/AdminPageHeader';
import ApproveManualDepositDialog from '../ui/ApproveManualDepositDialog';
import WalletRequestDetailsDialog from '../ui/WalletRequestDetailsDialog';
import {
	useSyncWalletRequest,
	useUpdateWalletRequest,
	useWalletRequests
} from '@/app/(control-panel)/ops/api/hooks/usePlayers';
import { usePaymentSettings } from '@/app/(control-panel)/ops/api/hooks/usePaymentSettings';
import type { WalletRequest } from '@/app/(control-panel)/ops/api/types';
import { formatMoney } from '@/lib/money';
import { statusLabel } from '@/lib/status-label';

function requestStatusColor(status: WalletRequest['status']) {
	if (status === 'APPROVED') return 'success';

	if (status === 'REJECTED') return 'error';

	if (status === 'PROCESSING') return 'info';

	return 'warning';
}

function shortAddress(value: string) {
	if (!value) return '—';

	if (value.length <= 16) return value;

	return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

/**
 * A hash or address abbreviated to fit a cell, with the whole value a click
 * away. Manual payments are verified by pasting this into a block explorer, so
 * it has to be copyable rather than only readable.
 */
function CopyableRef(props: { value: string; label: string }) {
	const { value, label } = props;

	return (
		<Tooltip title={`${label}: ${value}`}>
			<Typography
				component="button"
				type="button"
				className="cursor-pointer border-0 bg-transparent p-0 text-left text-sm underline"
				color="text.secondary"
				onClick={() => {
					void navigator.clipboard
						.writeText(value)
						.then(() => enqueueSnackbar(`${label} copied`, { variant: 'info' }))
						.catch(() =>
							enqueueSnackbar(`Could not copy the ${label.toLowerCase()}`, { variant: 'error' })
						);
				}}
			>
				{shortAddress(value)}
			</Typography>
		</Tooltip>
	);
}

/** Explains a payout that is waiting on the treasury conversion behind it. */
function conversionNote(request: WalletRequest) {
	if (!request.conversionId) return '';

	const target = request.payCurrency ? request.payCurrency.toUpperCase() : 'destination';
	const spend =
		request.settleAmount && request.settleCurrency
			? `${request.settleAmount} ${request.settleCurrency.toUpperCase()}`
			: '';
	const status = request.conversionStatus ? request.conversionStatus.toLowerCase() : 'pending';
	return `Converting${spend ? ` ${spend}` : ''} to ${target} (${status})`;
}

/** Flags a deposit that did not land on the invoiced amount. */
function paymentOutcomeChip(request: WalletRequest) {
	if (request.paymentOutcome === 'UNDERPAID') {
		return { label: 'Underpaid', color: 'warning' as const };
	}

	if (request.paymentOutcome === 'OVERPAID') {
		return { label: 'Overpaid', color: 'info' as const };
	}

	return null;
}

const Root = styled(FusePageCarded)(() => ({
	'& .container': {
		maxWidth: '100%!important'
	}
}));

function WalletRequestsView() {
	const { data: requests = [], isLoading } = useWalletRequests();
	const { data: settings } = usePaymentSettings();
	const update = useUpdateWalletRequest();
	const sync = useSyncWalletRequest();
	const [detailsId, setDetailsId] = useState<string | null>(null);
	const [approveId, setApproveId] = useState<string | null>(null);

	// Held by id rather than by row so the dialog follows a refetch, which matters
	// while it is open next to a request being approved.
	const details = requests.find((request) => request.id === detailsId) || null;
	const approving = requests.find((request) => request.id === approveId) || null;

	const columns = useMemo<MRT_ColumnDef<WalletRequest>[]>(
		() => [
			{
				accessorKey: 'playerName',
				header: 'Player',
				Cell: ({ row }) => (
					<div>
						<Typography
							component={Link}
							to={`/apps/players/${row.original.userId}`}
							className="font-medium"
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
			{ accessorKey: 'type', header: 'Type' },
			{
				accessorKey: 'amount',
				header: 'Amount',
				Cell: ({ row }) => {
					const { amount, creditedAmount, currency } = row.original;
					const differs = creditedAmount !== null && Math.abs(creditedAmount - amount) >= 0.01;
					return (
						<div>
							{formatMoney(amount, currency)}
							{differs ? (
								<Typography
									className="text-sm"
									color="text.secondary"
								>
									{formatMoney(creditedAmount, currency)} credited
								</Typography>
							) : null}
						</div>
					);
				}
			},
			{
				id: 'destination',
				header: 'Destination',
				Cell: ({ row }) => {
					const request = row.original;
					// On the manual rail a deposit's useful reference is the transaction
					// the player says they sent, since that is what gets checked on-chain
					// before crediting. A withdrawal's is still the address to pay.
					const reference =
						request.type === 'WITHDRAW'
							? { value: request.payoutAddress, label: 'Address' }
							: request.manual
								? { value: request.txHash, label: 'Transaction' }
								: { value: '', label: '' };

					return (
						<div>
							<Typography className="text-sm">{request.payCurrency || '—'}</Typography>
							{reference.value ? (
								<CopyableRef
									value={reference.value}
									label={reference.label}
								/>
							) : (
								<Typography
									className="text-sm"
									color="text.secondary"
									title={request.invoiceUrl}
								>
									{request.type === 'DEPOSIT' && request.invoiceUrl ? 'Crypto invoice' : '—'}
								</Typography>
							)}
							{request.autoProcessed ? (
								<Chip
									size="small"
									label="auto"
									variant="outlined"
									sx={{ mt: 0.5 }}
								/>
							) : null}
						</div>
					);
				}
			},
			{
				accessorKey: 'status',
				header: 'Status',
				Cell: ({ row }) => {
					const converting = conversionNote(row.original);
					const outcome = paymentOutcomeChip(row.original);
					return (
						<div>
							<Chip
								size="small"
								label={statusLabel(row.original.status)}
								color={requestStatusColor(row.original.status)}
								variant="outlined"
							/>
							{row.original.manual ? (
								<Chip
									className="ml-1"
									size="small"
									label="Manual"
									color="secondary"
									variant="outlined"
								/>
							) : null}
							{outcome ? (
								<Chip
									className="ml-1"
									size="small"
									label={outcome.label}
									color={outcome.color}
									variant="outlined"
								/>
							) : null}
							{converting ? (
								<Typography
									className="mt-1 text-sm"
									color="text.secondary"
									title={row.original.conversionId}
								>
									{converting}
								</Typography>
							) : null}
						</div>
					);
				}
			},
			{
				accessorKey: 'createdAt',
				header: 'Requested',
				Cell: ({ cell }) => format(new Date(cell.getValue<string>()), 'MMM d, yyyy HH:mm')
			},
			{
				accessorKey: 'reviewedBy',
				header: 'Reviewed by',
				Cell: ({ row }) => row.original.reviewedBy || '—'
			},
			{
				id: 'actions',
				header: 'Actions',
				Cell: ({ row }) => {
					const request = row.original;
					const manualWithdraw = request.manual && request.type === 'WITHDRAW';

					// Available whatever the status: a settled request is the one staff
					// come back to when a player disputes it.
					const detailsButton = (
						<Tooltip title="Payment details">
							<IconButton
								size="small"
								onClick={() => setDetailsId(request.id)}
							>
								<FuseSvgIcon size={18}>lucide:info</FuseSvgIcon>
							</IconButton>
						</Tooltip>
					);

					if (request.status === 'PENDING') {
						return (
							<div className="flex items-center gap-1">
								{detailsButton}
								<Button
									size="small"
									color="secondary"
									title={
										manualWithdraw
											? 'Send the coins from the casino wallet first — this only records that you did, and debits the player'
											: request.manual
												? 'Check the transaction on-chain first — you will enter the USD that actually arrived'
												: undefined
									}
									onClick={() => {
										if (request.manual && request.type === 'DEPOSIT') {
											setApproveId(request.id);
											return;
										}

										void update
											.mutateAsync({ id: request.id, status: 'APPROVED' })
											.then((updated) =>
												enqueueSnackbar(
													updated.status === 'PROCESSING'
														? 'Payout submitted'
														: manualWithdraw
															? 'Marked as paid. The player has been debited.'
															: 'Request approved',
													{ variant: 'success' }
												)
											)
											.catch((error: unknown) =>
												enqueueSnackbar(
													error instanceof Error ? error.message : 'Could not approve',
													{ variant: 'error' }
												)
											);
									}}
								>
									{manualWithdraw ? 'Mark paid' : 'Approve'}
								</Button>
								<Button
									size="small"
									color="error"
									onClick={() =>
										void update
											.mutateAsync({ id: request.id, status: 'REJECTED' })
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
						);
					}

					// A submitted payout only reaches a final state from an IPN, so
					// staff need a way to reconcile it when that never arrives. Manual
					// payouts have no provider record, so there is nothing to ask.
					if (request.status === 'PROCESSING' && request.type === 'WITHDRAW' && !request.manual) {
						return (
							<div className="flex items-center gap-1">
								{detailsButton}
								<Button
									size="small"
									disabled={sync.isPending}
									title="Ask NOWPayments what happened to this payout and settle it accordingly"
									onClick={() =>
										void sync
											.mutateAsync({ id: request.id })
											.then((result) =>
												enqueueSnackbar(result.syncMessage, {
													variant: result.syncChanged ? 'success' : 'info',
													autoHideDuration: 8000
												})
											)
											.catch((error: unknown) =>
												enqueueSnackbar(
													error instanceof Error ? error.message : 'Could not sync',
													{ variant: 'error' }
												)
											)
									}
								>
									Sync
								</Button>
							</div>
						);
					}

					return detailsButton;
				}
			}
		],
		[update, sync]
	);

	if (isLoading) {
		return <FuseLoading />;
	}

	return (
		<Root
			header={
				<AdminPageHeader
					title="Wallet requests"
					subtitle={
						settings?.manualMode
							? 'Manual mode is on, so nothing settles itself. Check every deposit on-chain before approving, and send a payout from the casino wallet before marking it paid.'
							: 'Deposits credit after on-chain payment. Withdrawals within auto limits are sent immediately; the rest wait here. If a payout is stuck on Processing, use Sync to reconcile it against NOWPayments.'
					}
				/>
			}
			content={
				<Paper
					className="flex w-full min-w-0 flex-col rounded-b-none"
					elevation={2}
				>
					<DataTable
						data={requests}
						columns={columns}
						enableRowActions={false}
						enableRowSelection={false}
					/>
					<WalletRequestDetailsDialog
						request={details}
						onClose={() => setDetailsId(null)}
					/>
					<ApproveManualDepositDialog
						request={approving}
						busy={update.isPending}
						onClose={() => setApproveId(null)}
						onConfirm={(creditedAmount) => {
							if (!approving) return;

							void update
								.mutateAsync({
									id: approving.id,
									status: 'APPROVED',
									creditedAmount
								})
								.then((updated) => {
									setApproveId(null);
									const credited = updated.creditedAmount;
									enqueueSnackbar(
										credited !== null && Math.abs(credited - approving.amount) >= 0.01
											? `Credited ${formatMoney(credited, updated.currency)} (requested ${formatMoney(approving.amount, updated.currency)})`
											: 'Request approved',
										{ variant: 'success' }
									);
								})
								.catch((error: unknown) =>
									enqueueSnackbar(
										error instanceof Error ? error.message : 'Could not approve',
										{ variant: 'error' }
									)
								);
						}}
					/>
				</Paper>
			}
		/>
	);
}

export default WalletRequestsView;
