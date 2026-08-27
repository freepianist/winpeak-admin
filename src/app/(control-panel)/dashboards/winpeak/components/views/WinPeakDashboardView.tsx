'use client';

import { useMemo, useState } from 'react';
import FusePageSimple from '@fuse/core/FusePageSimple';
import FuseLoading from '@fuse/core/FuseLoading';
import { motion } from 'motion/react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import { darken, useTheme } from '@mui/material/styles';
import ReactApexChart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import NavLinkAdapter from '@fuse/core/NavLinkAdapter';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import useUser from '@auth/useUser';
import { format, isToday } from 'date-fns';
import { useWinPeakStats } from '@/app/(control-panel)/ops/api/hooks/useWinPeakStats';
import { formatMoney } from '@/lib/money';
import { playerAccountChip } from '@/lib/player-status';
import type { DashboardStats, LedgerItem, Player } from '@/app/(control-panel)/ops/api/types';

const container = {
	show: { transition: { staggerChildren: 0.06 } }
};

const item = {
	hidden: { opacity: 0, y: 20 },
	show: { opacity: 1, y: 0 }
};

const KIND_LABEL: Record<string, string> = {
	DEPOSIT: 'Deposit',
	WITHDRAW: 'Withdrawal',
	BET: 'Bet',
	WIN: 'Win',
	CANCEL: 'Cancel',
	BONUS: 'Bonus',
	CASHBACK: 'Cashback',
	REFERRAL: 'Referral'
};

function firstName(displayName?: string | null) {
	const name = displayName?.trim();
	if (!name) return 'there';
	return name.split(/\s+/)[0];
}

function initials(name: string) {
	return name
		.split(' ')
		.map((part) => part[0])
		.join('')
		.slice(0, 2)
		.toUpperCase();
}

function SummaryCard({
	title,
	value,
	unit,
	footer,
	footerValue,
	to
}: {
	title: string;
	value: string;
	unit: string;
	footer: string;
	footerValue: string;
	to: string;
}) {
	return (
		<Paper className="flex h-full flex-auto flex-col overflow-hidden rounded-xl shadow-sm">
			<div className="flex items-center justify-between px-2 pt-2">
				<Typography
					className="truncate px-3 text-lg font-medium tracking-tight"
					color="text.secondary"
				>
					{title}
				</Typography>
				<IconButton
					component={NavLinkAdapter}
					to={to}
					size="small"
					aria-label={title}
				>
					<FuseSvgIcon size={20}>lucide:ellipsis-vertical</FuseSvgIcon>
				</IconButton>
			</div>
			<div className="mt-6 flex flex-auto flex-col items-center justify-center px-4 text-center">
				<Typography className="text-5xl leading-none font-semibold tracking-tighter md:text-6xl">
					{value}
				</Typography>
				<Typography
					className="mt-2 text-lg font-medium"
					color="text.secondary"
				>
					{unit}
				</Typography>
			</div>
			<Typography
				className="mt-6 mb-4 flex w-full items-baseline justify-center gap-2 px-4"
				color="text.secondary"
			>
				<span className="truncate">{footer}</span>
				<b className="text-lg">{footerValue}</b>
			</Typography>
		</Paper>
	);
}

function MiniStat({
	label,
	value,
	hint,
	large
}: {
	label: string;
	value: string;
	hint: string;
	large?: boolean;
}) {
	return (
		<Paper className="flex flex-auto flex-col overflow-hidden rounded-xl shadow-none">
			<div className="flex items-center justify-between px-2 pt-2">
				<Typography
					className="truncate px-2 text-lg leading-6 font-medium tracking-tight"
					color="text.secondary"
				>
					{label}
				</Typography>
			</div>
			<Typography
				className={
					large
						? 'mt-3 text-center text-4xl leading-none font-semibold tracking-tight'
						: 'mt-3 text-center text-3xl leading-none font-semibold tracking-tight'
				}
			>
				{value}
			</Typography>
			<Typography
				className="mt-4 mb-3 flex items-baseline justify-center gap-2 text-sm"
				color="text.secondary"
			>
				<span className="truncate">{hint}</span>
			</Typography>
		</Paper>
	);
}

