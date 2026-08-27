'use client';

import FusePageSimple from '@fuse/core/FusePageSimple';
import FuseLoading from '@fuse/core/FuseLoading';
import { motion } from 'motion/react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import ReactApexChart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import NavLinkAdapter from '@fuse/core/NavLinkAdapter';
import { format } from 'date-fns';
import AdminPageHeader from '@/app/(control-panel)/ops/components/AdminPageHeader';
import { useWinPeakStats } from '@/app/(control-panel)/ops/api/hooks/useWinPeakStats';
import { formatMoney } from '@/lib/money';
import { playerAccountChip } from '@/lib/player-status';
import type { LedgerItem, Player } from '@/app/(control-panel)/ops/api/types';

const container = {
	show: { transition: { staggerChildren: 0.04 } }
};

const item = {
	hidden: { opacity: 0, y: 16 },
	show: { opacity: 1, y: 0 }
};

function StatCard({
	label,
	value,
	hint,
	icon,
	to
}: {
	label: string;
	value: string;
	hint?: string;
	icon: string;
	to?: string;
}) {
	const content = (
		<Paper className="hover:border-secondary/30 flex h-full flex-auto flex-col gap-4 rounded-2xl border border-transparent p-5 shadow-sm transition-all hover:shadow-md">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<Typography
						className="text-xs font-semibold tracking-[0.08em] uppercase"
						color="text.secondary"
					>
						{label}
					</Typography>
					<Typography className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">{value}</Typography>
					{hint && (
						<Typography
							className="mt-1.5 text-sm leading-snug"
							color="text.secondary"
						>
							{hint}
						</Typography>
					)}
				</div>
				<div className="bg-secondary/12 text-secondary flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
					<FuseSvgIcon size={20}>{icon}</FuseSvgIcon>
				</div>
			</div>
		</Paper>
	);

	if (!to) {
		return content;
	}

	return (
		<NavLinkAdapter
			to={to}
			className="flex"
		>
			{content}
		</NavLinkAdapter>
	);
}

