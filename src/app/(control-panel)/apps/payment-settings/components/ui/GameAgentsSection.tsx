'use client';

import { useEffect, useState } from 'react';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
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
	useGameAgents,
	useTestGameAgent,
	useUpdateGameAgents
} from '@/app/(control-panel)/ops/api/hooks/useGameAgents';
import type { GameAgent, GameAgentInput, GameAgentSource } from '@/app/(control-panel)/ops/api/types';

type AgentDraft = GameAgentInput & {
	hasApiToken: boolean;
	hasClientSecret: boolean;
	countries: string[];
};

const SOURCE_LABELS: Record<GameAgentSource, string> = {
	scorpio: 'Scorpio Play (slots)',
	oroplay: 'Oroplay (live, mini, fishing)'
};

const DEFAULT_BASE_URL: Record<GameAgentSource, string> = {
	scorpio: 'https://api.scorpioplay.com',
	oroplay: ''
};

function toDraft(agent: GameAgent): AgentDraft {
	return {
		id: agent.id,
		label: agent.label,
		source: agent.source,
		currency: agent.currency,
		apiBaseUrl: agent.apiBaseUrl,
		language: agent.language,
		clientId: agent.clientId,
		proxyUrl: agent.proxyUrl,
		enabled: agent.enabled,
		apiToken: '',
		clientSecret: '',
		hasApiToken: agent.hasApiToken,
		hasClientSecret: agent.hasClientSecret,
		countries: agent.countries
	};
}

function emptyAgent(source: GameAgentSource): AgentDraft {
	return {
		label: '',
		source,
		currency: '',
		apiBaseUrl: DEFAULT_BASE_URL[source],
		language: 'en',
		clientId: '',
		proxyUrl: '',
		enabled: true,
		apiToken: '',
		clientSecret: '',
		hasApiToken: false,
		hasClientSecret: false,
		countries: []
	};
}

function toInput(draft: AgentDraft): GameAgentInput {
	return {
		id: draft.id,
		label: draft.label,
		source: draft.source,
		currency: draft.currency.trim().toUpperCase(),
		apiBaseUrl: draft.apiBaseUrl,
		language: draft.language,
		clientId: draft.clientId,
		proxyUrl: draft.proxyUrl,
		enabled: draft.enabled,
		apiToken: draft.apiToken || undefined,
		clientSecret: draft.clientSecret || undefined
	};
}

/**
 * Aggregator accounts per currency. The main domain keeps the SCORPIO_* and
 * OROPLAY_* environment agents; these are assigned to local markets on the
 * Local payments tab.
 */
