'use client';

import { useMemo, useState } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import FuseLoading from '@fuse/core/FuseLoading';
import FusePageCarded from '@fuse/core/FusePageCarded';
import { styled } from '@mui/material/styles';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import { format } from 'date-fns';
import AdminPageHeader from '@/app/(control-panel)/ops/components/AdminPageHeader';
import {
	useAddBlockedCountry,
	useBlockedCountries,
	useRemoveBlockedCountry
} from '@/app/(control-panel)/ops/api/hooks/useBlockedCountries';
import type { BlockedCountry } from '@/app/(control-panel)/ops/api/types';
import { COUNTRY_OPTIONS } from '@/lib/countries';

const Root = styled(FusePageCarded)(() => ({
	'& .container': {
		maxWidth: '100%!important'
	}
}));

function BlockedCountriesView() {
	const { data: countries = [], isLoading } = useBlockedCountries();
	const addCountry = useAddBlockedCountry();
	const removeCountry = useRemoveBlockedCountry();
	const [open, setOpen] = useState(false);
	const [inputValue, setInputValue] = useState('');
	const [note, setNote] = useState('');

	const blockedCodes = useMemo(() => new Set(countries.map((row) => row.code)), [countries]);
	const options = useMemo(
		() => COUNTRY_OPTIONS.filter((option) => !blockedCodes.has(option.code)),
		[blockedCodes]
	);

	const columns = useMemo<MRT_ColumnDef<BlockedCountry>[]>(
		() => [
			{
				accessorKey: 'code',
				header: 'Code',
				size: 88,
				Cell: ({ cell }) => (
					<Chip
						size="small"
						label={cell.getValue<string>()}
						variant="outlined"
					/>
				)
			},
			{
				accessorKey: 'name',
				header: 'Country',
				Cell: ({ row }) => (
					<div>
						<Typography className="font-medium">{row.original.name || row.original.code}</Typography>
						{row.original.note && row.original.note !== row.original.name ? (
							<Typography
								className="text-sm"
								color="text.secondary"
							>
								{row.original.note}
							</Typography>
						) : null}
					</div>
				)
			},
			{
				accessorKey: 'createdAt',
				header: 'Added',
				Cell: ({ cell }) => format(new Date(cell.getValue<string>()), 'MMM d, yyyy')
			},
			{
				id: 'actions',
				header: '',
				enableSorting: false,
				Cell: ({ row }) => (
					<Button
						size="small"
						color="secondary"
						disabled={removeCountry.isPending}
						onClick={() => void removeCountry.mutateAsync(row.original.code)}
					>
						Allow
					</Button>
				)
			}
		],
		[removeCountry.isPending]
	);

	function resolveCode() {
		const typed = inputValue.trim();
		const match = COUNTRY_OPTIONS.find(
			(option) =>
				option.code === typed.toUpperCase() ||
				option.name.toLowerCase() === typed.toLowerCase() ||
				option.label.toLowerCase() === typed.toLowerCase()
		);
		return match?.code || typed;
	}

	async function handleAdd() {
		await addCountry.mutateAsync({
			code: resolveCode(),
			note: note || undefined
		});
		setOpen(false);
		setInputValue('');
		setNote('');
	}

	if (isLoading) {
		return <FuseLoading />;
	}

	return (
		<Root
			header={
				<AdminPageHeader
					title="Blocked countries"
					subtitle="Players connecting from these countries cannot sign up, play, or move funds"
					action={
						<Button
							variant="contained"
							color="secondary"
							startIcon={<FuseSvgIcon>lucide:plus</FuseSvgIcon>}
							onClick={() => {
								setInputValue('');
								setNote('');
								addCountry.reset();
								setOpen(true);
							}}
						>
							Block country
						</Button>
					}
				/>
			}
			content={
				<Paper
					className="flex min-w-0 w-full flex-col rounded-b-none"
					elevation={0}
				>
					{countries.length === 0 ? (
						<div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
							<div className="bg-secondary/10 text-secondary flex h-14 w-14 items-center justify-center rounded-2xl">
								<FuseSvgIcon size={28}>lucide:globe</FuseSvgIcon>
							</div>
							<Typography className="text-lg font-semibold">All countries are allowed</Typography>
							<Typography
								className="max-w-md text-sm"
								color="text.secondary"
							>
								Block a country when you need to stop sign-up, play, or wallet transfers from that
								region.
							</Typography>
							<Button
								variant="contained"
								color="secondary"
								startIcon={<FuseSvgIcon>lucide:plus</FuseSvgIcon>}
								onClick={() => {
									setInputValue('');
									setNote('');
									addCountry.reset();
									setOpen(true);
								}}
							>
								Block country
							</Button>
						</div>
					) : (
						<DataTable
							data={countries}
							columns={columns}
							enableRowActions={false}
							enableRowSelection={false}
						/>
					)}
					<Dialog
						open={open}
						onClose={() => setOpen(false)}
						fullWidth
						maxWidth="sm"
						slotProps={{
							paper: { sx: { overflow: 'visible' } }
						}}
					>
						<DialogTitle className="text-xl font-semibold">Block a country</DialogTitle>
						<DialogContent
							className="flex flex-col gap-4 pt-2"
							sx={{ overflow: 'visible' }}
						>
							<Typography
								className="text-sm"
								color="text.secondary"
							>
								Country is detected from the player&apos;s connecting IP via the
								host geo header (Vercel or Cloudflare).
							</Typography>
							<Autocomplete
								disablePortal
								freeSolo
								options={options}
								inputValue={inputValue}
								getOptionLabel={(option) =>
									typeof option === 'string' ? option.toUpperCase() : option.label
								}
								slotProps={{
									popper: {
										sx: { zIndex: (theme) => theme.zIndex.modal + 1 }
									}
								}}
								onChange={(_event, value) => {
									if (typeof value === 'string') {
										setInputValue(value);
										return;
									}

									setInputValue(value?.code || '');
									if (value?.name && !note) {
										setNote(value.name);
									}
								}}
								onInputChange={(_event, value) => setInputValue(value)}
								renderInput={(params) => (
									<TextField
										{...params}
										autoFocus
										label="Country"
										placeholder="US or United States"
										helperText="ISO-2 code or search by name"
									/>
								)}
							/>
							<TextField
								label="Note"
								value={note}
								onChange={(event) => setNote(event.target.value)}
							/>
							{addCountry.isError ? (
								<Alert severity="error">{addCountry.error.message}</Alert>
							) : null}
						</DialogContent>
						<DialogActions>
							<Button onClick={() => setOpen(false)}>Cancel</Button>
							<Button
								variant="contained"
								color="secondary"
								disabled={!inputValue.trim() || addCountry.isPending}
								onClick={() => void handleAdd()}
							>
								Block
							</Button>
						</DialogActions>
					</Dialog>
				</Paper>
			}
		/>
	);
}

export default BlockedCountriesView;