function WinPeakDashboardView() {
	const theme = useTheme();
	const { data: stats, isLoading, isError, error, refetch } = useWinPeakStats();

	if (isLoading) {
		return <FuseLoading />;
	}

	if (isError || !stats) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4 p-8">
				<Typography variant="h5">Could not load WinPeak data</Typography>
				<Typography color="text.secondary">
					{error instanceof Error ? error.message : 'Check that the admin API can reach the WinPeak database.'}
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

	const currency = stats.wallets.currency || 'USD';
	const chartOptions: ApexOptions = {
		chart: {
			fontFamily: 'inherit',
			foreColor: 'inherit',
			toolbar: { show: false },
			type: 'area',
			sparkline: { enabled: false }
		},
		colors: [theme.palette.secondary.main, theme.palette.error.main, theme.palette.info.main, theme.palette.success.main],
		dataLabels: { enabled: false },
		fill: { opacity: 0.16, type: 'solid' },
		stroke: { curve: 'smooth', width: 2 },
		grid: { borderColor: theme.palette.divider, strokeDashArray: 4 },
		legend: { position: 'top', horizontalAlign: 'right' },
		xaxis: {
			categories: stats.series.map((row) => format(new Date(`${row.date}T00:00:00`), 'MMM d')),
			labels: { style: { colors: theme.palette.text.secondary } }
		},
		yaxis: {
			labels: {
				style: { colors: theme.palette.text.secondary },
				formatter: (value) => formatMoney(value, currency)
			}
		},
		tooltip: { theme: theme.palette.mode }
	};

	return (
		<FusePageSimple
			header={
				<AdminPageHeader
					title="WinPeak overview"
					subtitle="Players, wallets, games, and site content in one place"
				/>
			}
			content={
				<div className="min-w-0 w-full px-4 pt-4 pb-8 md:px-8">
					<motion.div
						variants={container}
						initial="hidden"
						animate="show"
						className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
					>
						<motion.div variants={item}>
							<StatCard
								label="Players"
								value={stats.users.total.toLocaleString()}
								hint={`${stats.users.newThisWeek} new this week · ${stats.users.suspended} suspended`}
								icon="lucide:users"
								to="/apps/players"
							/>
						</motion.div>
						<motion.div variants={item}>
							<StatCard
								label="Player wallets"
								value={formatMoney(stats.wallets.totalBalance, currency)}
								hint="Combined live balances"
								icon="lucide:wallet"
								to="/apps/players"
							/>
						</motion.div>
						<motion.div variants={item}>
							<StatCard
								label="Net deposits"
								value={formatMoney(stats.ledger.netDeposits, currency)}
								hint={`${stats.ledger.counts.deposits} in · ${stats.ledger.counts.withdrawals} out`}
								icon="lucide:banknote"
								to="/apps/ledger"
							/>
						</motion.div>
						<motion.div variants={item}>
							<StatCard
								label="Gross gaming"
								value={formatMoney(stats.ledger.ggr, currency)}
								hint={`${formatMoney(stats.ledger.bets, currency)} wagered`}
								icon="lucide:gamepad-2"
								to="/apps/games"
							/>
						</motion.div>
						<motion.div variants={item}>
							<StatCard
								label="Affiliate partners"
								value={(stats.affiliates?.partners || 0).toLocaleString()}
								hint={`${stats.affiliates?.ftds || 0} FTDs · ${formatMoney(stats.affiliates?.pending || 0, currency)} pending`}
								icon="lucide:handshake"
								to="/dashboards/marketing"
							/>
						</motion.div>
					</motion.div>

					<div className="mt-4 grid gap-4 xl:grid-cols-3">
						<motion.div
							variants={item}
							initial="hidden"
							animate="show"
							className="xl:col-span-2"
						>
							<Paper className="flex h-full flex-col rounded-2xl p-6 shadow-sm">
								<div className="mb-5 flex items-center justify-between gap-3">
									<div>
										<Typography className="text-lg font-semibold">Cashflow · 14 days</Typography>
										<Typography
											color="text.secondary"
											className="text-sm"
										>
											Deposits, withdrawals, bets, and wins
										</Typography>
									</div>
									<Button
										component={NavLinkAdapter}
										to="/apps/ledger"
										size="small"
										endIcon={<FuseSvgIcon size={16}>lucide:arrow-right</FuseSvgIcon>}
									>
										Ledger
									</Button>
								</div>
								<ReactApexChart
									options={chartOptions}
									series={[
										{ name: 'Deposits', data: stats.series.map((row) => row.deposits) },
										{ name: 'Withdrawals', data: stats.series.map((row) => row.withdrawals) },
										{ name: 'Bets', data: stats.series.map((row) => row.bets) },
										{ name: 'Wins', data: stats.series.map((row) => row.wins) }
									]}
									type="area"
									height={320}
								/>
							</Paper>
						</motion.div>

						<Paper className="flex flex-col gap-1 rounded-2xl p-6 shadow-sm">
							<Typography className="mb-3 text-lg font-semibold">Site activity</Typography>
							{[
								{ label: 'Blog posts', value: stats.content.posts, to: '/apps/blog' },
								{ label: 'Comments', value: stats.content.comments, to: '/apps/comments' },
								{ label: 'Game reviews', value: stats.content.reviews, to: '/apps/reviews' },
								{ label: 'Success stories', value: stats.content.stories, to: '/apps/stories' },
								{ label: 'Unread messages', value: stats.content.unreadInbox, to: '/apps/inbox' },
								{ label: 'Subscribers', value: stats.content.subscribers, to: '/apps/subscribers' }
							].map((row) => (
								<NavLinkAdapter
									key={row.label}
									to={row.to}
									className="hover:bg-action-hover flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors"
								>
									<Typography color="text.secondary">{row.label}</Typography>
									<Typography className="rounded-full bg-grey-100 px-2.5 py-0.5 text-sm font-semibold dark:bg-grey-800">
										{row.value}
									</Typography>
								</NavLinkAdapter>
							))}
						</Paper>
					</div>

					<div className="mt-4 grid gap-4 xl:grid-cols-2">
						<Paper className="rounded-2xl p-6 shadow-sm">
							<div className="mb-5 flex items-center justify-between">
								<Typography className="text-lg font-semibold">Newest players</Typography>
								<Button
									component={NavLinkAdapter}
									to="/apps/players"
									size="small"
								>
									View all
								</Button>
							</div>
							<div className="flex flex-col gap-1">
								{stats.recentUsers.map((player: Player) => (
									<div
										key={player.id}
										className="hover:bg-action-hover flex items-center justify-between gap-3 rounded-xl px-2 py-2.5"
									>
										<div className="flex min-w-0 items-center gap-3">
											<div className="bg-secondary/12 text-secondary flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold">
												{player.displayName
													.split(' ')
													.map((part) => part[0])
													.join('')
													.slice(0, 2)
													.toUpperCase()}
											</div>
											<div className="min-w-0">
												<Typography className="truncate font-medium">{player.displayName}</Typography>
												<Typography
													className="truncate text-sm"
													color="text.secondary"
												>
													{player.email}
												</Typography>
											</div>
										</div>
										<div className="shrink-0 text-right">
											<Typography className="font-semibold">
												{formatMoney(player.balance, player.currency)}
											</Typography>
											<Chip
												size="small"
												label={playerAccountChip(player).label}
												color={playerAccountChip(player).color}
												variant="outlined"
											/>
										</div>
									</div>
								))}
								{stats.recentUsers.length === 0 && (
									<Typography color="text.secondary">No players yet.</Typography>
								)}
							</div>
						</Paper>

						<Paper className="rounded-2xl p-6 shadow-sm">
							<div className="mb-5 flex items-center justify-between">
								<Typography className="text-lg font-semibold">Latest ledger</Typography>
								<Button
									component={NavLinkAdapter}
									to="/apps/ledger"
									size="small"
								>
									View all
								</Button>
							</div>
							<div className="flex flex-col gap-1">
								{stats.recentLedger.map((entry: LedgerItem) => (
									<div
										key={entry.id}
										className="hover:bg-action-hover flex items-center justify-between gap-3 rounded-xl px-2 py-2.5"
									>
										<div>
											<Typography className="font-medium">
												{entry.playerName || entry.playerEmail}
											</Typography>
											<Typography
												className="text-sm"
												color="text.secondary"
											>
												{entry.kind}
												{entry.gameCode ? ` · ${entry.gameCode}` : ''}
											</Typography>
										</div>
										<Typography className="font-semibold">
											{formatMoney(entry.amount, currency)}
										</Typography>
									</div>
								))}
								{stats.recentLedger.length === 0 && (
									<Typography color="text.secondary">No transactions yet.</Typography>
								)}
							</div>
						</Paper>
					</div>
				</div>
			}
		/>
	);
}

export default WinPeakDashboardView;
