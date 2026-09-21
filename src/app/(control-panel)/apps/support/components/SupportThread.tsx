'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import FuseLoading from '@fuse/core/FuseLoading';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import { format, isSameDay, isToday, isYesterday } from 'date-fns';
import {
	useSendSupportReply,
	useSupportThread,
	useUpdateSupportConversation
} from '@/app/(control-panel)/ops/api/hooks/useSupport';
import type { SupportAction, SupportMessage } from '@/app/(control-panel)/ops/api/types';
import { STATUS_COLOR, STATUS_LABEL, statusColor } from './status';

type SupportThreadProps = {
	conversationId: string;
	onDelete: (id: string) => void;
};

function dayLabel(date: Date) {
	if (isToday(date)) {
		return 'Today';
	}

	if (isYesterday(date)) {
		return 'Yesterday';
	}

	return format(date, 'EEEE, MMM d');
}

function SupportThread(props: SupportThreadProps) {
	const { conversationId, onDelete } = props;
	const { data: thread, isLoading } = useSupportThread(conversationId);
	const sendReply = useSendSupportReply(conversationId);
	const updateConversation = useUpdateSupportConversation();
	const [draft, setDraft] = useState('');
	const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
	const scrollRef = useRef<HTMLDivElement | null>(null);

	// Reset the composer when the agent switches threads, so a half-typed reply
	// cannot be sent to the wrong visitor.
	useEffect(() => {
		setDraft('');
	}, [conversationId]);

	useEffect(() => {
		const node = scrollRef.current;

		if (node) {
			node.scrollTop = node.scrollHeight;
		}
	}, [thread?.messages.length]);

	if (isLoading || !thread) {
		return <FuseLoading />;
	}

	const submit = () => {
		const body = draft.trim();

		if (!body || sendReply.isPending) {
			return;
		}

		setDraft('');
		sendReply.mutate(body);
	};

	const act = (action: SupportAction) => {
		setMenuAnchor(null);
		updateConversation.mutate({ id: conversationId, action });
	};

	const claimed = thread.status === 'AGENT';
	const closed = thread.status === 'RESOLVED';

	return (
		<div className="flex h-full min-h-0 w-full flex-col">
			{/* h-14 matches the queue header so the two panes share one rule across. */}
			<header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
				<Avatar
					sx={(theme) => {
						const color = statusColor(theme, thread.status);
						return {
							width: 38,
							height: 38,
							fontSize: 15,
							fontWeight: 700,
							color,
							backgroundColor: alpha(color, 0.16)
						};
					}}
				>
					{thread.name.trim().charAt(0).toUpperCase() || '?'}
				</Avatar>

				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<Typography className="truncate font-semibold">{thread.name}</Typography>
						<Chip
							size="small"
							variant="outlined"
							label={STATUS_LABEL[thread.status]}
							color={STATUS_COLOR[thread.status]}
							sx={{ height: 20, fontSize: 10, fontWeight: 600 }}
						/>
					</div>
					<Typography
						className="truncate text-xs"
						color="text.secondary"
					>
						{thread.email || 'No email on file'}
						{thread.player
							? ` · player since ${format(new Date(thread.player.createdAt), 'MMM yyyy')}`
							: ' · guest'}
					</Typography>
				</div>

				{/* One contextual primary action keeps the header on a single line; the
				    rarer transitions live in the overflow so nothing wraps. */}
				{!claimed && !closed && (
					<Button
						size="small"
						variant="contained"
						startIcon={<FuseSvgIcon size={16}>lucide:hand</FuseSvgIcon>}
						onClick={() => act('claim')}
					>
						Claim
					</Button>
				)}
				{claimed && (
					<Button
						size="small"
						variant="contained"
						color="success"
						startIcon={<FuseSvgIcon size={16}>lucide:check</FuseSvgIcon>}
						onClick={() => act('resolve')}
					>
						Resolve
					</Button>
				)}
				{closed && (
					<Button
						size="small"
						variant="outlined"
						startIcon={<FuseSvgIcon size={16}>lucide:rotate-ccw</FuseSvgIcon>}
						onClick={() => act('reopen')}
					>
						Reopen
					</Button>
				)}

				<Tooltip title="More actions">
					<IconButton
						size="small"
						onClick={(event) => setMenuAnchor(event.currentTarget)}
						aria-label="More actions"
					>
						<FuseSvgIcon size={18}>lucide:ellipsis-vertical</FuseSvgIcon>
					</IconButton>
				</Tooltip>

				<Menu
					anchorEl={menuAnchor}
					open={Boolean(menuAnchor)}
					onClose={() => setMenuAnchor(null)}
				>
					{claimed && (
						<MenuItem onClick={() => act('release')}>
							<ListItemIcon>
								<FuseSvgIcon size={18}>lucide:undo-2</FuseSvgIcon>
							</ListItemIcon>
							Release back to queue
						</MenuItem>
					)}
					{!claimed && !closed && (
						<MenuItem onClick={() => act('resolve')}>
							<ListItemIcon>
								<FuseSvgIcon size={18}>lucide:check</FuseSvgIcon>
							</ListItemIcon>
							Resolve without replying
						</MenuItem>
					)}
					<Divider />
					<MenuItem
						onClick={() => {
							setMenuAnchor(null);
							onDelete(conversationId);
						}}
					>
						<ListItemIcon>
							<FuseSvgIcon
								size={18}
								color="error"
							>
								lucide:trash
							</FuseSvgIcon>
						</ListItemIcon>
						<Typography color="error">Delete conversation</Typography>
					</MenuItem>
				</Menu>
			</header>

			{(thread.handoffReason || (thread.player && thread.player.status !== 'ACTIVE')) && (
				<div className="flex shrink-0 flex-col gap-2 px-4 pt-3">
					{thread.handoffReason && (
						<Alert
							severity="info"
							variant="outlined"
							className="py-0.5 text-xs"
						>
							Escalated: {thread.handoffReason}
						</Alert>
					)}
					{thread.player && thread.player.status !== 'ACTIVE' && (
						<Alert
							severity="warning"
							variant="outlined"
							className="py-0.5 text-xs"
						>
							This player&apos;s account is {thread.player.status.toLowerCase()}.
						</Alert>
					)}
				</div>
			)}

			<Box
				ref={scrollRef}
				sx={(theme) => ({
					backgroundColor:
						theme.palette.mode === 'light'
							? theme.palette.grey[50]
							: alpha(theme.palette.common.black, 0.18)
				})}
				className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4"
			>
				{thread.messages.map((message, index) => {
					const sentAt = new Date(message.createdAt);
					const previous = thread.messages[index - 1];
					const newDay = !previous || !isSameDay(new Date(previous.createdAt), sentAt);

					return (
						<Fragment key={message.id}>
							{newDay && (
								<Divider className="my-2">
									<Typography
										className="text-[11px] font-medium"
										color="text.secondary"
									>
										{dayLabel(sentAt)}
									</Typography>
								</Divider>
							)}

							{message.author === 'SYSTEM' ? (
								<Typography
									className="self-center px-4 py-1 text-center text-xs italic"
									color="text.secondary"
								>
									{message.body}
								</Typography>
							) : (
								<MessageBubble
									message={message}
									visitorName={thread.name}
									sentAt={sentAt}
								/>
							)}
						</Fragment>
					);
				})}
			</Box>

			{closed ? (
				<div className="flex shrink-0 items-center justify-center gap-2 border-t p-4">
					<FuseSvgIcon
						size={16}
						className="opacity-50"
					>
						lucide:lock
					</FuseSvgIcon>
					<Typography
						className="text-sm"
						color="text.secondary"
					>
						This conversation is closed. Reopen it to reply.
					</Typography>
				</div>
			) : (
				<div className="flex shrink-0 items-end gap-2 border-t p-3">
					<TextField
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === 'Enter' && !event.shiftKey) {
								event.preventDefault();
								submit();
							}
						}}
						placeholder="Reply to the visitor…"
						size="small"
						fullWidth
						multiline
						maxRows={6}
						slotProps={{ htmlInput: { maxLength: 2000 } }}
						sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
					/>
					<Tooltip title="Send (Enter)">
						<span>
							<IconButton
								color="primary"
								onClick={submit}
								disabled={!draft.trim() || sendReply.isPending}
								aria-label="Send reply"
								sx={(theme) => ({
									width: 40,
									height: 40,
									backgroundColor: theme.palette.primary.main,
									color: theme.palette.primary.contrastText,
									'&:hover': { backgroundColor: theme.palette.primary.dark },
									'&.Mui-disabled': {
										backgroundColor: theme.palette.action.disabledBackground,
										color: theme.palette.action.disabled
									}
								})}
							>
								<FuseSvgIcon size={18}>lucide:send</FuseSvgIcon>
							</IconButton>
						</span>
					</Tooltip>
				</div>
			)}
		</div>
	);
}

