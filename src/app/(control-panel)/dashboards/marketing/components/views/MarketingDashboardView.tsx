'use client';

import FusePageSimple from '@fuse/core/FusePageSimple';
import FuseLoading from '@fuse/core/FuseLoading';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import NavLinkAdapter from '@fuse/core/NavLinkAdapter';
import AdminPageHeader from '@/app/(control-panel)/ops/components/AdminPageHeader';
import { useMarketingStats } from '@/app/(control-panel)/ops/api/hooks/useAffiliates';
import { formatMoney } from '@/lib/money';
import { statusLabel } from '@/lib/status-label';

function Card({
	label,
	value,
	hint,
	to
}: {
	label: string;
	value: string;
	hint?: string;
	to?: string;
}) {
	const content = (
		<Paper className="flex flex-auto flex-col gap-2 rounded-xl p-6 shadow-sm">
			<Typography
				className="text-sm font-medium"
				color="text.secondary"
			>
				{label}
			</Typography>
			<Typography className="text-3xl font-semibold tracking-tight">{value}</Typography>
			{hint && (
				<Typography
					className="text-sm"
					color="text.secondary"
				>
					{hint}
				</Typography>
			)}
		</Paper>
	);

	return to ? (
		<NavLinkAdapter
			to={to}
			className="flex"
		>
			{content}
		</NavLinkAdapter>
	) : (
		content
	);
}

function MarketingDashboardView() {
	const { data, isLoading, isError, error, refetch } = useMarketingStats();

	if (isLoading) {
		return <FuseLoading />;
	}

	if (isError || !data) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4 p-8">
				<Typography variant="h5">Could not load marketing data</Typography>
				<Typography color="text.secondary">
					{error instanceof Error ? error.message : 'Check that affiliate tables exist in the WinPeak database.'}
				</Typography>
				<Button
					variant="contained"
					color="secondary"
					onClick={() => refetch()}
				>
					Retry
				</Button>
			</div>
		);
	}

	return (
		<FusePageSimple
			header={
				<AdminPageHeader
					title="Affiliate marketing"
					subtitle="Manage partners and track invited players, qualified FTDs, and expected income."
					action={
						<Button
							variant="contained"
							color="secondary"
							component={NavLinkAdapter}
							to="/apps/partners"
							startIcon={<FuseSvgIcon>lucide:plus</FuseSvgIcon>}
						>
							Invite partner
						</Button>
					}
				/>
			}
			content={
				<div className="w-full px-4 pt-4 pb-8 md:px-8">
					<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
						<Card
							label="Partners"
							value={data.partners.total.toLocaleString()}
							hint={`${data.partners.invited} awaiting approval · ${data.partners.active} active · ${data.partners.paused} paused`}
							to="/apps/partners"
						/>
						<Card
							label="Referred signups"
							value={data.players.signups.toLocaleString()}
							hint={`${data.players.ftds} first-time deposits`}
						/>
						<Card
							label="CPA booked"
							value={formatMoney(data.money.bookedCpa)}
							hint={`${formatMoney(data.money.pending)} pending approval`}
							to="/apps/commissions"
						/>
						<Card
							label="Rev share estimate"
							value={formatMoney(data.money.estimatedRevShare)}
							hint={`${formatMoney(data.money.bookedRevShare)} already booked`}
							to="/apps/commissions"
						/>
					</div>

					<div className="mt-4 grid gap-4 xl:grid-cols-3">
						<Paper className="xl:col-span-2 rounded-xl p-6 shadow-sm">
							<div className="mb-4 flex items-center justify-between">
								<div>
									<Typography className="text-lg font-semibold">Top partners</Typography>
									<Typography
										className="text-sm"
										color="text.secondary"
									>
										Ranked by first-time deposits
									</Typography>
								</div>
								<Button
									component={NavLinkAdapter}
									to="/apps/partners"
									size="small"
								>
									All partners
								</Button>
							</div>
							<div className="flex flex-col gap-3">
								{data.leaderboard.map((row) => (
									<NavLinkAdapter
										key={row.id}
										to={`/apps/partners/${row.id}`}
										className="hover:bg-grey-100 dark:hover:bg-grey-200 flex items-center justify-between rounded-lg px-2 py-2"
									>
										<div>
											<Typography className="font-medium">{row.name}</Typography>
											<Typography
												className="text-sm"
												color="text.secondary"
											>
												{row.code} · {row.dealType}
											</Typography>
										</div>
										<div className="text-right">
											<Typography className="font-semibold">
												{row.stats?.signups || 0} invited · {row.stats?.ftds || 0} qualified
											</Typography>
											<Typography
												className="text-sm"
												color="text.secondary"
											>
												{formatMoney((row.stats?.bookedCpa || 0) + (row.stats?.estimatedRevShare || 0))} expected
											</Typography>
											<Chip
												size="small"
												label={statusLabel(row.status)}
												color={row.status === 'ACTIVE' ? 'success' : 'default'}
												variant="outlined"
											/>
										</div>
									</NavLinkAdapter>
								))}
								{data.leaderboard.length === 0 && (
									<Typography color="text.secondary">No partners yet. Invite one to get a tracking link.</Typography>
								)}
							</div>
						</Paper>

						<Paper className="flex flex-col gap-3 rounded-xl p-6 shadow-sm">
							<Typography className="text-lg font-semibold">Money movement</Typography>
							{[
								{ label: 'Pending commissions', value: formatMoney(data.money.pending), to: '/apps/commissions' },
								{ label: 'Approved', value: formatMoney(data.money.approved), to: '/apps/commissions' },
								{ label: 'Marked paid', value: formatMoney(data.money.paid), to: '/apps/commissions' },
								{ label: 'Payouts sent', value: formatMoney(data.money.paidOut), to: '/apps/payouts' }
							].map((row) => (
								<NavLinkAdapter
									key={row.label}
									to={row.to}
									className="hover:bg-grey-100 dark:hover:bg-grey-200 flex items-center justify-between rounded-lg px-2 py-2"
								>
									<Typography color="text.secondary">{row.label}</Typography>
									<Typography className="font-semibold">{row.value}</Typography>
								</NavLinkAdapter>
							))}
						</Paper>
					</div>
				</div>
			}
		/>
	);
}

export default MarketingDashboardView;
