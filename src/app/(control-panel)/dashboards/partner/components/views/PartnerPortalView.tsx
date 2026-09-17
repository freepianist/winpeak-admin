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
import { enqueueSnackbar } from 'notistack';
import { format, isToday } from 'date-fns';
import { useMyAffiliate } from '@/app/(control-panel)/ops/api/hooks/useAffiliates';
import type {
	AffiliateClick,
	AffiliateClickSeriesPoint,
	AffiliatePartnerDetail,
	AffiliatePlayer
} from '@/app/(control-panel)/ops/api/types';
import { formatMoney } from '@/lib/money';
import { deviceLabel, locationLabel, visitTypeColor, visitTypeLabel, visitTypeOf } from '@/lib/affiliate-traffic';

const container = {
	show: { transition: { staggerChildren: 0.06 } }
};

const item = {
	hidden: { opacity: 0, y: 20 },
	show: { opacity: 1, y: 0 }
};

function firstName(displayName?: string | null) {
	const name = displayName?.trim();

	if (!name) {
		return 'there';
	}

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

function formatRate(part: number, whole: number) {
	if (!whole) {
		return '—';
	}

	return `${((part / whole) * 100).toFixed(1)}%`;
}

function landingLabel(path: string) {
	return !path || path === '/' ? 'Home' : path;
}

function dealCopy(data: AffiliatePartnerDetail) {
	const floor =
		data.partner.minFtdAmount > 0 ? ` · FTD ${formatMoney(data.partner.minFtdAmount)}+` : '';

	if (data.partner.dealType === 'CPA') {
		return `CPA ${formatMoney(data.partner.cpaAmount)} per first deposit${floor}`;
	}

	if (data.partner.dealType === 'REVSHARE') {
		return `${data.partner.revSharePercent}% of referred player GGR${floor}`;
	}

	return `CPA ${formatMoney(data.partner.cpaAmount)} plus ${data.partner.revSharePercent}% rev share${floor}`;
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

function TrafficWidget({
	series,
	clicks,
	uniqueClicks,
	signups,
	ftds
}: {
	series: AffiliateClickSeriesPoint[];
	clicks: number;
	uniqueClicks: number;
	signups: number;
	ftds: number;
}) {
	const theme = useTheme();
	const [range, setRange] = useState<'this' | 'last'>('this');
	const rows = range === 'this' ? series.slice(-7) : series.slice(0, 7);
	const empty = series.every((row) => row.clicks <= 0);

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
					formatter: (value) => String(Math.round(value))
				},
				min: 0,
				forceNiceScale: true
			},
			tooltip: { theme: theme.palette.mode, shared: true }
		}),
		[rows, theme]
	);

	return (
		<Paper className="flex w-full flex-col overflow-hidden rounded-xl shadow-sm">
			<div className="flex flex-col justify-between p-6 sm:flex-row sm:items-center">
				<div>
					<Typography className="text-2xl font-semibold tracking-tight">Traffic summary</Typography>
					<Typography
						className="mt-1 text-sm"
						color="text.secondary"
					>
						Clicks versus unique visitors on your tracking link
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
					{empty ? (
						<div className="flex h-80 items-center justify-center px-6">
							<Typography
								className="text-center"
								color="text.secondary"
							>
								No clicks yet. Share your tracking link and visits will chart here.
							</Typography>
						</div>
					) : (
						<ReactApexChart
							options={options}
							series={[
								{ name: 'Clicks', type: 'column', data: rows.map((row) => row.clicks) },
								{ name: 'Unique', type: 'line', data: rows.map((row) => row.uniqueClicks) }
							]}
							type="line"
							height={320}
						/>
					)}
				</div>
				<div className="flex flex-col border-divider border-t border-solid lg:w-96 lg:border-t-0 lg:border-l">
					<div className="grid flex-auto grid-cols-2">
						<div className="border-divider border-r border-b border-solid p-3">
							<MiniStat
								large
								label="Clicks"
								value={clicks.toLocaleString()}
								hint={`${uniqueClicks.toLocaleString()} unique visitors`}
							/>
						</div>
						<div className="border-divider border-b border-solid p-3">
							<MiniStat
								large
								label="Signups"
								value={signups.toLocaleString()}
								hint={`${formatRate(signups, uniqueClicks)} of unique`}
							/>
						</div>
						<div className="border-divider border-r border-solid p-3">
							<MiniStat
								label="First deposits"
								value={ftds.toLocaleString()}
								hint={`${formatRate(ftds, signups)} of signups`}
							/>
						</div>
						<div className="p-3">
							<MiniStat
								label="Click → FTD"
								value={formatRate(ftds, uniqueClicks)}
								hint="Unique visitors who deposited"
							/>
						</div>
					</div>
				</div>
			</div>
		</Paper>
	);
}

