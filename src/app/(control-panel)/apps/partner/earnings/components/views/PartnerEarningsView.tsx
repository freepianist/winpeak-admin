'use client';

import { useMemo, useState } from 'react';
import FusePageSimple from '@fuse/core/FusePageSimple';
import FuseLoading from '@fuse/core/FuseLoading';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import NavLinkAdapter from '@fuse/core/NavLinkAdapter';
import { motion } from 'motion/react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import { alpha, useTheme } from '@mui/material/styles';
import ReactApexChart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { format, isSameMonth, startOfMonth, subMonths } from 'date-fns';
import AdminPageHeader from '@/app/(control-panel)/ops/components/AdminPageHeader';
import { useMyAffiliate } from '@/app/(control-panel)/ops/api/hooks/useAffiliates';
import type {
	AffiliateCommission,
	AffiliatePartnerDetail,
	AffiliatePayout,
	CommissionStatus
} from '@/app/(control-panel)/ops/api/types';
import { formatMoney } from '@/lib/money';
import { statusLabel } from '@/lib/status-label';

type ChipColor = 'default' | 'warning' | 'info' | 'success';

const STATUS_COLOR: Record<CommissionStatus, ChipColor> = {
	PENDING: 'warning',
	APPROVED: 'info',
	PAID: 'success',
	VOID: 'default'
};

const FILTERS: { value: 'ALL' | CommissionStatus; label: string }[] = [
	{ value: 'ALL', label: 'All' },
	{ value: 'PENDING', label: 'Pending' },
	{ value: 'APPROVED', label: 'Approved' },
	{ value: 'PAID', label: 'Paid' },
	{ value: 'VOID', label: 'Void' }
];

const PAGE_SIZE = 8;

const container = {
	show: { transition: { staggerChildren: 0.06 } }
};

const item = {
	hidden: { opacity: 0, y: 20 },
	show: { opacity: 1, y: 0 }
};

function dealTerms(data: AffiliatePartnerDetail) {
	const { dealType, cpaAmount, revSharePercent } = data.partner;

	if (dealType === 'CPA') {
		return `${formatMoney(cpaAmount)} CPA per first deposit`;
	}

	if (dealType === 'REVSHARE') {
		return `${revSharePercent}% revenue share`;
	}

	return `${formatMoney(cpaAmount)} CPA + ${revSharePercent}% revenue share`;
}

function commissionDetail(row: AffiliateCommission) {
	const who = row.kind === 'CPA' ? row.playerEmail || row.playerName || 'Referred player' : 'Rev share period';
	const basis =
		row.basisAmount > 0
			? row.kind === 'CPA'
				? `on ${formatMoney(row.basisAmount)} deposit`
				: `of ${formatMoney(row.basisAmount)} GGR`
			: '';

	return [who, basis, format(new Date(row.createdAt), 'MMM d, yyyy')].filter(Boolean).join(' · ');
}

function IconTile({ icon, color }: { icon: string; color: string }) {
	return (
		<div
			className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
			style={{ backgroundColor: alpha(color, 0.12), color }}
		>
			<FuseSvgIcon size={20}>{icon}</FuseSvgIcon>
		</div>
	);
}