type MessageBubbleProps = {
	message: SupportMessage;
	visitorName: string;
	sentAt: Date;
};

/// The visitor is the other party so they sit left; the bot and the agent both speak
/// for WinPeak and share the right rail, separated by tone rather than position.
function MessageBubble(props: MessageBubbleProps) {
	const { message, visitorName, sentAt } = props;
	const fromVisitor = message.author === 'VISITOR';
	const fromAgent = message.author === 'AGENT';

	return (
		<div className={`flex max-w-[78%] flex-col ${fromVisitor ? 'self-start' : 'items-end self-end'}`}>
			<Box
				sx={(theme) => {
					if (fromAgent) {
						return {
							backgroundColor: theme.palette.primary.main,
							color: theme.palette.primary.contrastText,
							borderRadius: '16px',
							borderBottomRightRadius: '4px'
						};
					}

					if (fromVisitor) {
						return {
							backgroundColor: theme.palette.background.paper,
							border: `1px solid ${theme.palette.divider}`,
							borderRadius: '16px',
							borderBottomLeftRadius: '4px'
						};
					}

					return {
						backgroundColor: alpha(theme.palette.info.main, 0.12),
						color: theme.palette.text.primary,
						borderRadius: '16px',
						borderBottomRightRadius: '4px'
					};
				}}
				className="px-3 py-2"
			>
				<Typography className="text-sm leading-relaxed whitespace-pre-wrap">{message.body}</Typography>
			</Box>

			<Typography
				className="mt-1 px-1 text-[11px]"
				color="text.secondary"
			>
				{fromVisitor ? visitorName : message.authorName || 'Assistant'} · {format(sentAt, 'HH:mm')}
			</Typography>
		</div>
	);
}

export default SupportThread;