function FunnelWidget({
	clicks,
	uniqueClicks,
	signups,
	ftds
}: {
	clicks: number;
	uniqueClicks: number;
	signups: number;
	ftds: number;
}) {
	const theme = useTheme();
	const steps = [
		{ label: 'Link clicks', value: clicks, of: clicks, color: theme.palette.secondary.main },
		{ label: 'Unique visitors', value: uniqueClicks, of: clicks, color: theme.palette.info.main },
		{ label: 'Registered', value: signups, of: uniqueClicks, color: theme.palette.warning.main },
		{ label: 'First deposits', value: ftds, of: signups, color: theme.palette.success.main }
	];
	const peak = Math.max(clicks, 1);

	return (
		<Paper className="flex h-full flex-col overflow-hidden rounded-xl shadow-sm">
			<div className="p-6">
				<Typography className="text-2xl font-semibold tracking-tight">Conversion funnel</Typography>
				<Typography
					className="mt-1 text-sm"
					color="text.secondary"
				>
					How tracking-link traffic turns into players
				</Typography>
			</div>
			<div className="flex flex-auto flex-col justify-center gap-5 px-6 pb-8">
				{steps.map((step, index) => (
					<div key={step.label}>
						<div className="mb-2 flex items-baseline justify-between gap-3">
							<Typography className="font-medium">{step.label}</Typography>
							<div className="flex items-baseline gap-2">
								<Typography className="text-lg font-semibold">{step.value.toLocaleString()}</Typography>
								<Typography
									className="text-sm"
									color="text.secondary"
								>
									{index === 0 ? 'all traffic' : formatRate(step.value, step.of)}
								</Typography>
							</div>
						</div>
						<div
							className="h-2.5 overflow-hidden rounded-full"
							style={{ backgroundColor: theme.palette.divider }}
						>
							<div
								className="h-full rounded-full"
								style={{
									width: `${Math.max(step.value ? 6 : 0, (step.value / peak) * 100)}%`,
									backgroundColor: step.color
								}}
							/>
						</div>
					</div>
				))}
			</div>
		</Paper>
	);
}

function ClicksWidget({ clicks }: { clicks: AffiliateClick[] }) {
	return (
		<Paper className="flex h-full flex-col overflow-hidden rounded-xl shadow-sm">
			<div className="flex items-center justify-between p-6">
				<div>
					<Typography className="text-2xl font-semibold tracking-tight">Latest clicks</Typography>
					<Typography
						className="mt-1 text-sm"
						color="text.secondary"
					>
						Unique, refresh, extra tabs, and returning visitors
					</Typography>
				</div>
				<Button
					component={NavLinkAdapter}
					to="/apps/partner/traffic"
					size="small"
					endIcon={<FuseSvgIcon size={16}>lucide:arrow-right</FuseSvgIcon>}
				>
					Traffic
				</Button>
			</div>
			<div className="flex flex-auto flex-col px-3 pb-4">
				{clicks.map((row) => {
					const when = new Date(row.createdAt);
					const visitType = visitTypeOf(row);
					return (
						<div
							key={row.id}
							className="hover:bg-action-hover flex items-start justify-between gap-3 rounded-xl px-3 py-3"
						>
							<div className="min-w-0">
								<div className="flex items-center gap-2">
									<Typography className="font-medium">{landingLabel(row.landingPath)}</Typography>
									<Chip
										size="small"
										variant="outlined"
										color={visitTypeColor(visitType)}
										label={visitTypeLabel(visitType)}
									/>
								</div>
								<Typography
									className="truncate text-sm"
									color="text.secondary"
								>
									{[
										row.source,
										deviceLabel(row),
										locationLabel(row),
										row.visitorLabel,
										visitType !== 'unique' && row.visitNumber
											? `visit ${row.visitNumber}${row.visitorVisits ? ` of ${row.visitorVisits}` : ''}`
											: ''
									]
										.filter((part) => part && part !== '—')
										.join(' · ')}
								</Typography>
							</div>
							<Typography
								className="shrink-0 text-sm"
								color="text.secondary"
							>
								{isToday(when) ? format(when, 'p') : format(when, 'MMM d')}
							</Typography>
						</div>
					);
				})}
				{clicks.length === 0 && (
					<Typography
						className="px-3 py-6"
						color="text.secondary"
					>
						No clicks yet. Share your tracking link to start recording visits.
					</Typography>
				)}
			</div>
		</Paper>
	);
}