function BalanceHero({ data }: { data: AffiliatePartnerDetail }) {
	const theme = useTheme();
	const { stats } = data;
	const expected = stats.pending + stats.approved;
	const total = stats.bookedCpa + stats.bookedRevShare;
	const segments = [
		{ label: 'Paid', value: stats.paid, color: theme.palette.success.main },
		{ label: 'Approved', value: stats.approved, color: theme.palette.info.main },
		{ label: 'Pending', value: stats.pending, color: theme.palette.warning.main }
	];
	const unbookedRevShare =
		data.partner.dealType === 'CPA' ? 0 : Math.max(0, stats.estimatedRevShare - stats.bookedRevShare);

	return (
		<Paper
			className="relative overflow-hidden rounded-2xl p-6 text-white shadow-md md:p-8"
			sx={{
				background: `radial-gradient(circle at 90% -10%, ${alpha(theme.palette.secondary.main, 0.55)} 0%, transparent 55%), radial-gradient(circle at 0% 120%, ${alpha(theme.palette.info.main, 0.35)} 0%, transparent 50%), linear-gradient(135deg, #0f172a 0%, #1e293b 100%)`
			}}
		>
			<FuseSvgIcon
				size={220}
				className="pointer-events-none absolute -right-10 -bottom-16 opacity-[0.06]"
			>
				lucide:coins
			</FuseSvgIcon>

			<div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
				<div className="min-w-0">
					<div className="flex items-center gap-2 text-white/70">
						<FuseSvgIcon size={18}>lucide:sparkles</FuseSvgIcon>
						<Typography className="text-sm font-medium tracking-wide uppercase">
							Expected earnings
						</Typography>
					</div>
					<Typography className="mt-3 text-5xl leading-none font-bold tracking-tight md:text-6xl">
						{formatMoney(expected)}
					</Typography>
					<Typography className="mt-3 text-sm text-white/70">
						{expected <= 0
							? 'Nothing owed right now. New commissions show up here as soon as they are booked.'
							: stats.pending > 0
								? `${formatMoney(stats.pending)} still in review`
								: 'Everything is approved and queued for your next payout'}
					</Typography>
					{unbookedRevShare >= 0.01 && (
						<div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm">
							<FuseSvgIcon
								size={14}
								className="text-white/70"
							>
								lucide:trending-up
							</FuseSvgIcon>
							<span>
								+ about <b>{formatMoney(unbookedRevShare)}</b> estimated rev share, not booked yet
							</span>
						</div>
					)}
					<div className="mt-5 flex flex-wrap items-center gap-2">
						<Chip
							size="small"
							label={data.partner.dealType}
							sx={{ bgcolor: alpha('#fff', 0.14), color: '#fff', fontWeight: 600 }}
						/>
						<Typography className="text-sm text-white/70">{dealTerms(data)}</Typography>
					</div>
				</div>

				<div className="flex flex-col gap-3 sm:flex-row">
					<div className="rounded-xl bg-white/10 px-5 py-4 backdrop-blur-sm">
						<Typography className="text-xs font-medium tracking-wide text-white/60 uppercase">
							Ready for payout
						</Typography>
						<Typography className="mt-1 text-2xl font-semibold tracking-tight">
							{formatMoney(stats.approved)}
						</Typography>
					</div>
					<div className="rounded-xl bg-white/10 px-5 py-4 backdrop-blur-sm">
						<Typography className="text-xs font-medium tracking-wide text-white/60 uppercase">
							Paid out
						</Typography>
						<Typography className="mt-1 text-2xl font-semibold tracking-tight">
							{formatMoney(stats.paidOut)}
						</Typography>
					</div>
				</div>
			</div>

			<div className="relative mt-8">
				<div className="flex h-2.5 w-full gap-1 overflow-hidden rounded-full bg-white/10">
					{total > 0 &&
						segments
							.filter((segment) => segment.value > 0)
							.map((segment) => (
								<motion.div
									key={segment.label}
									className="h-full rounded-full"
									style={{ backgroundColor: segment.color }}
									initial={{ width: 0 }}
									animate={{ width: `${(segment.value / total) * 100}%` }}
									transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
								/>
							))}
				</div>
				<div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
					{segments.map((segment) => (
						<div
							key={segment.label}
							className="flex items-center gap-2 text-sm"
						>
							<span
								className="h-2.5 w-2.5 rounded-full"
								style={{ backgroundColor: segment.color }}
							/>
							<span className="text-white/70">{segment.label}</span>
							<span className="font-semibold">{formatMoney(segment.value)}</span>
						</div>
					))}
				</div>
			</div>
		</Paper>
	);
}

