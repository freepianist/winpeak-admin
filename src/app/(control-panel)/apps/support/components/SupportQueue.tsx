'use client';

import Avatar from '@mui/material/Avatar';
import Badge from '@mui/material/Badge';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import { formatDistanceToNowStrict } from 'date-fns';
import type { SupportConversation } from '@/app/(control-panel)/ops/api/types';
import { STATUS_COLOR, STATUS_LABEL, activeFilter, statusColor } from './status';

type SupportQueueProps = {
	conversations: SupportConversation[];
	selectedId: string;
	filter: string;
	refreshing: boolean;
	onSelect: (id: string) => void;
};

/** Who spoke last, so the preview reads like a transcript rather than a stray line. */
function previewPrefix(conversation: SupportConversation) {
	switch (conversation.previewAuthor) {
		case 'BOT':
			return 'Bot: ';
		case 'AGENT':
			return `${conversation.assignedStaffName || 'Agent'}: `;
		default:
			return '';
	}
}

function SupportQueue(props: SupportQueueProps) {
	const { conversations, selectedId, filter, refreshing, onSelect } = props;
	const active = activeFilter(filter);

	return (
		<div className="flex h-full min-h-0 w-full flex-col">
			{/* h-14 matches the thread header, and the icon plus same-size title mirror
			    the avatar and visitor name opposite it. */}
			<div className="relative flex h-14 shrink-0 items-center gap-2 border-b px-4">
				<FuseSvgIcon
					size={20}
					color="action"
				>
					{active.icon}
				</FuseSvgIcon>
				<Typography className="font-semibold">{active.label}</Typography>
				<Chip
					size="small"
					label={conversations.length}
					sx={{ height: 20, minWidth: 28, fontSize: 11, fontWeight: 600 }}
					className="ml-auto"
				/>

				{/* Polling keeps the list warm, so progress rides the divider as a
				    hairline rather than swapping the queue out for a spinner. */}
				{refreshing && (
					<LinearProgress
						className="absolute inset-x-0 bottom-0"
						sx={{ height: 2 }}
					/>
				)}
			</div>

			{conversations.length === 0 ? (
				<div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
					<FuseSvgIcon
						size={32}
						className="opacity-40"
					>
						lucide:message-square-dashed
					</FuseSvgIcon>
					<Typography
						className="text-sm"
						color="text.secondary"
					>
						Nothing here right now.
					</Typography>
				</div>
			) : (
				<List
					disablePadding
					className="min-h-0 flex-1 overflow-y-auto"
				>
					{conversations.map((conversation) => {
						const unread = conversation.unreadForAgent > 0;

						return (
							<ListItemButton
								key={conversation.id}
								selected={conversation.id === selectedId}
								onClick={() => onSelect(conversation.id)}
								sx={(theme) => ({
									alignItems: 'flex-start',
									gap: 1.5,
									px: 2,
									py: 1.5,
									borderBottom: `1px solid ${theme.palette.divider}`,
									borderLeft: '3px solid transparent',
									'&.Mui-selected': {
										borderLeftColor: theme.palette.primary.main,
										backgroundColor: alpha(theme.palette.primary.main, 0.08),
										'&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.12) }
									}
								})}
							>
								<Badge
									color="error"
									variant="dot"
									overlap="circular"
									invisible={!unread}
									anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
								>
									<Avatar
										sx={(theme) => {
											const color = statusColor(theme, conversation.status);
											return {
												width: 36,
												height: 36,
												fontSize: 14,
												fontWeight: 700,
												color,
												backgroundColor: alpha(color, 0.16)
											};
										}}
									>
										{conversation.name.trim().charAt(0).toUpperCase() || '?'}
									</Avatar>
								</Badge>

								<div className="flex min-w-0 flex-1 flex-col gap-1">
									<div className="flex w-full items-baseline gap-2">
										<Typography
											className={`truncate text-sm ${unread ? 'font-bold' : 'font-medium'}`}
										>
											{conversation.name}
										</Typography>
										<Typography
											className="ml-auto shrink-0 text-xs whitespace-nowrap"
											color="text.secondary"
										>
											{formatDistanceToNowStrict(new Date(conversation.lastMessageAt), {
												addSuffix: true
											})}
										</Typography>
									</div>

									<Typography
										className="line-clamp-2 w-full text-xs leading-relaxed"
										color="text.secondary"
									>
										{conversation.preview
											? `${previewPrefix(conversation)}${conversation.preview}`
											: 'No messages yet'}
									</Typography>

									<div className="mt-0.5 flex flex-wrap items-center gap-1">
										<Chip
											size="small"
											variant="outlined"
											label={STATUS_LABEL[conversation.status]}
											color={STATUS_COLOR[conversation.status]}
											sx={{ height: 20, fontSize: 10, fontWeight: 600 }}
										/>
										{conversation.isGuest && (
											<Chip
												size="small"
												variant="outlined"
												label="Guest"
												sx={{ height: 20, fontSize: 10 }}
											/>
										)}
										{conversation.assignedStaffName && (
											<Chip
												size="small"
												variant="outlined"
												label={conversation.assignedStaffName}
												sx={{ height: 20, fontSize: 10 }}
											/>
										)}
									</div>
								</div>
							</ListItemButton>
						);
					})}
				</List>
			)}
		</div>
	);
}

export default SupportQueue;