function PlayersWidget({ players }: { players: AffiliatePlayer[] }) {
	return (
		<Paper className="flex h-full flex-col overflow-hidden rounded-xl shadow-sm">
			<div className="flex items-center justify-between p-6">
				<div>
					<Typography className="text-2xl font-semibold tracking-tight">Referred players</Typography>
					<Typography
						className="mt-1 text-sm"
						color="text.secondary"
					>
						Accounts attributed to your link
					</Typography>
				</div>
				<Button
					component={NavLinkAdapter}
					to="/apps/partner/players"
					size="small"
					endIcon={<FuseSvgIcon size={16}>lucide:arrow-right</FuseSvgIcon>}
				>
					Players
				</Button>
			</div>
			<div className="flex flex-auto flex-col px-3 pb-4">
				{players.map((player) => (
					<div
						key={player.id}
						className="hover:bg-action-hover flex items-center justify-between gap-3 rounded-xl px-3 py-3"
					>
						<div className="flex min-w-0 items-center gap-3">
							<Avatar className="h-10 w-10 text-sm font-semibold">
								{initials(player.label || player.displayName || player.email)}
							</Avatar>
							<div className="min-w-0">
								<Typography className="truncate font-medium">
									{player.label || player.displayName}
								</Typography>
								<Typography
									className="truncate text-sm"
									color="text.secondary"
								>
									{player.email}
								</Typography>
							</div>
						</div>
						<Chip
							size="small"
							label={player.qualified ? 'First deposit' : 'Registered'}
							color={player.qualified ? 'success' : 'default'}
							variant="outlined"
						/>
					</div>
				))}
				{players.length === 0 && (
					<Typography
						className="px-3 py-6"
						color="text.secondary"
					>
						No attributed signups yet.
					</Typography>
				)}
			</div>
		</Paper>
	);
}

function LinkWidget({
	trackingLink,
	dealType,
	code,
	deal
}: {
	trackingLink: string;
	dealType: string;
	code: string;
	deal: string;
}) {
	return (
		<Paper className="flex h-full flex-col overflow-hidden rounded-xl shadow-sm">
			<div className="p-6">
				<Typography className="text-2xl font-semibold tracking-tight">Your tracking link</Typography>
				<Typography
					className="mt-1 text-sm"
					color="text.secondary"
				>
					Share this URL. New players who register after opening it are attributed to you for 30 days.
				</Typography>
			</div>
			<div className="flex flex-auto flex-col gap-4 px-6 pb-6">
				<div className="border-divider flex items-center gap-2 rounded-xl border border-solid px-4 py-3">
					<Typography className="min-w-0 flex-1 truncate font-medium">{trackingLink}</Typography>
					<Button
						variant="contained"
						color="secondary"
						size="small"
						startIcon={<FuseSvgIcon size={16}>lucide:copy</FuseSvgIcon>}
						onClick={() => {
							void navigator.clipboard.writeText(trackingLink);
							enqueueSnackbar('Link copied', { variant: 'success' });
						}}
					>
						Copy
					</Button>
				</div>
				<div className="flex items-center justify-between">
					<Typography color="text.secondary">Deal</Typography>
					<Chip
						size="small"
						label={dealType}
						color="secondary"
						variant="outlined"
					/>
				</div>
				<div className="flex items-center justify-between gap-4">
					<Typography color="text.secondary">Code</Typography>
					<Typography className="font-semibold">{code}</Typography>
				</div>
				<Typography
					className="text-sm"
					color="text.secondary"
				>
					{deal}
				</Typography>
				<Button
					component={NavLinkAdapter}
					to="/apps/partner/earnings"
					size="small"
					endIcon={<FuseSvgIcon size={16}>lucide:arrow-right</FuseSvgIcon>}
				>
					Earnings history
				</Button>
			</div>
		</Paper>
	);
}

