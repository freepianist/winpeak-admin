'use client';

import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import { format } from 'date-fns';
import { enqueueSnackbar } from 'notistack';
import type { WalletRequest } from '@/app/(control-panel)/ops/api/types';
import { formatMoney } from '@/lib/money';
import { statusLabel } from '@/lib/status-label';

function when(value: string | null) {
	return value ? format(new Date(value), 'MMM d, yyyy HH:mm') : '—';
}

function copy(value: string, label: string) {
	void navigator.clipboard
		.writeText(value)
		.then(() => enqueueSnackbar(`${label} copied`, { variant: 'info' }))
		.catch(() => enqueueSnackbar(`Could not copy the ${label.toLowerCase()}`, { variant: 'error' }));
}

/**
 * One label/value line. References are shown in full rather than abbreviated:
 * the point of this dialog is to be the place where nothing is truncated.
 */
function Row(props: { label: string; value: string; mono?: boolean; copyable?: boolean }) {
	const { label, value, mono = false, copyable = false } = props;

	return (
		<div className="border-divider flex items-start justify-between gap-4 border-b py-2 last:border-b-0">
			<Typography
				className="shrink-0 text-sm"
				color="text.secondary"
			>
				{label}
			</Typography>
			<div className="flex min-w-0 items-start gap-1">
				<Typography className={`min-w-0 text-right text-sm break-all${mono ? 'font-mono' : ''}`}>
					{value || '—'}
				</Typography>
				{copyable && value ? (
					<Tooltip title={`Copy ${label.toLowerCase()}`}>
						<IconButton
							size="small"
							className="-mt-1"
							onClick={() => copy(value, label)}
						>
							<FuseSvgIcon size={14}>lucide:copy</FuseSvgIcon>
						</IconButton>
					</Tooltip>
				) : null}
			</div>
		</div>
	);
}

function Section(props: { title: string; children: React.ReactNode }) {
	return (
		<div className="flex flex-col">
			<Typography className="mb-1 text-sm font-semibold tracking-wide uppercase">{props.title}</Typography>
			{props.children}
		</div>
	);
}

/**
 * Everything held against one wallet request. Reachable from every row whatever
 * its status, since a settled request is exactly the one staff come back to when
 * a player disputes it.
 */
function WalletRequestDetailsDialog(props: { request: WalletRequest | null; onClose: () => void }) {
	const { request, onClose } = props;

	if (!request) {
		return null;
	}

	const network = request.payCurrency ? request.payCurrency.toUpperCase() : '';
	const credited = request.creditedAmount !== null && Math.abs(request.creditedAmount - request.amount) >= 0.01;

	return (
		<Dialog
			open
			onClose={onClose}
			fullWidth
			maxWidth="sm"
		>
			<DialogTitle className="flex flex-wrap items-center gap-2">
				<span>{request.type === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'} details</span>
				<Chip
					size="small"
					variant="outlined"
					label={statusLabel(request.status)}
				/>
				{request.manual ? (
					<Chip
						size="small"
						color="secondary"
						variant="outlined"
						label="Manual"
					/>
				) : null}
			</DialogTitle>
			<DialogContent className="flex flex-col gap-5 pt-2">
				<Section title="Request">
					<Row
						label="Player"
						value={request.playerName || request.playerEmail}
					/>
					<Row
						label="Email"
						value={request.playerEmail}
					/>
					<Row
						label="Amount"
						value={formatMoney(request.amount, request.currency)}
					/>
					{credited ? (
						<Row
							label="Credited"
							value={formatMoney(request.creditedAmount, request.currency)}
						/>
					) : null}
					<Row
						label="Requested"
						value={when(request.createdAt)}
					/>
					<Row
						label="Last updated"
						value={when(request.updatedAt)}
					/>
					<Row
						label="Reference"
						value={request.id}
						mono
						copyable
					/>
				</Section>

				<Section title="Payment">
					<Row
						label="Network"
						value={network}
					/>
					{request.txHash ? (
						<Row
							label="Transaction hash"
							value={request.txHash}
							mono
							copyable
						/>
					) : null}
					{request.payoutAddress ? (
						<Row
							label="Payout address"
							value={request.payoutAddress}
							mono
							copyable
						/>
					) : null}
					{request.paidAmount !== null ? (
						<Row
							label="Player sent"
							value={`${request.paidAmount} ${network}`}
						/>
					) : null}
					{request.paymentOutcome ? (
						<Row
							label="Against invoice"
							value={statusLabel(request.paymentOutcome)}
						/>
					) : null}
					{request.manual ? null : (
						<>
							<Row
								label="Provider reference"
								value={request.providerRef}
								mono
								copyable
							/>
							<Row
								label="Provider status"
								value={request.providerStatus}
							/>
						</>
					)}
					<Row
						label="Settled automatically"
						value={request.autoProcessed ? 'Yes' : 'No'}
					/>
				</Section>

				{request.conversionId ? (
					<Section title="Treasury conversion">
						<Row
							label="Conversion"
							value={request.conversionId}
							mono
							copyable
						/>
						<Row
							label="Status"
							value={request.conversionStatus}
						/>
						{request.settleAmount !== null ? (
							<Row
								label="Spent"
								value={`${request.settleAmount} ${request.settleCurrency.toUpperCase()}`}
							/>
						) : null}
					</Section>
				) : null}

				<Section title="Review">
					<Row
						label="Reviewed by"
						value={request.reviewedBy}
					/>
					<Row
						label="Reviewed at"
						value={when(request.reviewedAt)}
					/>
					<Row
						label="Review note"
						value={request.reviewNote}
					/>
					{request.note ? (
						<Row
							label="Player note"
							value={request.note}
						/>
					) : null}
				</Section>
			</DialogContent>
			<DialogActions>
				{request.invoiceUrl ? (
					<Button
						href={request.invoiceUrl}
						target="_blank"
						rel="noreferrer"
						startIcon={<FuseSvgIcon size={18}>lucide:link</FuseSvgIcon>}
					>
						Open invoice
					</Button>
				) : null}
				<Button onClick={onClose}>Close</Button>
			</DialogActions>
		</Dialog>
	);
}

export default WalletRequestDetailsDialog;
