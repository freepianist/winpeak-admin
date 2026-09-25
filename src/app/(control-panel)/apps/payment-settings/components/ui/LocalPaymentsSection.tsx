'use client';

import { useEffect, useMemo, useState } from 'react';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import Alert from '@mui/material/Alert';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { enqueueSnackbar } from 'notistack';
import {
	useLocalPaymentSettings,
	useUpdateLocalPaymentSettings
} from '@/app/(control-panel)/ops/api/hooks/useLocalPaymentSettings';
import { useGameAgents } from '@/app/(control-panel)/ops/api/hooks/useGameAgents';
import type {
	GameAgent,
	GameAgentSource,
	LocalPaymentCountry,
	LocalPaymentSettingsInput,
	WalletRequestType
} from '@/app/(control-panel)/ops/api/types';
import { DAYPGL_CATALOG, type DaypglMethod } from '@/lib/payments/daypgl-catalog';

type ChannelDraft = { kind: WalletRequestType; code: string; label: string; enabled: boolean };

/** Numbers are edited as text so a half-typed figure does not snap back while typing. */
type CountryDraft = {
	country: string;
	currency: string;
	fxRate: string;
	depositSpreadPct: string;
	withdrawSpreadPct: string;
	minDepositUsd: string;
	minWithdrawUsd: string;
	enabled: boolean;
	scorpioAgentId: string;
	oroplayAgentId: string;
	boundUsers: number;
	channels: ChannelDraft[];
};

/** Past this many picks the chips are summarised, or a full bank list buries the form. */
const MAX_CHIPS = 12;

const CATALOG_COUNTRIES = Object.keys(DAYPGL_CATALOG).sort((a, b) =>
	DAYPGL_CATALOG[a].name.localeCompare(DAYPGL_CATALOG[b].name)
);

function flag(country: string) {
	return /^[A-Z]{2}$/.test(country)
		? String.fromCodePoint(...[...country].map((letter) => 0x1f1a5 + letter.charCodeAt(0)))
		: '';
}

function countryLabel(country: string) {
	const entry = DAYPGL_CATALOG[country];
	return entry ? `${flag(country)} ${entry.name} (${country})` : country;
}

/** The player-site subdomain that serves a country, e.g. `https://ng.winpeakgames.com`. */
function marketUrl(siteOrigin: string, country: string) {
	return siteOrigin.replace('://', `://${country.toLowerCase()}.`);
}

