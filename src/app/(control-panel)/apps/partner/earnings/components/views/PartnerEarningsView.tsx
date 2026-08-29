'use client';

import FusePageSimple from '@fuse/core/FusePageSimple';
import FuseLoading from '@fuse/core/FuseLoading';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import { format } from 'date-fns';
import AdminPageHeader from '@/app/(control-panel)/ops/components/AdminPageHeader';
import { useMyAffiliate } from '@/app/(control-panel)/ops/api/hooks/useAffiliates';
import { formatMoney } from '@/lib/money';
import { statusLabel } from '@/lib/status-label';

function PartnerEarningsView() {
	const { data, isLoading } = useMyAffiliate();

	if (isLoading || !data) {
		return <FuseLoading />;
	}

	return (
		<FusePageSimple
			header={
				<AdminPageHeader
					title="My earnings"
					subtitle="Commissions WinPeak booked for you, and payouts already sent."
				/>
			}
			content={
				<div className="grid w-full gap-4 px-4 pt-4 pb-8 md:px-8 xl:grid-cols-2">
					<Paper className="rounded-xl p-6 shadow-sm">
						<Typography className="mb-4 text-lg font-semibold">Commissions</Typography>
						{data.commissions.length === 0 && (
							<Typography color="text.secondary">No commissions yet. They appear after a referred player’s first deposit, or when staff books rev share.</Typography>
						)}
						{data.commissions.map((row) => (
							<div
								key={row.id}
								className="mb-3 flex items-center justify-between gap-3"
							>
								<div>
									<Typography className="font-medium">
										{row.kind} · {formatMoney(row.amount)}
									</Typography>
									<Typography
										className="text-sm"
										color="text.secondary"
									>
										{row.playerEmail || 'Rev share'} · {format(new Date(row.createdAt), 'MMM d, yyyy')}
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
						{data.payouts.length === 0 && <Typography color="text.secondary">No payouts recorded yet.</Typography>}
						{data.payouts.map((row) => (
							<div
								key={row.id}
								className="mb-3 flex items-center justify-between gap-3"
							>
								<div>
									<Typography className="font-medium">{formatMoney(row.amount)}</Typography>
									<Typography
										className="text-sm"
										color="text.secondary"
									>
										{row.note || 'Payout'} · {format(new Date(row.createdAt), 'MMM d, yyyy')}
									</Typography>
								</div>
								<Chip
									size="small"
									label={statusLabel(row.status)}
									color={row.status === 'SENT' ? 'success' : 'default'}
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

export default PartnerEarningsView;