function CashflowWidget({ stats, currency }: { stats: DashboardStats; currency: string }) {
	const theme = useTheme();
	const [range, setRange] = useState<'this' | 'last'>('this');
	const rows = range === 'this' ? stats.series.slice(-7) : stats.series.slice(0, 7);

	const options: ApexOptions = useMemo(
		() => ({
			chart: {
				fontFamily: 'inherit',
				foreColor: 'inherit',
				toolbar: { show: false },
				stacked: false
			},
			colors: [theme.palette.secondary.main, theme.palette.text.primary],
			fill: {
				opacity: [0.85, 1],
				type: ['solid', 'solid']
			},
			stroke: { width: [0, 3], curve: 'smooth' },
			dataLabels: {
				enabled: true,
				enabledOnSeries: [1],
				background: { borderWidth: 0, foreColor: theme.palette.background.paper },
				style: { fontSize: '11px', fontWeight: 600 }
			},
			plotOptions: {
				bar: { columnWidth: '46%', borderRadius: 6 }
			},
			grid: {
				borderColor: theme.palette.divider,
				strokeDashArray: 4,
				padding: { left: 12, right: 12 }
			},
			legend: { show: false },
			xaxis: {
				categories: rows.map((row) => format(new Date(`${row.date}T00:00:00`), 'EEE')),
				labels: { style: { colors: theme.palette.text.secondary } },
				axisBorder: { show: false },
				axisTicks: { show: false }
			},
			yaxis: {
				labels: {
					style: { colors: theme.palette.text.secondary },
					formatter: (value) => formatMoney(value, currency)
				}
			},
			tooltip: { theme: theme.palette.mode, shared: true }
		}),
		[currency, rows, theme]
	);

	return (
		<Paper className="flex w-full flex-col overflow-hidden rounded-xl shadow-sm">
			<div className="flex flex-col justify-between p-6 sm:flex-row sm:items-center">
				<div>
					<Typography className="text-2xl font-semibold tracking-tight">Cashflow summary</Typography>
					<Typography
						className="mt-1 text-sm"
						color="text.secondary"
					>
						Deposits versus withdrawals
					</Typography>
				</div>
				<div className="mt-3 flex gap-1 sm:mt-0">
					<Button
						size="small"
						variant={range === 'this' ? 'contained' : 'text'}
						color="secondary"
						onClick={() => setRange('this')}
					>
						This week
					</Button>
					<Button
						size="small"
						variant={range === 'last' ? 'contained' : 'text'}
						onClick={() => setRange('last')}
					>
						Last week
					</Button>
				</div>
			</div>
			<div className="flex flex-col lg:flex-row">
				<div className="min-h-80 min-w-0 flex-1 px-2 pb-2">
					<ReactApexChart
						options={options}
						series={[
							{ name: 'Deposits', type: 'column', data: rows.map((row) => row.deposits) },
							{ name: 'Withdrawals', type: 'line', data: rows.map((row) => row.withdrawals) }
						]}
						type="line"
						height={320}
					/>
				</div>
				<div className="flex flex-col border-divider border-t border-solid lg:w-96 lg:border-t-0 lg:border-l">
					<div className="grid flex-auto grid-cols-2">
						<div className="border-divider border-r border-b border-solid p-3">
							<MiniStat
								large
								label="Deposits"
								value={formatMoney(stats.ledger.deposits, currency)}
								hint={`${stats.ledger.counts.deposits} paid in`}
							/>
						</div>
						<div className="border-divider border-b border-solid p-3">
							<MiniStat
								large
								label="Withdrawals"
								value={formatMoney(stats.ledger.withdrawals, currency)}
								hint={`${stats.ledger.counts.withdrawals} paid out`}
							/>
						</div>
						<div className="border-divider border-r border-b border-solid p-3">
							<MiniStat
								label="Bets"
								value={stats.ledger.counts.bets.toLocaleString()}
								hint={formatMoney(stats.ledger.bets, currency)}
							/>
						</div>
						<div className="border-divider border-b border-solid p-3">
							<MiniStat
								label="Wins"
								value={stats.ledger.counts.wins.toLocaleString()}
								hint={formatMoney(stats.ledger.wins, currency)}
							/>
						</div>
						<div className="border-divider border-r border-solid p-3">
							<MiniStat
								label="Inbox"
								value={(stats.content.unreadInbox || 0).toLocaleString()}
								hint="Unread messages"
							/>
						</div>
						<div className="p-3">
							<MiniStat
								label="Partners"
								value={(stats.affiliates?.partners || 0).toLocaleString()}
								hint={`${stats.affiliates?.ftds || 0} first-time deposits`}
							/>
						</div>
					</div>
				</div>
			</div>
		</Paper>
	);
}