function StatCard({
	label,
	value,
	hint,
	icon,
	color
}: {
	label: string;
	value: string;
	hint: string;
	icon: string;
	color: string;
}) {
	return (
		<Paper className="flex h-full w-full flex-col gap-4 rounded-xl p-5 shadow-sm">
			<div className="flex items-center justify-between gap-3">
				<Typography
					className="text-sm font-medium"
					color="text.secondary"
				>
					{label}
				</Typography>
				<IconTile
					icon={icon}
					color={color}
				/>
			</div>
			<div>
				<Typography className="text-3xl leading-none font-semibold tracking-tight">{value}</Typography>
				<Typography
					className="mt-2 text-sm"
					color="text.secondary"
				>
					{hint}
				</Typography>
			</div>
		</Paper>
	);
}

function EarningsChart({ commissions }: { commissions: AffiliateCommission[] }) {
	const theme = useTheme();

	const months = useMemo(() => {
		const start = startOfMonth(new Date());
		return Array.from({ length: 6 }, (_, index) => subMonths(start, 5 - index));
	}, []);

	const series = useMemo(() => {
		const booked = commissions.filter((row) => row.status !== 'VOID');
		const sum = (kind: AffiliateCommission['kind']) =>
			months.map((month) =>
				Number(
					booked
						.filter((row) => row.kind === kind && isSameMonth(new Date(row.createdAt), month))
						.reduce((acc, row) => acc + row.amount, 0)
						.toFixed(2)
				)
			);

		return [
			{ name: 'CPA', data: sum('CPA') },
			{ name: 'Rev share', data: sum('REVSHARE') }
		];
	}, [commissions, months]);

	const empty = series.every((row) => row.data.every((value) => value <= 0));
	const periodTotal = series.reduce((acc, row) => acc + row.data.reduce((a, b) => a + b, 0), 0);

	const options: ApexOptions = useMemo(
		() => ({
			chart: {
				fontFamily: 'inherit',
				foreColor: 'inherit',
				toolbar: { show: false },
				stacked: true
			},
			colors: [theme.palette.secondary.main, theme.palette.info.main],
			plotOptions: {
				bar: { columnWidth: '42%', borderRadius: 6, borderRadiusWhenStacked: 'last' }
			},
			dataLabels: { enabled: false },
			grid: {
				borderColor: theme.palette.divider,
				strokeDashArray: 4,
				padding: { left: 12, right: 12 }
			},
			legend: {
				position: 'top',
				horizontalAlign: 'right',
				labels: { colors: theme.palette.text.secondary },
				markers: { size: 6, shape: 'circle' }
			},
			xaxis: {
				categories: months.map((month) => format(month, 'MMM')),
				labels: { style: { colors: theme.palette.text.secondary } },
				axisBorder: { show: false },
				axisTicks: { show: false }
			},
			yaxis: {
				min: 0,
				forceNiceScale: true,
				labels: {
					style: { colors: theme.palette.text.secondary },
					formatter: (value) => formatMoney(value).replace(/\.00$/, '')
				}
			},
			tooltip: {
				theme: theme.palette.mode,
				shared: true,
				intersect: false,
				y: { formatter: (value) => formatMoney(value) }
			}
		}),
		[months, theme]
	);

	return (
		<Paper className="flex h-full flex-col overflow-hidden rounded-xl shadow-sm">
			<div className="flex items-start justify-between gap-4 p-6 pb-0">
				<div>
					<Typography className="text-xl font-semibold tracking-tight">Earnings over time</Typography>
					<Typography
						className="mt-1 text-sm"
						color="text.secondary"
					>
						Commissions booked per month, last 6 months
					</Typography>
				</div>
				<div className="text-right">
					<Typography className="text-2xl font-semibold tracking-tight">
						{formatMoney(periodTotal)}
					</Typography>
					<Typography
						className="text-xs"
						color="text.secondary"
					>
						6-month total
					</Typography>
				</div>
			</div>
			<div className="min-h-72 flex-auto px-2 pb-2">
				{empty ? (
					<div className="flex h-72 flex-col items-center justify-center gap-3 px-6 text-center">
						<FuseSvgIcon
							size={36}
							color="disabled"
						>
							lucide:chart-column
						</FuseSvgIcon>
						<Typography color="text.secondary">
							Nothing booked in the last 6 months. Monthly commissions will chart here.
						</Typography>
					</div>
				) : (
					<ReactApexChart
						options={options}
						series={series}
						type="bar"
						height={288}
					/>
				)}
			</div>
		</Paper>
	);
}