function GameAgentsSection() {
	const { data: settings, isLoading } = useGameAgents();
	const { mutateAsync: save, isPending: saving } = useUpdateGameAgents();
	const { mutateAsync: test } = useTestGameAgent();
	const [drafts, setDrafts] = useState<AgentDraft[]>([]);
	const [dirty, setDirty] = useState(false);
	const [testing, setTesting] = useState<string | null>(null);

	useEffect(() => {
		if (!settings) return;

		setDrafts(settings.agents.map(toDraft));
		setDirty(false);
	}, [settings]);

	const edit = (index: number, patch: Partial<AgentDraft>) => {
		setDrafts((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
		setDirty(true);
	};

	async function onSave() {
		try {
			await save(drafts.map(toInput));
			enqueueSnackbar('Game agents saved. The player site picks them up within about 15 seconds.', {
				variant: 'success'
			});
		} catch (error) {
			enqueueSnackbar(error instanceof Error ? error.message : 'Could not save game agents', { variant: 'error' });
		}
	}

	async function onTest(id: string) {
		setTesting(id);
		try {
			const result = await test(id);
			enqueueSnackbar(result.message, { variant: result.ok ? 'success' : 'error' });
		} catch (error) {
			enqueueSnackbar(error instanceof Error ? error.message : 'Test failed', { variant: 'error' });
		} finally {
			setTesting(null);
		}
	}

	return (
		<>
			<div className="flex items-center justify-between gap-3">
				<Typography className="text-lg font-semibold">Game agents</Typography>
				<Button
					variant="contained"
					color="secondary"
					size="small"
					disabled={saving || !dirty || isLoading}
					startIcon={<FuseSvgIcon size={16}>lucide:save</FuseSvgIcon>}
					onClick={() => void onSave()}
				>
					{saving ? 'Saving…' : 'Save game agents'}
				</Button>
			</div>
			<Typography
				className="-mt-4 text-sm"
				color="text.secondary"
			>
				One aggregator account per currency. The main domain always plays in USD on the agents set in the
				environment. Assign these to a country on the Local payments tab: once a country has both a Scorpio and
				an Oroplay agent, its subdomain runs in that currency.
			</Typography>

			{settings && !settings.keyConfigured ? (
				<Alert severity="warning">
					Set GAME_AGENT_SECRET_KEY on admin and the player site (the same value on both) before saving
					credentials. It encrypts the tokens and secrets below.
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
						lucide:gamepad-2
					</FuseSvgIcon>
					<Typography className="font-medium">No agents yet</Typography>
					<Typography
						className="text-sm"
						color="text.secondary"
					>
						Add the Scorpio and Oroplay accounts your aggregators opened for each local currency.
					</Typography>
				</Paper>
			) : null}

			{drafts.map((draft, index) => {
				const assigned = draft.countries.length > 0;
				const scorpio = draft.source === 'scorpio';

				return (
					<Paper
						key={draft.id || `new-${index}`}
						className="flex flex-col gap-5 p-5"
						elevation={0}
						variant="outlined"
					>
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div className="flex flex-wrap items-center gap-2">
								<Typography className="text-base font-semibold">
									{draft.label || 'New agent'}
								</Typography>
								<Chip
									size="small"
									variant="outlined"
									label={`${scorpio ? 'Scorpio' : 'Oroplay'}${draft.currency ? ` · ${draft.currency}` : ''}`}
								/>
								{draft.countries.map((country) => (
									<Chip
										key={country}
										size="small"
										color="success"
										icon={<FuseSvgIcon size={14}>lucide:globe</FuseSvgIcon>}
										label={country}
									/>
								))}
							</div>
							<div className="flex items-center gap-1">
								{draft.id ? (
									<Tooltip title={dirty ? 'Save first, then test' : 'Make one read-only call with these credentials'}>
										<span>
											<Button
												size="small"
												disabled={dirty || testing === draft.id}
												onClick={() => void onTest(draft.id as string)}
											>
												{testing === draft.id ? 'Testing…' : 'Test connection'}
											</Button>
										</span>
									</Tooltip>
								) : null}
								<Tooltip title={assigned ? 'Assign another agent to its countries first' : ''}>
									<FormControlLabel
										control={
											<Switch
												size="small"
												checked={draft.enabled}
												disabled={assigned && draft.enabled}
												onChange={(event) => edit(index, { enabled: event.target.checked })}
											/>
										}
										label="Enabled"
									/>
								</Tooltip>
								<Tooltip title={assigned ? 'Assigned to a country' : 'Remove agent'}>
									<span>
										<IconButton
											size="small"
											disabled={assigned}
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

						<div className="grid gap-4 sm:grid-cols-[2fr_2fr_1fr]">
							<TextField
								label="Name"
								value={draft.label}
								placeholder="e.g. Scorpio NGN"
								onChange={(event) => edit(index, { label: event.target.value })}
							/>
							<TextField
								select
								label="Aggregator"
								value={draft.source}
								disabled={assigned}
								onChange={(event) => {
									const source = event.target.value as GameAgentSource;
									edit(index, {
										source,
										apiBaseUrl: draft.apiBaseUrl || DEFAULT_BASE_URL[source]
									});
								}}
							>
								{(Object.keys(SOURCE_LABELS) as GameAgentSource[]).map((source) => (
									<MenuItem
										key={source}
										value={source}
									>
										{SOURCE_LABELS[source]}
									</MenuItem>
								))}
							</TextField>
							<TextField
								label="Currency"
								value={draft.currency}
								placeholder="NGN"
								disabled={assigned}
								helperText={assigned ? 'Fixed while assigned' : ' '}
								onChange={(event) => edit(index, { currency: event.target.value.toUpperCase().slice(0, 3) })}
							/>
						</div>

						<div className="grid gap-4 sm:grid-cols-[3fr_1fr]">
							<TextField
								label="API base URL"
								value={draft.apiBaseUrl}
								onChange={(event) => edit(index, { apiBaseUrl: event.target.value })}
								slotProps={{ htmlInput: { spellCheck: false } }}
							/>
							<TextField
								label="Language"
								value={draft.language}
								onChange={(event) => edit(index, { language: event.target.value })}
							/>
						</div>

						{scorpio ? (
							<TextField
								label="API token"
								type="password"
								value={draft.apiToken}
								placeholder={draft.hasApiToken ? 'Stored — leave blank to keep' : ''}
								helperText="Also signs this agent's wallet callbacks"
								onChange={(event) => edit(index, { apiToken: event.target.value })}
								slotProps={{ htmlInput: { autoComplete: 'new-password', spellCheck: false } }}
							/>
						) : (
							<>
								<div className="grid gap-4 sm:grid-cols-2">
									<TextField
										label="Client id"
										value={draft.clientId}
										onChange={(event) => edit(index, { clientId: event.target.value })}
										slotProps={{ htmlInput: { spellCheck: false, autoComplete: 'off' } }}
									/>
									<TextField
										label="Client secret"
										type="password"
										value={draft.clientSecret}
										placeholder={draft.hasClientSecret ? 'Stored — leave blank to keep' : ''}
										onChange={(event) => edit(index, { clientSecret: event.target.value })}
										slotProps={{ htmlInput: { autoComplete: 'new-password', spellCheck: false } }}
									/>
								</div>
								<TextField
									label="Static-IP proxy"
									value={draft.proxyUrl}
									placeholder="http://user:password@host:port"
									helperText="Oroplay whitelists one IP per agent. Leave blank to call directly."
									onChange={(event) => edit(index, { proxyUrl: event.target.value })}
									slotProps={{ htmlInput: { spellCheck: false, autoComplete: 'off' } }}
								/>
							</>
						)}
					</Paper>
				);
			})}

			<div className="flex gap-2">
				<Button
					variant="outlined"
					startIcon={<FuseSvgIcon size={18}>lucide:plus</FuseSvgIcon>}
					onClick={() => {
						setDrafts((rows) => [...rows, emptyAgent('scorpio')]);
						setDirty(true);
					}}
				>
					Add Scorpio agent
				</Button>
				<Button
					variant="outlined"
					startIcon={<FuseSvgIcon size={18}>lucide:plus</FuseSvgIcon>}
					onClick={() => {
						setDrafts((rows) => [...rows, emptyAgent('oroplay')]);
						setDirty(true);
					}}
				>
					Add Oroplay agent
				</Button>
			</div>
		</>
	);
}

export default GameAgentsSection;