function DistributionWidget({ stats, currency }: { stats: DashboardStats; currency: string }) {
	const theme = useTheme();
	const series = [
		Math.max(0, stats.ledger.deposits),
		Math.max(0, stats.ledger.withdrawals),
		Math.max(0, stats.ledger.bets),
		Math.max(0, stats.ledger.wins)
	];
	const empty = series.every((value) => value <= 0);

	const options: ApexOptions = {
		chart: { fontFamily: 'inherit', foreColor: 'inherit', toolbar: { show: false } },
		labels: ['Deposits', 'Withdrawals', 'Bets', 'Wins'],
		colors: [
			theme.palette.secondary.main,
			theme.palette.text.primary,
			theme.palette.info.main,
			theme.palette.success.main
		],
		legend: { position: 'bottom' },
		stroke: { width: 0 },
		yaxis: {
			labels: { formatter: (value) => formatMoney(Number(value), currency) }
		},
		tooltip: {
			theme: theme.palette.mode,
			y: { formatter: (value) => formatMoney(value, currency) }
		}
	};

	return (
		<Paper className="flex h-full flex-col overflow-hidden rounded-xl shadow-sm">
			<div className="p-6">
				<Typography className="text-2xl font-semibold tracking-tight">Money mix</Typography>
				<Typography
					className="mt-1 text-sm"
					color="text.secondary"
				>
					How cash moved through the casino
				</Typography>
			</div>
			<div className="flex flex-auto items-center justify-center px-2 pb-4">
				{empty ? (
					<Typography
						className="px-6 pb-8 text-center"
						color="text.secondary"
					>
						No cashflow yet. Deposits and play will show up here.
					</Typography>
				) : (
					<ReactApexChart
						options={options}
						series={series}
						type="polarArea"
						height={320}
					/>
				)}
			</div>
		</Paper>
	);
}

function ActivityWidget({
	entries,
	currency
}: {
	entries: LedgerItem[];
	currency: string;
}) {
	return (
		<Paper className="flex h-full flex-col overflow-hidden rounded-xl shadow-sm">
			<div className="flex items-center justify-between p-6">
				<div>
					<Typography className="text-2xl font-semibold tracking-tight">Latest activity</Typography>
					<Typography
						className="mt-1 text-sm"
						color="text.secondary"
					>
						Live ledger as it happens
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
			<div className="flex flex-auto flex-col px-3 pb-4">
				{entries.map((entry) => {
					const when = new Date(entry.createdAt);
					return (
						<div
							key={entry.id}
							className="hover:bg-action-hover flex items-start justify-between gap-3 rounded-xl px-3 py-3"
						>
							<div className="min-w-0">
								<Typography className="font-medium">
									{KIND_LABEL[entry.kind] || entry.kind}
								</Typography>
								<Typography
									className="truncate text-sm"
									color="text.secondary"
								>
									{entry.playerName || entry.playerEmail}
									{entry.gameCode ? ` · ${entry.gameCode}` : ''}
								</Typography>
							</div>
							<div className="shrink-0 text-right">
								<Typography className="font-semibold">
									{formatMoney(entry.amount, currency)}
								</Typography>
								<Typography
									className="text-sm"
									color="text.secondary"
								>
									{isToday(when) ? format(when, 'p') : format(when, 'MMM d')}
								</Typography>
							</div>
						</div>
					);
				})}
				{entries.length === 0 && (
					<Typography
						className="px-3 py-6"
						color="text.secondary"
					>
						No transactions yet.
					</Typography>
				)}
			</div>
		</Paper>
	);
}

function PlayersWidget({ players }: { players: Player[] }) {
	return (
		<Paper className="flex h-full flex-col overflow-hidden rounded-xl shadow-sm">
			<div className="flex items-center justify-between p-6">
				<div>
					<Typography className="text-2xl font-semibold tracking-tight">Newest players</Typography>
					<Typography
						className="mt-1 text-sm"
						color="text.secondary"
					>
						Latest accounts to join WinPeak
					</Typography>
				</div>
				<Button
					component={NavLinkAdapter}
					to="/apps/players"
					size="small"
					endIcon={<FuseSvgIcon size={16}>lucide:arrow-right</FuseSvgIcon>}
				>
					Players
				</Button>
			</div>
			<div className="flex flex-auto flex-col px-3 pb-4">
				{players.map((player) => {
					const chip = playerAccountChip(player);
					return (
						<div
							key={player.id}
							className="hover:bg-action-hover flex items-center justify-between gap-3 rounded-xl px-3 py-3"
						>
							<div className="flex min-w-0 items-center gap-3">
								<Avatar className="h-10 w-10 text-sm font-semibold">
									{initials(player.displayName || player.email)}
								</Avatar>
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
									className="mt-1"
									label={chip.label}
									color={chip.color}
									variant="outlined"
								/>
							</div>
						</div>
					);
				})}
				{players.length === 0 && (
					<Typography
						className="px-3 py-6"
						color="text.secondary"
					>
						No players yet.
					</Typography>
				)}
			</div>
		</Paper>
	);
}