function EarningsMix({ data }: { data: AffiliatePartnerDetail }) {
	const theme = useTheme();
	const { stats, partner } = data;
	const total = stats.bookedCpa + stats.bookedRevShare;
	const rows = [
		{
			label: 'CPA',
			hint: 'Paid once per qualified first deposit',
			value: stats.bookedCpa,
			color: theme.palette.secondary.main,
			icon: 'lucide:user-plus'
		},
		{
			label: 'Revenue share',
			hint: 'Share of referred players’ net gaming revenue',
			value: stats.bookedRevShare,
			color: theme.palette.info.main,
			icon: 'lucide:percent'
		}
	];

	return (
		<Paper className="flex h-full flex-col overflow-hidden rounded-xl p-6 shadow-sm">
			<Typography className="text-xl font-semibold tracking-tight">Earnings mix</Typography>
			<Typography
				className="mt-1 text-sm"
				color="text.secondary"
			>
				Where your booked commissions come from
			</Typography>

			<div className="mt-6 flex flex-col gap-6">
				{rows.map((row) => {
					const share = total > 0 ? (row.value / total) * 100 : 0;
					return (
						<div key={row.label}>
							<div className="flex items-center gap-3">
								<IconTile
									icon={row.icon}
									color={row.color}
								/>
								<div className="min-w-0 flex-1">
									<div className="flex items-baseline justify-between gap-2">
										<Typography className="font-medium">{row.label}</Typography>
										<Typography className="font-semibold">{formatMoney(row.value)}</Typography>
									</div>
									<div className="flex items-baseline justify-between gap-2">
										<Typography
											className="truncate text-xs"
											color="text.secondary"
										>
											{row.hint}
										</Typography>
										<Typography
											className="text-xs"
											color="text.secondary"
										>
											{share.toFixed(0)}%
										</Typography>
									</div>
								</div>
							</div>
							<div
								className="mt-3 h-2 overflow-hidden rounded-full"
								style={{ backgroundColor: theme.palette.divider }}
							>
								<motion.div
									className="h-full rounded-full"
									style={{ backgroundColor: row.color }}
									initial={{ width: 0 }}
									animate={{ width: `${share}%` }}
									transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
								/>
							</div>
						</div>
					);
				})}
			</div>

			{partner.dealType !== 'CPA' && (
				<div
					className="mt-auto rounded-xl p-4"
					style={{ backgroundColor: alpha(theme.palette.info.main, 0.08) }}
				>
					<div className="flex items-center justify-between gap-3">
						<Typography
							className="text-sm"
							color="text.secondary"
						>
							Referred GGR
						</Typography>
						<Typography className="text-sm font-semibold">{formatMoney(stats.ggr)}</Typography>
					</div>
					<div className="mt-2 flex items-center justify-between gap-3">
						<Typography
							className="text-sm"
							color="text.secondary"
						>
							Estimated rev share at {partner.revSharePercent}%
						</Typography>
						<Typography className="text-sm font-semibold">
							{formatMoney(stats.estimatedRevShare)}
						</Typography>
					</div>
				</div>
			)}
		</Paper>
	);
}

