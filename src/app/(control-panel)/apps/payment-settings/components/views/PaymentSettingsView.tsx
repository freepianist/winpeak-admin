'use client';

import { useEffect, useState } from 'react';
import FuseLoading from '@fuse/core/FuseLoading';
import FusePageCarded from '@fuse/core/FusePageCarded';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { enqueueSnackbar } from 'notistack';
import AdminPageHeader from '@/app/(control-panel)/ops/components/AdminPageHeader';
import ImageUploadField from '@/app/(control-panel)/ops/components/ImageUploadField';
import { usePaymentSettings, useUpdatePaymentSettings } from '@/app/(control-panel)/ops/api/hooks/usePaymentSettings';
import { PAY_CURRENCIES } from '@/lib/payments/currencies';
import LocalPaymentsSection from '../ui/LocalPaymentsSection';
import GameAgentsSection from '../ui/GameAgentsSection';

const walletSchema = z.object({
	payCurrency: z.string(),
	address: z.string(),
	qrImageUrl: z.string(),
	enabled: z.boolean()
});

/** Matches the bounds the route enforces, so a bad figure is caught before saving. */
const minUsd = z
	.number({ message: 'Enter a number' })
	.positive('Enter a figure above zero')
	.max(100_000, 'That looks like a typo rather than a minimum');

const schema = z
	.object({
		manualMode: z.boolean(),
		manualMinDeposit: minUsd,
		manualMinWithdraw: minUsd,
		wallets: z.array(walletSchema)
	})
	.refine(
		(values) => !values.manualMode || values.wallets.some((wallet) => wallet.enabled && wallet.address.trim()),
		{
			message: 'Manual mode needs at least one enabled network with an address',
			path: ['manualMode']
		}
	);

type FormType = z.infer<typeof schema>;

/** Every coin is a row in the form, so an unconfigured one still has a card to fill in. */
function emptyWallets() {
	return PAY_CURRENCIES.map((coin) => ({
		payCurrency: coin.id as string,
		address: '',
		qrImageUrl: '',
		enabled: true
	}));
}

type SettingsTab = 'crypto' | 'local' | 'agents';

const SUBTITLES: Record<SettingsTab, string> = {
	crypto: "Choose whether players pay through NOWPayments or straight into the casino's own wallets",
	local: 'Local markets: bank and e-wallet payments through DAYPGL, and the currency each subdomain runs in',
	agents: 'Scorpio and Oroplay accounts per currency, assigned to local markets'
};

