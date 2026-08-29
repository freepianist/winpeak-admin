'use client';

import { useMemo, useState } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import FuseLoading from '@fuse/core/FuseLoading';
import FusePageCarded from '@fuse/core/FusePageCarded';
import { styled } from '@mui/material/styles';
import Alert from '@mui/material/Alert';
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
import { useInviteStaff, useStaff, useUpdateStaff } from '@/app/(control-panel)/ops/api/hooks/useAffiliates';
import type { StaffMember } from '@/app/(control-panel)/ops/api/types';
import { statusLabel } from '@/lib/status-label';

const Root = styled(FusePageCarded)(() => ({
	'& .container': {
		maxWidth: '100%!important'
	}
}));

function ManagersView() {
	const { data: staff = [], isLoading } = useStaff();
	const invite = useInviteStaff();
	const update = useUpdateStaff();
	const [open, setOpen] = useState(false);
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [created, setCreated] = useState<StaffMember | null>(null);

	const columns = useMemo<MRT_ColumnDef<StaffMember>[]>(
		() => [
			{
				accessorKey: 'name',
				header: 'Manager',
				Cell: ({ row }) => (
					<div>
						<Typography className="font-medium">{row.original.name}</Typography>
						<Typography
							className="text-sm"
							color="text.secondary"
						>
							{row.original.email}
						</Typography>
					</div>
				)
			},
			{
				accessorKey: 'status',
				header: 'Status',
				Cell: ({ row }) => (
					<Chip
						size="small"
						label={statusLabel(row.original.status)}
						color={row.original.status === 'ACTIVE' ? 'success' : 'default'}
						variant="outlined"
					/>
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
						disabled={update.isPending}
						onClick={() =>
							void update.mutateAsync({
								id: row.original.id,
								status: row.original.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
							})
						}
					>
						{row.original.status === 'ACTIVE' ? 'Disable' : 'Enable'}
					</Button>
				)
			}
		],
		[update.isPending]
	);

	async function handleInvite() {
		const manager = await invite.mutateAsync({
			name,
			email,
			password: password || undefined
		});
		setCreated(manager);
	}

	if (isLoading) {
		return <FuseLoading />;
	}

	return (
		<Root
			header={
				<AdminPageHeader
					title="Affiliate managers"
					subtitle="They can manage partners and review invited, qualified, and expected income"
					action={
						<Button
							variant="contained"
							color="secondary"
							startIcon={<FuseSvgIcon>lucide:plus</FuseSvgIcon>}
							onClick={() => {
								setCreated(null);
								setName('');
								setEmail('');
								setPassword('');
								setOpen(true);
							}}
						>
							Add manager
						</Button>
					}
				/>
			}
			content={
				<Paper
					className="flex min-w-0 w-full flex-col rounded-b-none"
					elevation={2}
				>
					<DataTable
						data={staff}
						columns={columns}
						enableRowActions={false}
						enableRowSelection={false}
					/>
					<Dialog
						open={open}
						onClose={() => setOpen(false)}
						fullWidth
						maxWidth="sm"
					>
						<DialogTitle>{created ? 'Manager created' : 'Add affiliate manager'}</DialogTitle>
						<DialogContent className="flex flex-col gap-4 pt-2">
							{created ? (
								<>
									<Alert severity="success">Share these credentials once. They sign in to the affiliate console.</Alert>
									<TextField
										label="Email"
										value={created.email}
										fullWidth
										slotProps={{ input: { readOnly: true } }}
									/>
									<TextField
										label="Temporary password"
										value={created.temporaryPassword || ''}
										fullWidth
										slotProps={{ input: { readOnly: true } }}
									/>
								</>
							) : (
								<>
									<TextField
										label="Name"
										value={name}
										onChange={(event) => setName(event.target.value)}
										fullWidth
									/>
									<TextField
										label="Email"
										type="email"
										value={email}
										onChange={(event) => setEmail(event.target.value)}
										fullWidth
									/>
									<TextField
										label="Password (optional)"
										helperText="Leave blank to generate one"
										value={password}
										onChange={(event) => setPassword(event.target.value)}
										fullWidth
									/>
									{invite.isError && (
										<Alert severity="error">
											{invite.error instanceof Error ? invite.error.message : 'Could not create manager'}
										</Alert>
									)}
								</>
							)}
						</DialogContent>
						<DialogActions>
							<Button onClick={() => setOpen(false)}>{created ? 'Done' : 'Cancel'}</Button>
							{!created && (
								<Button
									variant="contained"
									color="secondary"
									onClick={() => void handleInvite()}
									disabled={invite.isPending || !name || !email}
								>
									Create
								</Button>
							)}
						</DialogActions>
					</Dialog>
				</Paper>
			}
		/>
	);
}

export default ManagersView;