function CommissionRow({ row }: { row: AffiliateCommission }) {
	const theme = useTheme();
	const isCpa = row.kind === 'CPA';
	const isVoid = row.status === 'VOID';

	return (
		<div className="hover:bg-action-hover flex items-center gap-4 rounded-xl px-3 py-3 transition-colors">
			<IconTile
				icon={isCpa ? 'lucide:user-plus' : 'lucide:percent'}
				color={
					isVoid
						? theme.palette.text.disabled
						: isCpa
							? theme.palette.secondary.main
							: theme.palette.info.main
				}
			/>
			<div className="min-w-0 flex-1">
				<Typography className="font-medium">{isCpa ? 'CPA commission' : 'Revenue share'}</Typography>
				<Typography
					className="truncate text-sm"
					color="text.secondary"
				>
					{commissionDetail(row)}
				</Typography>
			</div>
			<div className="flex shrink-0 flex-col items-end gap-1">
				<Typography
					className={isVoid ? 'font-semibold line-through' : 'font-semibold'}
					color={isVoid ? 'text.disabled' : 'text.primary'}
				>
					{formatMoney(row.amount)}
				</Typography>
				<Chip
					size="small"
					label={statusLabel(row.status)}
					color={STATUS_COLOR[row.status]}
					variant={row.status === 'PAID' ? 'filled' : 'outlined'}
				/>
			</div>
		</div>
	);
}

function CommissionsCard({ commissions }: { commissions: AffiliateCommission[] }) {
	const theme = useTheme();
	const [filter, setFilter] = useState<'ALL' | CommissionStatus>('ALL');
	const [visible, setVisible] = useState(PAGE_SIZE);

	const counts = useMemo(() => {
		const result: Record<string, number> = { ALL: commissions.length };
		commissions.forEach((row) => {
			result[row.status] = (result[row.status] || 0) + 1;
		});
		return result;
	}, [commissions]);

	const rows = filter === 'ALL' ? commissions : commissions.filter((row) => row.status === filter);

	return (
		<Paper className="flex h-full flex-col overflow-hidden rounded-xl shadow-sm">
			<div className="flex items-start justify-between gap-4 p-6 pb-2">
				<div>
					<Typography className="text-xl font-semibold tracking-tight">Commissions</Typography>
					<Typography
						className="mt-1 text-sm"
						color="text.secondary"
					>
						Every commission WinPeak has booked for you
					</Typography>
				</div>
			</div>
			<Tabs
				value={filter}
				onChange={(_, value: 'ALL' | CommissionStatus) => {
					setFilter(value);
					setVisible(PAGE_SIZE);
				}}
				variant="scrollable"
				scrollButtons="auto"
				className="border-divider border-b border-solid"
				sx={{
					width: '100%',
					padding: 0,
					paddingX: 3,
					borderRadius: 0,
					backgroundColor: 'transparent',
					'& .MuiTabs-indicator': {
						top: 'auto',
						bottom: 0,
						minHeight: 0,
						height: 2,
						border: 0,
						borderRadius: '2px 2px 0 0',
						backgroundColor: theme.palette.secondary.main
					}
				}}
			>
				{FILTERS.map((option) => {
					const selected = filter === option.value;
					return (
						<Tab
							key={option.value}
							value={option.value}
							disableRipple
							className="min-h-12 min-w-0 px-3 text-sm font-medium"
							sx={{ borderRadius: 0 }}
							label={
								<span className="flex items-center gap-2">
									{option.label}
									<span
										className="min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs leading-none font-semibold"
										style={
											selected
												? {
														backgroundColor: alpha(theme.palette.secondary.main, 0.14),
														color: theme.palette.secondary.main
													}
												: {
														backgroundColor: alpha(theme.palette.text.primary, 0.06),
														color: theme.palette.text.secondary
													}
										}
									>
										{counts[option.value] || 0}
									</span>
								</span>
							}
						/>
					);
				})}
			</Tabs>
			<div className="flex flex-auto flex-col px-3 py-3">
				{rows.slice(0, visible).map((row) => (
					<CommissionRow
						key={row.id}
						row={row}
					/>
				))}
				{rows.length === 0 && (
					<div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
						<FuseSvgIcon
							size={36}
							color="disabled"
						>
							lucide:receipt
						</FuseSvgIcon>
						<Typography color="text.secondary">
							{commissions.length === 0
								? 'No commissions yet. They appear after a referred player’s first deposit, or when staff books rev share.'
								: `No ${statusLabel(filter).toLowerCase()} commissions.`}
						</Typography>
					</div>
				)}
				{rows.length > visible && (
					<Button
						className="mx-auto mt-2"
						size="small"
						onClick={() => setVisible((count) => count + PAGE_SIZE)}
						endIcon={<FuseSvgIcon size={16}>lucide:chevron-down</FuseSvgIcon>}
					>
						Show more ({rows.length - visible})
					</Button>
				)}
			</div>
		</Paper>
	);
}