function marketHost(siteOrigin: string, country: string) {
	return marketUrl(siteOrigin, country).replace(/^[a-z]+:\/\//, '');
}

function catalogMethods(country: string, kind: WalletRequestType): readonly DaypglMethod[] {
	const entry = DAYPGL_CATALOG[country];

	if (!entry) return [];

	return kind === 'DEPOSIT' ? entry.payin : entry.payout;
}

function channelsFromCatalog(country: string): ChannelDraft[] {
	// Thai deposits need payer bank details the player form does not collect.
	const kinds = country === 'TH' ? (['WITHDRAW'] as const) : (['DEPOSIT', 'WITHDRAW'] as const);
	return kinds.flatMap((kind) =>
		catalogMethods(country, kind).map(([code, label]) => ({ kind, code, label, enabled: true }))
	);
}

function toDraft(row: LocalPaymentCountry): CountryDraft {
	return {
		country: row.country,
		currency: row.currency,
		fxRate: String(row.fxRate),
		depositSpreadPct: String(row.depositSpreadPct),
		withdrawSpreadPct: String(row.withdrawSpreadPct),
		minDepositUsd: String(row.minDepositUsd),
		minWithdrawUsd: String(row.minWithdrawUsd),
		enabled: row.enabled,
		scorpioAgentId: row.scorpioAgentId || '',
		oroplayAgentId: row.oroplayAgentId || '',
		boundUsers: row.boundUsers,
		// Being picked is what enables a method now, so switched-off leftovers are dropped.
		channels: row.channels.filter((channel) => channel.enabled).map((channel) => ({ ...channel }))
	};
}

function emptyCountry(): CountryDraft {
	return {
		country: '',
		currency: '',
		fxRate: '',
		depositSpreadPct: '0',
		withdrawSpreadPct: '0',
		minDepositUsd: '10',
		minWithdrawUsd: '10',
		enabled: false,
		scorpioAgentId: '',
		oroplayAgentId: '',
		boundUsers: 0,
		channels: []
	};
}

/** A market runs in its own currency only once it is on and has an agent for each aggregator. */
function isLive(draft: CountryDraft) {
	return draft.enabled && Boolean(draft.scorpioAgentId && draft.oroplayAgentId);
}

function toInput(drafts: CountryDraft[]): LocalPaymentSettingsInput {
	return {
		countries: drafts.map((draft) => ({
			country: draft.country.trim().toUpperCase(),
			currency: draft.currency.trim().toUpperCase(),
			fxRate: Number(draft.fxRate),
			depositSpreadPct: Number(draft.depositSpreadPct || 0),
			withdrawSpreadPct: Number(draft.withdrawSpreadPct || 0),
			minDepositUsd: Number(draft.minDepositUsd),
			minWithdrawUsd: Number(draft.minWithdrawUsd),
			enabled: draft.enabled,
			scorpioAgentId: draft.scorpioAgentId || null,
			oroplayAgentId: draft.oroplayAgentId || null,
			channels: draft.channels
		}))
	};
}

type AgentSelectProps = {
	source: GameAgentSource;
	currency: string;
	value: string;
	agents: GameAgent[];
	locked: boolean;
	onChange: (id: string) => void;
};

/** Only agents in the country's currency are offered, which is also what the route enforces. */
function AgentSelect(props: AgentSelectProps) {
	const { source, currency, value, agents, locked, onChange } = props;
	const name = source === 'scorpio' ? 'Scorpio' : 'Oroplay';
	const options = agents.filter(
		(agent) =>
			agent.source === source &&
			(agent.id === value || (agent.enabled && agent.currency.toUpperCase() === currency.toUpperCase()))
	);

	return (
		<TextField
			select
			label={`${name} agent`}
			value={value}
			onChange={(event) => onChange(event.target.value)}
			helperText={
				!currency
					? 'Set the currency first'
					: options.length
						? locked
							? 'Accounts play on this agent; swap only for another agent in the same currency'
							: ' '
						: `No ${currency} ${name} agent yet — add one on the Game agents tab`
			}
		>
			<MenuItem
				value=""
				disabled={locked}
			>
				<em>None</em>
			</MenuItem>
			{options.map((agent) => (
				<MenuItem
					key={agent.id}
					value={agent.id}
				>
					{agent.label} · {agent.currency}
				</MenuItem>
			))}
		</TextField>
	);
}

function effectiveRate(draft: CountryDraft, kind: 'deposit' | 'withdraw') {
	const rate = Number(draft.fxRate);
	const spread = Number(kind === 'deposit' ? draft.depositSpreadPct : draft.withdrawSpreadPct) || 0;

	if (!(rate > 0)) return '';

	const value = kind === 'deposit' ? rate * (1 + spread / 100) : rate * (1 - spread / 100);
	return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

type MethodPickerProps = {
	country: string;
	kind: WalletRequestType;
	value: ChannelDraft[];
	onChange: (channels: ChannelDraft[]) => void;
};

/**
 * Multi-select over the methods DAYPGL documents for a country, searchable by
 * name or code. A code that is not listed can still be typed and added with
 * Enter, because DAYPGL enables extra methods per merchant.
 */
function MethodPicker(props: MethodPickerProps) {
	const { country, kind, value, onChange } = props;
	const deposit = kind === 'DEPOSIT';
	const catalog = catalogMethods(country, kind);

	const labels = useMemo(() => {
		const map = new Map<string, string>(catalog.map(([code, label]) => [code, label]));
		value.forEach((channel) => {
			if (!map.has(channel.code)) map.set(channel.code, channel.label || channel.code);
		});
		return map;
	}, [catalog, value]);

	const labelFor = (code: string) => labels.get(code) || code;
	const options = useMemo(() => {
		const listed = catalog.map(([code]) => code);
		return [...listed, ...value.map((channel) => channel.code).filter((code) => !listed.includes(code))];
	}, [catalog, value]);
	const filterOptions = useMemo(
		() => createFilterOptions<string>({ stringify: (code) => `${labels.get(code) || ''} ${code}` }),
		[labels]
	);

	const apply = (codes: string[]) => {
		const unique = [...new Set(codes.map((code) => code.trim()).filter(Boolean))];
		onChange(unique.map((code) => ({ kind, code, label: labelFor(code), enabled: true })));
	};

	const noun = deposit ? 'methods' : 'banks';
	const countryName = DAYPGL_CATALOG[country]?.name || country || 'this country';

	return (
		<div className="flex flex-col gap-1">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<Typography className="font-medium">
					{deposit ? 'Deposit methods' : 'Payout banks & wallets'}
					<Typography
						component="span"
						className="ml-2 text-sm"
						color="text.secondary"
					>
						{value.length} of {catalog.length || value.length} selected
					</Typography>
				</Typography>
				{catalog.length ? (
					<div className="flex gap-1">
						<Button
							size="small"
							disabled={catalog.every(([code]) => value.some((channel) => channel.code === code))}
							onClick={() =>
								apply([...value.map((channel) => channel.code), ...catalog.map(([code]) => code)])
							}
						>
							Select all
						</Button>
						<Button
							size="small"
							color="inherit"
							disabled={!value.length}
							onClick={() => apply([])}
						>
							Clear
						</Button>
					</div>
				) : null}
			</div>
			<Autocomplete<string, true, false, true>
				multiple
				freeSolo
				disableCloseOnSelect
				disabled={!country}
				options={options}
				value={value.map((channel) => channel.code)}
				onChange={(_, codes) => apply(codes)}
				filterOptions={filterOptions}
				getOptionLabel={labelFor}
				renderOption={(optionProps, code, { selected }) => {
					const { key, ...rest } = optionProps;
					const label = labelFor(code);
					return (
						<li
							key={key}
							{...rest}
						>
							<Checkbox
								size="small"
								checked={selected}
								sx={{ mr: 1, p: 0.5 }}
							/>
							<span className="flex-1">{label}</span>
							{label !== code ? (
								<Typography
									className="ml-3 font-mono text-xs"
									color="text.secondary"
								>
									{code}
								</Typography>
							) : null}
						</li>
					);
				}}
				renderValue={(codes, getItemProps) =>
					codes.length > MAX_CHIPS ? (
						<Chip
							size="small"
							color="secondary"
							variant="outlined"
							label={`${codes.length} ${noun} selected — open to change`}
						/>
					) : (
						codes.map((code, index) => {
							const { key, ...itemProps } = getItemProps({ index });
							return (
								<Tooltip
									key={key}
									title={code}
								>
									<Chip
										size="small"
										label={labelFor(code)}
										{...itemProps}
									/>
								</Tooltip>
							);
						})
					)
				}
				renderInput={(params) => (
					<TextField
						{...params}
						size="small"
						placeholder={value.length ? '' : deposit ? 'Search methods…' : 'Search banks…'}
						helperText={
							!country
								? 'Choose a country first'
								: !catalog.length
									? `DAYPGL lists no ${noun} for ${countryName}. Type a ${deposit ? 'trade_type' : 'bank_code'} from your merchant portal and press Enter.`
									: deposit
										? 'Players pick one at checkout. Only methods DAYPGL has switched on for your account will go through.'
										: 'Players pick their own bank from this list when withdrawing. Not listed? Type its bank_code and press Enter.'
						}
					/>
				)}
			/>
		</div>
	);
}

/**
 * Countries and methods for the DAYPGL local rail. Choices come from the
 * DAYPGL docs, so staff pick rather than type codes.
 */
function LocalPaymentsSection() {
	const { data: settings, isLoading } = useLocalPaymentSettings();
	const { mutateAsync: save, isPending: saving } = useUpdateLocalPaymentSettings();
	const { data: agentSettings } = useGameAgents();
	const agents = agentSettings?.agents || [];
	const [drafts, setDrafts] = useState<CountryDraft[]>([]);
	const [dirty, setDirty] = useState(false);

	useEffect(() => {
		if (!settings) return;

		setDrafts(settings.countries.map(toDraft));
		setDirty(false);
	}, [settings]);

	const edit = (index: number, patch: Partial<CountryDraft>) => {
		setDrafts((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
		setDirty(true);
	};

	const chooseCountry = (index: number, country: string) => {
		const entry = DAYPGL_CATALOG[country];
		// Method codes differ per country, so a new country starts from its own
		// documented list rather than keeping the previous one's.
		edit(index, {
			country,
			currency: entry?.currency || drafts[index]?.currency || '',
			fxRate: entry?.currency === 'USD' ? '1' : drafts[index]?.fxRate || '',
			scorpioAgentId: '',
			oroplayAgentId: '',
			channels: channelsFromCatalog(country)
		});
	};

	const setChannels = (index: number, kind: WalletRequestType, channels: ChannelDraft[]) => {
		const current = drafts[index];

		if (!current) return;

		edit(index, { channels: [...current.channels.filter((channel) => channel.kind !== kind), ...channels] });
	};

	async function onSave() {
		try {
			await save(toInput(drafts));
			enqueueSnackbar('Local payment settings saved. Players see changes within about 15 seconds.', {
				variant: 'success'
			});
		} catch (error) {
			enqueueSnackbar(error instanceof Error ? error.message : 'Could not save local payments', {
				variant: 'error'
			});
		}
	}

	const balanceFor = (country: string) => settings?.countries.find((row) => row.country === country);
	const used = new Set(drafts.map((draft) => draft.country));

	return (
		<>
			<div className="flex items-center justify-between gap-3">
				<Typography className="text-lg font-semibold">Local payments (DAYPGL)</Typography>
				<div className="flex items-center gap-2">
					<Chip
						size="small"
						variant="outlined"
						color={settings?.configured ? 'success' : 'warning'}
						label={settings?.configured ? 'Credentials set' : 'Not configured'}
					/>
					<Button
						variant="contained"
						color="secondary"
						size="small"
						disabled={saving || !dirty || isLoading}
						startIcon={<FuseSvgIcon size={16}>lucide:save</FuseSvgIcon>}
						onClick={() => void onSave()}
					>
						{saving ? 'Saving…' : 'Save local payments'}
					</Button>
				</div>
			</div>
			<Typography
				className="-mt-4 text-sm"
				color="text.secondary"
			>
				Once a country is on and has a Scorpio and an Oroplay agent, it goes live: its subdomain runs in the local
				currency, accounts opened there hold that currency for good, and visitors located in the country are sent
				to it. The rate converts to USD for crypto and USD minimums; spreads are taken on local deposits and
				payouts, and on crypto converted to or from the local currency.
			</Typography>

			{!settings?.configured && !isLoading ? (
				<Alert severity="warning">
					Set DAYPGL_GATEWAY_URL, DAYPGL_MERCHANT_ID and DAYPGL_SECRET_KEY on both the player site and admin.
					Until then the local option stays hidden from players.
				</Alert>
			) : null}

			{!drafts.length && !isLoading ? (
				<Paper
					className="flex flex-col items-center gap-2 p-8 text-center"
					elevation={0}
					variant="outlined"
				>
					<FuseSvgIcon
						size={32}
						color="disabled"
					>
						lucide:globe
					</FuseSvgIcon>
					<Typography className="font-medium">No countries yet</Typography>
					<Typography
						className="text-sm"
						color="text.secondary"
					>
						Add a country to offer local bank and e-wallet payments there.
					</Typography>
				</Paper>
			) : null}

			{drafts.map((draft, index) => {
				const live = balanceFor(draft.country);
				const deposits = draft.channels.filter((channel) => channel.kind === 'DEPOSIT');
				const payouts = draft.channels.filter((channel) => channel.kind === 'WITHDRAW');
				const countryOptions =
					draft.country && !DAYPGL_CATALOG[draft.country]
						? [...CATALOG_COUNTRIES, draft.country]
						: CATALOG_COUNTRIES;

				return (
					<Paper
						key={index}
						className="flex flex-col gap-5 p-5"
						elevation={0}
						variant="outlined"
					>
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div className="flex flex-wrap items-center gap-2">
								<Typography className="text-base font-semibold">
									{draft.country ? countryLabel(draft.country) : 'New country'}
								</Typography>
								{settings?.siteOrigin && draft.country ? (
									<Tooltip
										title={
											draft.enabled
												? 'Players on this subdomain see these methods'
												: 'Turn the country on to offer these methods on this subdomain'
										}
									>
										<Chip
											size="small"
											color={draft.enabled ? 'success' : 'default'}
											variant={draft.enabled ? 'filled' : 'outlined'}
											icon={<FuseSvgIcon size={14}>lucide:globe</FuseSvgIcon>}
											label={marketHost(settings.siteOrigin, draft.country)}
											component="a"
											href={`${marketUrl(settings.siteOrigin, draft.country)}/account`}
											target="_blank"
											rel="noopener noreferrer"
											clickable
										/>
									</Tooltip>
								) : null}
								{draft.country ? (
									<Tooltip
										title={
											isLive(draft)
												? `The subdomain runs in ${draft.currency || 'its currency'} on the agents below`
												: 'Turn it on and assign both agents to run the subdomain in its own currency'
										}
									>
										<Chip
											size="small"
											color={isLive(draft) ? 'success' : 'default'}
											variant={isLive(draft) ? 'filled' : 'outlined'}
											label={isLive(draft) ? `Live in ${draft.currency}` : 'Not live'}
										/>
									</Tooltip>
								) : null}
								{draft.boundUsers ? (
									<Tooltip title="Accounts opened on this market. Its currency is locked and it cannot be removed.">
										<Chip
											size="small"
											variant="outlined"
											icon={<FuseSvgIcon size={14}>lucide:users</FuseSvgIcon>}
											label={`${draft.boundUsers.toLocaleString('en-US')} account${draft.boundUsers === 1 ? '' : 's'}`}
										/>
									</Tooltip>
								) : null}
								{live?.balance ? (
									<Chip
										size="small"
										variant="outlined"
										icon={<FuseSvgIcon size={14}>lucide:wallet</FuseSvgIcon>}
										label={`Payout balance ${live.balance.available.toLocaleString('en-US')} ${live.balance.currency || draft.currency}${live.balance.frozen ? ` · ${live.balance.frozen.toLocaleString('en-US')} frozen` : ''}`}
									/>
								) : live?.balanceError ? (
									<Tooltip title={live.balanceError}>
										<Chip
											size="small"
											color="warning"
											variant="outlined"
											label="Balance unavailable"
										/>
									</Tooltip>
								) : null}
							</div>
							<div className="flex items-center gap-1">
								<FormControlLabel
									control={
										<Switch
											size="small"
											checked={draft.enabled}
											onChange={(event) => edit(index, { enabled: event.target.checked })}
										/>
									}
									label="Enabled"
								/>
								<Tooltip title={draft.boundUsers ? 'Has accounts — turn it off instead' : 'Remove country'}>
									<span>
										<IconButton
											size="small"
											disabled={draft.boundUsers > 0}
											onClick={() => {
												setDrafts((rows) => rows.filter((_, i) => i !== index));
												setDirty(true);
											}}
										>
											<FuseSvgIcon size={18}>lucide:trash-2</FuseSvgIcon>
										</IconButton>
									</span>
								</Tooltip>
							</div>
						</div>

						<div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
							<Autocomplete
								options={countryOptions}
								disabled={draft.boundUsers > 0}
								value={draft.country || null}
								onChange={(_, value) => {
									if (value) chooseCountry(index, value);
								}}
								getOptionLabel={countryLabel}
								getOptionDisabled={(code) => used.has(code) && code !== draft.country}
								renderOption={(optionProps, code) => {
									const { key, ...rest } = optionProps;
									const entry = DAYPGL_CATALOG[code];
									return (
										<li
											key={key}
											{...rest}
										>
											<span className="flex-1">{countryLabel(code)}</span>
											{entry ? (
												<Typography
													className="ml-3 text-xs"
													color="text.secondary"
												>
													{entry.currency} · {entry.payin.length} in / {entry.payout.length}{' '}
													out
												</Typography>
											) : null}
										</li>
									);
								}}
								renderInput={(params) => (
									<TextField
										{...params}
										label="Country"
										placeholder="Search countries…"
										helperText={
											draft.country ? ' ' : 'Picking one fills in its currency and methods'
										}
									/>
								)}
							/>
							<TextField
								label="Currency"
								value={draft.currency}
								disabled={draft.boundUsers > 0}
								onChange={(event) =>
									edit(index, {
										currency: event.target.value.toUpperCase().slice(0, 3),
										scorpioAgentId: '',
										oroplayAgentId: ''
									})
								}
								helperText={
									draft.boundUsers
										? 'Locked: accounts hold it'
										: DAYPGL_CATALOG[draft.country] &&
											  draft.currency !== DAYPGL_CATALOG[draft.country].currency
											? `Usually ${DAYPGL_CATALOG[draft.country].currency}`
											: ' '
								}
							/>
							<TextField
								label={`${draft.currency || 'Local'} per 1 USD`}
								type="number"
								value={draft.fxRate}
								onChange={(event) => edit(index, { fxRate: event.target.value })}
								helperText={draft.fxRate ? ' ' : 'Today’s market rate'}
								slotProps={{ htmlInput: { min: 0, step: 'any' } }}
							/>
						</div>

						<div className="grid gap-4 sm:grid-cols-2">
							<AgentSelect
								source="scorpio"
								currency={draft.currency}
								value={draft.scorpioAgentId}
								agents={agents}
								locked={draft.boundUsers > 0}
								onChange={(id) => edit(index, { scorpioAgentId: id })}
							/>
							<AgentSelect
								source="oroplay"
								currency={draft.currency}
								value={draft.oroplayAgentId}
								agents={agents}
								locked={draft.boundUsers > 0}
								onChange={(id) => edit(index, { oroplayAgentId: id })}
							/>
						</div>

						<div className="grid gap-4 sm:grid-cols-4">
							<TextField
								label="Deposit spread"
								type="number"
								value={draft.depositSpreadPct}
								onChange={(event) => edit(index, { depositSpreadPct: event.target.value })}
								helperText={
									effectiveRate(draft, 'deposit')
										? `Player pays ${effectiveRate(draft, 'deposit')} / USD`
										: ' '
								}
								slotProps={{
									htmlInput: { min: 0, max: 20, step: 0.1 },
									input: { endAdornment: <span className="text-sm opacity-60">%</span> }
								}}
							/>
							<TextField
								label="Payout spread"
								type="number"
								value={draft.withdrawSpreadPct}
								onChange={(event) => edit(index, { withdrawSpreadPct: event.target.value })}
								helperText={
									effectiveRate(draft, 'withdraw')
										? `Player gets ${effectiveRate(draft, 'withdraw')} / USD`
										: ' '
								}
								slotProps={{
									htmlInput: { min: 0, max: 20, step: 0.1 },
									input: { endAdornment: <span className="text-sm opacity-60">%</span> }
								}}
							/>
							<TextField
								label="Min deposit"
								type="number"
								value={draft.minDepositUsd}
								onChange={(event) => edit(index, { minDepositUsd: event.target.value })}
								helperText=" "
								slotProps={{
									htmlInput: { min: 0, step: 1 },
									input: { startAdornment: <span className="mr-1 text-sm opacity-60">$</span> }
								}}
							/>
							<TextField
								label="Min payout"
								type="number"
								value={draft.minWithdrawUsd}
								onChange={(event) => edit(index, { minWithdrawUsd: event.target.value })}
								helperText=" "
								slotProps={{
									htmlInput: { min: 0, step: 1 },
									input: { startAdornment: <span className="mr-1 text-sm opacity-60">$</span> }
								}}
							/>
						</div>

						{draft.country === 'TH' ? (
							<Alert severity="warning">
								Thai deposits need the payer&apos;s bank details, which the deposit form does not
								collect yet, so only payouts are selected. Leave the deposit methods empty.
							</Alert>
						) : null}

						<MethodPicker
							country={draft.country}
							kind="DEPOSIT"
							value={deposits}
							onChange={(channels) => setChannels(index, 'DEPOSIT', channels)}
						/>
						<MethodPicker
							country={draft.country}
							kind="WITHDRAW"
							value={payouts}
							onChange={(channels) => setChannels(index, 'WITHDRAW', channels)}
						/>
					</Paper>
				);
			})}

			<div>
				<Button
					variant="outlined"
					startIcon={<FuseSvgIcon size={18}>lucide:plus</FuseSvgIcon>}
					onClick={() => {
						setDrafts((rows) => [...rows, emptyCountry()]);
						setDirty(true);
					}}
				>
					Add country
				</Button>
			</div>
		</>
	);
}

export default LocalPaymentsSection;