function PaymentSettingsView() {
	const theme = useTheme();
	const [tab, setTab] = useState<SettingsTab>('crypto');
	// Mounted on first visit and kept after, so switching tabs never drops
	// unsaved edits and the live DAYPGL balance lookups only run when wanted.
	const [localOpened, setLocalOpened] = useState(false);
	const [agentsOpened, setAgentsOpened] = useState(false);
	const { data: settings, isLoading } = usePaymentSettings();
	const { mutateAsync: save, isPending: saving } = useUpdatePaymentSettings();

	const { control, handleSubmit, reset, formState } = useForm<FormType>({
		mode: 'onChange',
		resolver: zodResolver(schema),
		defaultValues: {
			manualMode: false,
			manualMinDeposit: 20,
			manualMinWithdraw: 20,
			wallets: emptyWallets()
		}
	});
	// Subscribe before the loading return. Save used to short-circuit on
	// !isDirty, so the first manual-mode toggle never marked the form valid.
	const { isDirty, isValid } = formState;

	useEffect(() => {
		if (!settings) {
			return;
		}

		reset({
			manualMode: settings.manualMode,
			manualMinDeposit: settings.manualMinDeposit,
			manualMinWithdraw: settings.manualMinWithdraw,
			wallets: settings.wallets.map((wallet) => ({
				payCurrency: wallet.payCurrency,
				address: wallet.address,
				qrImageUrl: wallet.qrImageUrl,
				enabled: wallet.enabled
			}))
		});
	}, [settings, reset]);

	const manualMode = useWatch({ control, name: 'manualMode' });
	const wallets = useWatch({ control, name: 'wallets' });
	const configured = (wallets || []).filter((wallet) => wallet.address.trim()).length;

	async function onSave(values: FormType) {
		try {
			await save(values);
			enqueueSnackbar(
				values.manualMode
					? 'Manual mode is on. Deposits and withdrawals now wait for staff.'
					: 'Manual mode is off. Deposits and withdrawals run through NOWPayments.',
				{ variant: 'success' }
			);
		} catch (error) {
			enqueueSnackbar(error instanceof Error ? error.message : 'Could not save payment settings', {
				variant: 'error'
			});
		}
	}

	if (isLoading) {
		return <FuseLoading />;
	}

	return (
		<FusePageCarded
			header={
				<AdminPageHeader
					title="Payment settings"
					subtitle={SUBTITLES[tab]}
					action={
						tab === 'crypto' ? (
							<Button
								variant="contained"
								color="secondary"
								disabled={saving || !isDirty || !isValid}
								startIcon={<FuseSvgIcon size={18}>lucide:save</FuseSvgIcon>}
								onClick={handleSubmit(onSave)}
							>
								{saving ? 'Saving…' : 'Save'}
							</Button>
						) : undefined
					}
				/>
			}
			content={
				<div className="flex w-full flex-col">
					<Tabs
						value={tab}
						onChange={(_, value: SettingsTab) => {
							setTab(value);

							if (value === 'local') setLocalOpened(true);

							if (value === 'agents') setAgentsOpened(true);
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
						<Tab
							value="crypto"
							label="Crypto"
							icon={<FuseSvgIcon size={18}>lucide:bitcoin</FuseSvgIcon>}
							iconPosition="start"
							sx={{ minHeight: 48 }}
						/>
						<Tab
							value="local"
							label="Local payments"
							icon={<FuseSvgIcon size={18}>lucide:landmark</FuseSvgIcon>}
							iconPosition="start"
							sx={{ minHeight: 48 }}
						/>
						<Tab
							value="agents"
							label="Game agents"
							icon={<FuseSvgIcon size={18}>lucide:gamepad-2</FuseSvgIcon>}
							iconPosition="start"
							sx={{ minHeight: 48 }}
						/>
					</Tabs>

					<div
						className={`mx-auto w-full max-w-4xl flex-col gap-6 p-4 sm:p-6 ${tab === 'crypto' ? 'flex' : 'hidden'}`}
					>
						<Paper
							className="flex flex-col gap-3 p-5"
							elevation={0}
							variant="outlined"
						>
							<Controller
								name="manualMode"
								control={control}
								render={({ field, fieldState }) => (
									<>
										<FormControlLabel
											control={
												<Switch
													checked={field.value}
													onChange={(event) => field.onChange(event.target.checked)}
												/>
											}
											label={
												<div className="flex flex-col">
													<Typography className="font-semibold">
														Manual payment mode
													</Typography>
													<Typography
														className="text-sm"
														color="text.secondary"
													>
														Players send crypto to the wallets below and every deposit and
														withdrawal is settled by staff from Wallet requests.
													</Typography>
												</div>
											}
										/>
										{fieldState.error ? (
											<Alert severity="error">{fieldState.error.message}</Alert>
										) : null}
									</>
								)}
							/>
							<Alert severity={manualMode ? 'warning' : 'info'}>
								{manualMode
									? 'No invoice is raised and no payout is sent automatically. Nothing reaches a player balance until you approve it, so check the queue regularly.'
									: 'Deposits are invoiced by NOWPayments and payouts within the automatic limits send themselves. The wallets and minimums below are ignored.'}
							</Alert>
							<div className="grid gap-4 sm:grid-cols-2">
								<Controller
									name="manualMinDeposit"
									control={control}
									render={({ field, fieldState }) => (
										<TextField
											{...field}
											label="Minimum deposit (USD)"
											type="number"
											error={Boolean(fieldState.error)}
											helperText={
												fieldState.error?.message ||
												'The same on every network, since nothing is converted on this rail.'
											}
											slotProps={{ htmlInput: { min: 0, step: 1 } }}
											onChange={(event) => field.onChange(Number(event.target.value))}
											fullWidth
										/>
									)}
								/>
								<Controller
									name="manualMinWithdraw"
									control={control}
									render={({ field, fieldState }) => (
										<TextField
											{...field}
											label="Minimum withdrawal (USD)"
											type="number"
											error={Boolean(fieldState.error)}
											helperText={
												fieldState.error?.message ||
												'Set this high enough that a payout is worth the network fee you pay to send it.'
											}
											slotProps={{ htmlInput: { min: 0, step: 1 } }}
											onChange={(event) => field.onChange(Number(event.target.value))}
											fullWidth
										/>
									)}
								/>
							</div>
							{settings?.updatedBy ? (
								<Typography
									className="text-sm"
									color="text.secondary"
								>
									Last changed by {settings.updatedBy}
								</Typography>
							) : null}
						</Paper>

						<div className="flex items-center justify-between">
							<Typography className="text-lg font-semibold">Receiving wallets</Typography>
							<Chip
								size="small"
								variant="outlined"
								label={`${configured} of ${PAY_CURRENCIES.length} configured`}
							/>
						</div>
						<Typography
							className="-mt-4 text-sm"
							color="text.secondary"
						>
							A network with no address is hidden from the player&apos;s deposit form, so leave the ones
							you do not accept blank.
						</Typography>

						{PAY_CURRENCIES.map((coin, index) => (
							<Paper
								key={coin.id}
								className="flex flex-col gap-4 p-5"
								elevation={0}
								variant="outlined"
							>
								<div className="flex items-center justify-between gap-3">
									<Typography className="font-semibold">{coin.label}</Typography>
									<Controller
										name={`wallets.${index}.enabled`}
										control={control}
										render={({ field }) => (
											<FormControlLabel
												control={
													<Switch
														size="small"
														checked={field.value}
														onChange={(event) => field.onChange(event.target.checked)}
													/>
												}
												label="Accepting"
											/>
										)}
									/>
								</div>
								<div className="grid gap-6 sm:grid-cols-[1fr_auto]">
									<div className="flex flex-col gap-4">
										<Controller
											name={`wallets.${index}.address`}
											control={control}
											render={({ field }) => (
												<TextField
													{...field}
													label="Wallet address"
													placeholder={`Your ${coin.label} receiving address`}
													helperText="Paste this from your own wallet and check it character by character"
													slotProps={{
														htmlInput: { spellCheck: false, autoComplete: 'off' }
													}}
													fullWidth
												/>
											)}
										/>
									</div>
									<Controller
										name={`wallets.${index}.qrImageUrl`}
										control={control}
										render={({ field }) => (
											<ImageUploadField
												label="Address QR code"
												value={field.value}
												folder="payments"
												variant="qr"
												helperText="Scan it yourself before saving"
												onChange={field.onChange}
											/>
										)}
									/>
								</div>
							</Paper>
						))}
					</div>

					{localOpened ? (
						<div
							className={`mx-auto w-full max-w-4xl flex-col gap-6 p-4 sm:p-6 ${tab === 'local' ? 'flex' : 'hidden'}`}
						>
							<LocalPaymentsSection />
						</div>
					) : null}

					{agentsOpened ? (
						<div
							className={`mx-auto w-full max-w-4xl flex-col gap-6 p-4 sm:p-6 ${tab === 'agents' ? 'flex' : 'hidden'}`}
						>
							<GameAgentsSection />
						</div>
					) : null}
				</div>
			}
		/>
	);
}

export default PaymentSettingsView;