function PayoutsCard({ payouts, approved }: { payouts: AffiliatePayout[]; approved: number }) {
	const theme = useTheme();

	return (
		<Paper className="flex h-full flex-col overflow-hidden rounded-xl shadow-sm">
			<div className="p-6 pb-2">
				<Typography className="text-xl font-semibold tracking-tight">Payouts</Typography>
				<Typography
					className="mt-1 text-sm"
					color="text.secondary"
				>
					Money WinPeak has sent to you
				</Typography>
			</div>

			{approved > 0 && (
				<div
					className="mx-6 mt-3 flex items-center gap-3 rounded-xl p-4"
					style={{ backgroundColor: alpha(theme.palette.info.main, 0.08) }}
				>
					<FuseSvgIcon
						size={20}
						color="info"
					>
						lucide:hourglass
					</FuseSvgIcon>
					<Typography className="text-sm">
						<b>{formatMoney(approved)}</b> approved and queued for your next payout.
					</Typography>
				</div>
			)}

			<div className="flex flex-auto flex-col px-6 pt-4 pb-6">
				{payouts.map((row, index) => {
					const sent = row.status === 'SENT';
					const color = sent ? theme.palette.success.main : theme.palette.warning.main;
					const last = index === payouts.length - 1;

					return (
						<div
							key={row.id}
							className="flex gap-4"
						>
							<div className="flex flex-col items-center">
								<div
									className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
									style={{ backgroundColor: alpha(color, 0.14), color }}
								>
									<FuseSvgIcon size={16}>{sent ? 'lucide:circle-check' : 'lucide:clock'}</FuseSvgIcon>
								</div>
								{!last && (
									<div
										className="my-1 w-px flex-auto"
										style={{ backgroundColor: theme.palette.divider }}
									/>
								)}
							</div>
							<div className={last ? 'min-w-0 flex-1' : 'min-w-0 flex-1 pb-5'}>
								<div className="flex items-center justify-between gap-3">
									<Typography className="text-lg font-semibold">{formatMoney(row.amount)}</Typography>
									<Chip
										size="small"
										label={statusLabel(row.status)}
										color={sent ? 'success' : 'warning'}
										variant="outlined"
									/>
								</div>
								<Typography
									className="truncate text-sm"
									color="text.secondary"
								>
									{row.note || 'Payout'} · {format(new Date(row.createdAt), 'MMM d, yyyy')}
								</Typography>
							</div>
						</div>
					);
				})}
				{payouts.length === 0 && (
					<div className="flex flex-auto flex-col items-center justify-center gap-3 py-12 text-center">
						<FuseSvgIcon
							size={36}
							color="disabled"
						>
							lucide:piggy-bank
						</FuseSvgIcon>
						<Typography color="text.secondary">No payouts recorded yet.</Typography>
					</div>
				)}
			</div>
		</Paper>
	);
}

