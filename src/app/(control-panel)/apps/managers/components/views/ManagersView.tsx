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
import MenuItem from '@mui/material/MenuItem';
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

const ROLES = [
	{ value: 'AFFILIATE_MANAGER', label: 'Affiliate manager', hint: 'Partners, commissions and payouts' },
	{ value: 'SUPPORT_AGENT', label: 'Support agent', hint: 'Live chat only, no access to player or money tools' }
];

function roleLabel(value: string) {
	return ROLES.find((role) => role.value === value)?.label || value;
}

function ManagersView() {
	const { data: staff = [], isLoading } = useStaff();
	const invite = useInviteStaff();
	const update = useUpdateStaff();
	const [open, setOpen] = useState(false);
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [role, setRole] = useState('AFFILIATE_MANAGER');
	const [created, setCreated] = useState<StaffMember | null>(null);

	const columns = useMemo<MRT_ColumnDef<StaffMember>[]>(
		() => [
			{
				accessorKey: 'name',
				header: 'Name',
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
				accessorKey: 'role',
				header: 'Role',
				Cell: ({ row }) => (
					<Chip
						size="small"
						label={roleLabel(row.original.role)}
						variant="outlined"
					/>
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
			password: password || undefined,
			role
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
					title="Staff"
					subtitle="Affiliate managers handle partners and payouts; support agents answer live chat"
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
								setRole('AFFILIATE_MANAGER');
								setOpen(true);
							}}
						>
							Add staff
						</Button>
					}
				/>
			}
			content={
				<Paper
					className="flex w-full min-w-0 flex-col rounded-b-none"
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
						<DialogTitle>{created ? 'Staff account created' : 'Add staff'}</DialogTitle>
						<DialogContent className="flex flex-col gap-4 pt-2">
							{created ? (
								<>
									<Alert severity="success">
										Share these credentials once. They sign in to this control panel as a{' '}
										{roleLabel(created.role).toLowerCase()}.
									</Alert>
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
										label="Role"
										select
										value={role}
										onChange={(event) => setRole(event.target.value)}
										helperText={ROLES.find((option) => option.value === role)?.hint}
										fullWidth
									>
										{ROLES.map((option) => (
											<MenuItem
												key={option.value}
												value={option.value}
											>
												{option.label}
											</MenuItem>
										))}
									</TextField>
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
											{invite.error instanceof Error
												? invite.error.message
												: 'Could not create the staff account'}
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