function PartnerPortalView() {
	const { data, isLoading, isError, error, refetch } = useMyAffiliate();

	if (isLoading) {
		return <FuseLoading />;
	}

	if (isError || !data) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4 p-8">
				<Typography variant="h5">Could not load your partner dashboard</Typography>
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

	const deal = dealCopy(data);
	const clicks = data.stats.clicks || 0;
	const uniqueClicks = data.stats.uniqueClicks || 0;
	const refreshClicks = data.stats.refreshClicks || 0;
	const repeatClicks = data.stats.repeatClicks ?? Math.max(0, clicks - uniqueClicks - refreshClicks);
	const recentClicks = data.clicks || [];
	const clickSeries = data.clickSeries || [];
	const name = firstName(data.partner.name);
	const estimated = data.stats.bookedCpa + data.stats.estimatedRevShare;

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
							<Avatar
								className="mr-4 h-16 w-16 text-xl font-semibold"
								sx={(theme) => ({
									background: darken(theme.palette.background.default, 0.06),
									color: theme.palette.text.secondary
								})}
							>
								{data.partner.name?.[0] || 'P'}
							</Avatar>
							<div className="min-w-0">
								<Typography className="text-3xl leading-none font-semibold tracking-tight md:text-4xl">
									Welcome back, {name}!
								</Typography>
								<Typography
									className="mt-2 text-sm md:text-base"
									color="text.secondary"
								>
									{deal}. {uniqueClicks.toLocaleString()} unique visitors and {data.stats.signups}{' '}
									{data.stats.signups === 1 ? 'signup' : 'signups'} so far.
								</Typography>
							</div>
						</div>
						<div className="flex flex-wrap gap-2 sm:shrink-0">
							<Button
								variant="contained"
								className="min-h-10"
								startIcon={<FuseSvgIcon size={18}>lucide:copy</FuseSvgIcon>}
								onClick={() => {
									void navigator.clipboard.writeText(data.partner.trackingLink);
									enqueueSnackbar('Link copied', { variant: 'success' });
								}}
							>
								Copy link
							</Button>
							<Button
								component={NavLinkAdapter}
								to="/apps/partner/earnings"
								variant="contained"
								color="secondary"
								className="min-h-10"
								startIcon={<FuseSvgIcon size={18}>lucide:wallet</FuseSvgIcon>}
							>
								Earnings
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
								title="Link clicks"
								value={clicks.toLocaleString()}
								unit="All hits"
								footer="Unique / repeat / refresh:"
								footerValue={`${uniqueClicks.toLocaleString()} / ${repeatClicks.toLocaleString()} / ${refreshClicks.toLocaleString()}`}
								to="/apps/partner/traffic"
							/>
						</motion.div>
						<motion.div
							variants={item}
							className="flex"
						>
							<SummaryCard
								title="Signups"
								value={data.stats.signups.toLocaleString()}
								unit="Registered players"
								footer="Of unique visitors:"
								footerValue={formatRate(data.stats.signups, uniqueClicks)}
								to="/apps/partner/players"
							/>
						</motion.div>
						<motion.div
							variants={item}
							className="flex"
						>
							<SummaryCard
								title="First deposits"
								value={data.stats.ftds.toLocaleString()}
								unit="Qualified players"
								footer="Of signups:"
								footerValue={formatRate(data.stats.ftds, data.stats.signups)}
								to="/apps/partner/players"
							/>
						</motion.div>
						<motion.div
							variants={item}
							className="flex"
						>
							<SummaryCard
								title="Earnings"
								value={formatMoney(estimated)}
								unit="Estimated"
								footer="Pending:"
								footerValue={formatMoney(data.stats.pending)}
								to="/apps/partner/earnings"
							/>
						</motion.div>
					</motion.div>

					<motion.div
						className="mt-8"
						initial={{ opacity: 0, y: 16 }}
						animate={{ opacity: 1, y: 0, transition: { delay: 0.12 } }}
					>
						<TrafficWidget
							series={clickSeries}
							clicks={clicks}
							uniqueClicks={uniqueClicks}
							signups={data.stats.signups}
							ftds={data.stats.ftds}
						/>
					</motion.div>

					<div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
						<FunnelWidget
							clicks={clicks}
							uniqueClicks={uniqueClicks}
							signups={data.stats.signups}
							ftds={data.stats.ftds}
						/>
						<ClicksWidget clicks={recentClicks.slice(0, 8)} />
					</div>

					<div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
						<PlayersWidget players={(data.players || []).slice(0, 6)} />
						<LinkWidget
							trackingLink={data.partner.trackingLink}
							dealType={data.partner.dealType}
							code={data.partner.code}
							deal={deal}
						/>
					</div>
				</div>
			}
		/>
	);
}

export default PartnerPortalView;