function PartnerEarningsView() {
	const theme = useTheme();
	const { data, isLoading, isError, error, refetch } = useMyAffiliate();

	if (isLoading) {
		return <FuseLoading />;
	}

	if (isError || !data) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4 p-8">
				<Typography variant="h5">Could not load your earnings</Typography>
				<Typography color="text.secondary">
					{error instanceof Error ? error.message : 'Ask WinPeak staff to activate your account.'}
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

	const { stats } = data;
	const commissions = data.commissions || [];
	const payouts = data.payouts || [];
	const now = new Date();
	const thisMonth = commissions.filter((row) => row.status !== 'VOID' && isSameMonth(new Date(row.createdAt), now));
	const thisMonthTotal = thisMonth.reduce((sum, row) => sum + row.amount, 0);
	const lifetime = stats.bookedCpa + stats.bookedRevShare;
	const booked = commissions.filter((row) => row.status !== 'VOID').length;
	const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

	return (
		<FusePageSimple
			header={
				<AdminPageHeader
					title="My earnings"
					subtitle="Commissions WinPeak booked for you, and payouts already sent."
					action={
						<Button
							component={NavLinkAdapter}
							to="/dashboards/partner"
							variant="outlined"
							startIcon={<FuseSvgIcon size={18}>lucide:layout-dashboard</FuseSvgIcon>}
						>
							Dashboard
						</Button>
					}
				/>
			}
			content={
				<div className="w-full px-4 pt-4 pb-10 md:px-8">
					<motion.div
						initial={{ opacity: 0, y: 16 }}
						animate={{ opacity: 1, y: 0 }}
					>
						<BalanceHero data={data} />
					</motion.div>

					<motion.div
						className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4"
						variants={container}
						initial="hidden"
						animate="show"
					>
						<motion.div
							variants={item}
							className="flex"
						>
							<StatCard
								label="This month"
								value={formatMoney(thisMonthTotal)}
								hint={`${plural(thisMonth.length, 'commission')} booked in ${format(now, 'MMMM')}`}
								icon="lucide:trending-up"
								color={theme.palette.warning.main}
							/>
						</motion.div>
						<motion.div
							variants={item}
							className="flex"
						>
							<StatCard
								label="Lifetime earned"
								value={formatMoney(lifetime)}
								hint={`${plural(booked, 'commission')} booked since you joined`}
								icon="lucide:coins"
								color={theme.palette.success.main}
							/>
						</motion.div>
						<motion.div
							variants={item}
							className="flex"
						>
							<StatCard
								label="Per qualified player"
								value={stats.ftds > 0 ? formatMoney(lifetime / stats.ftds) : '—'}
								hint="Average earned per player who deposited"
								icon="lucide:hand-coins"
								color={theme.palette.info.main}
							/>
						</motion.div>
						<motion.div
							variants={item}
							className="flex"
						>
							<StatCard
								label="Qualified players"
								value={stats.ftds.toLocaleString()}
								hint={`out of ${plural(stats.signups, 'signup')} made a first deposit`}
								icon="lucide:user-plus"
								color={theme.palette.secondary.main}
							/>
						</motion.div>
					</motion.div>

					<motion.div
						className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3"
						initial={{ opacity: 0, y: 16 }}
						animate={{ opacity: 1, y: 0, transition: { delay: 0.12 } }}
					>
						<div className="xl:col-span-2">
							<EarningsChart commissions={commissions} />
						</div>
						<EarningsMix data={data} />
					</motion.div>

					<motion.div
						className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3"
						initial={{ opacity: 0, y: 16 }}
						animate={{ opacity: 1, y: 0, transition: { delay: 0.18 } }}
					>
						<div className="xl:col-span-2">
							<CommissionsCard commissions={commissions} />
						</div>
						<PayoutsCard
							payouts={payouts}
							approved={stats.approved}
						/>
					</motion.div>
				</div>
			}
		/>
	);
}

export default PartnerEarningsView;
