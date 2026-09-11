'use client';

import { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { WalletRequest } from '@/app/(control-panel)/ops/api/types';
import { formatMoney } from '@/lib/money';

/**
 * A manual deposit is credited for what actually arrived, which can differ from
 * the amount the player typed. The field starts at the request so an exact
 * match is one confirmation, not a blank to fill in.
 */
function ApproveManualDepositDialog(props: {
	request: WalletRequest | null;
	busy?: boolean;
	onClose: () => void;
	onConfirm: (creditedAmount: number) => void;
}) {
	const { request, busy = false, onClose, onConfirm } = props;
	const [value, setValue] = useState('');

	useEffect(() => {
		if (request) {
			setValue(request.amount.toFixed(2));
		}
	}, [request]);

	if (!request) {
		return null;
	}

	const parsed = Number(value);
	const valid = Number.isFinite(parsed) && parsed >= 0.01;
	const differs = valid && Math.abs(parsed - request.amount) >= 0.01;
	const network = request.payCurrency ? request.payCurrency.toUpperCase() : '';

	return (
		<Dialog
			open
			onClose={busy ? undefined : onClose}
			fullWidth
			maxWidth="xs"
		>
			<DialogTitle>Amount received</DialogTitle>
			<DialogContent className="flex flex-col gap-3 pt-2">
				<Typography
					className="text-sm"
					color="text.secondary"
				>
					Player requested {formatMoney(request.amount, request.currency)}
					{network ? ` on ${network}` : ''}. Credit the USD that actually arrived.
				</Typography>
				{request.txHash ? (
					<Typography className="font-mono text-sm break-all">{request.txHash}</Typography>
				) : null}
				<TextField
					autoFocus
					fullWidth
					label="Amount received (USD)"
					type="number"
					value={value}
					onChange={(event) => setValue(event.target.value)}
					slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
				/>
				{differs ? (
					<Typography
						className="text-sm"
						color="warning.main"
					>
						Will credit {formatMoney(parsed, request.currency)} instead of the requested
						amount.
					</Typography>
				) : null}
			</DialogContent>
			<DialogActions>
				<Button
					onClick={onClose}
					disabled={busy}
				>
					Cancel
				</Button>
				<Button
					color="secondary"
					disabled={!valid || busy}
					onClick={() => onConfirm(Number(parsed.toFixed(2)))}
				>
					Credit and approve
				</Button>
			</DialogActions>
		</Dialog>
	);
}

export default ApproveManualDepositDialog;