function WinPeakDashboardView() {
	const { data: user } = useUser();
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
	const pendingDeposits = stats.queues?.pendingDeposits || 0;
	const pendingWithdrawals = stats.queues?.pendingWithdrawals || 0;
	const pendingTotal = pendingDeposits + pendingWithdrawals;
	const unread = stats.content.unreadInbox || 0;
	const name = firstName(user?.displayName);

	return (
		<FusePageSimple
			content={
				<div className="w-full px-4 pt-4 pb-10 sm:px-6 md:px-8">
					<PageBreadcrumb className="mb-4 opacity-80" />

					<motion.div
						className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center"
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
					>
						<div className="flex min-w-0 items-center">
							{user?.photoURL ? (
								<Avatar
									src={user.photoURL}
									alt={user.displayName}
									className="mr-4 h-16 w-16"
								/>
							) : (
								<Avatar
									className="mr-4 h-16 w-16 text-xl font-semibold"
									sx={(theme) => ({
										background: darken(theme.palette.background.default, 0.06),
										color: theme.palette.text.secondary
									})}
								>
									{user?.displayName?.[0] || 'W'}
								</Avatar>
							)}
							<div className="min-w-0">
								<Typography className="text-3xl leading-none font-semibold tracking-tight md:text-4xl">
									Welcome back, {name}!
								</Typography>
								<Typography
									className="mt-2 text-sm md:text-base"
									color="text.secondary"
								>
									You have {unread} unread {unread === 1 ? 'message' : 'messages'} and {pendingTotal}{' '}
									pending wallet {pendingTotal === 1 ? 'request' : 'requests'}.
								</Typography>
							</div>
						</div>
						<div className="flex flex-wrap gap-2 sm:shrink-0">
							<Button
								component={NavLinkAdapter}
								to="/apps/inbox"
								variant="contained"
								className="min-h-10"
								startIcon={<FuseSvgIcon size={18}>lucide:mail</FuseSvgIcon>}
							>
								Inbox
							</Button>
							<Button
								component={NavLinkAdapter}
								to="/apps/wallet-requests"
								variant="contained"
								color="secondary"
								className="min-h-10"
								startIcon={<FuseSvgIcon size={18}>lucide:wallet</FuseSvgIcon>}
							>
								Requests
							</Button>
						</div>
					</motion.div>

					<motion.div
						className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4"
						variants={container}
						initial="hidden"
						animate="show"
					>
						<motion.div
							variants={item}
							className="flex"
						>
							<SummaryCard
								title="Players"
								value={stats.users.total.toLocaleString()}
								unit="Registered"
								footer="New this week:"
								footerValue={stats.users.newThisWeek.toLocaleString()}
								to="/apps/players"
							/>
						</motion.div>
						<motion.div
							variants={item}
							className="flex"
						>
							<SummaryCard
								title="Overdue"
								value={pendingWithdrawals.toLocaleString()}
								unit="Payouts waiting"
								footer="Deposit reviews:"
								footerValue={pendingDeposits.toLocaleString()}
								to="/apps/wallet-requests"
							/>
						</motion.div>
						<motion.div
							variants={item}
							className="flex"
						>
							<SummaryCard
								title="Inbox"
								value={unread.toLocaleString()}
								unit="Unread messages"
								footer="Comments:"
								footerValue={stats.content.comments.toLocaleString()}
								to="/apps/inbox"
							/>
						</motion.div>
						<motion.div
							variants={item}
							className="flex"
						>
							<SummaryCard
								title="Gross gaming"
								value={formatMoney(stats.ledger.ggr, currency)}
								unit="House edge"
								footer="Wagered:"
								footerValue={formatMoney(stats.ledger.bets, currency)}
								to="/apps/games"
							/>
						</motion.div>
					</motion.div>

					<motion.div
						className="mt-8"
						initial={{ opacity: 0, y: 16 }}
						animate={{ opacity: 1, y: 0, transition: { delay: 0.12 } }}
					>
						<CashflowWidget
							stats={stats}
							currency={currency}
						/>
					</motion.div>

					<div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
						<DistributionWidget
							stats={stats}
							currency={currency}
						/>
						<ActivityWidget
							entries={stats.recentLedger}
							currency={currency}
						/>
					</div>

					<div className="mt-8">
						<PlayersWidget players={stats.recentUsers} />
					</div>
				</div>
			}
		/>
	);
}

export default WinPeakDashboardView;
