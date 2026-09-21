'use client';

import { useEffect, useState } from 'react';
import FusePageCarded from '@fuse/core/FusePageCarded';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';
import AdminPageHeader from '@/app/(control-panel)/ops/components/AdminPageHeader';
import {
	useDeleteSupportConversation,
	useSupportCounts,
	useSupportQueue
} from '@/app/(control-panel)/ops/api/hooks/useSupport';
import SupportFilters from '../SupportFilters';
import SupportQueue from '../SupportQueue';
import SupportThread from '../SupportThread';

const Root = styled(FusePageCarded)(() => ({
	'& .container': {
		maxWidth: '100%!important'
	}
}));

function SupportView() {
	const [filter, setFilter] = useState('');
	const [selectedId, setSelectedId] = useState('');
	const { data: conversations = [], isFetching } = useSupportQueue(filter || undefined);
	const { data: counts } = useSupportCounts();
	const deleteConversation = useDeleteSupportConversation();

	// Only ever fills an empty selection. Holding the agent's choice even when the
	// filter no longer lists it means switching tabs browses the queue instead of
	// yanking them out of the thread they are part way through reading.
	useEffect(() => {
		if (selectedId) {
			return;
		}

		setSelectedId(conversations[0]?.id || '');
	}, [conversations, selectedId]);

	const waiting = counts?.WAITING_AGENT ?? 0;

	return (
		<Root
			header={
				<AdminPageHeader
					title="Live chat"
					subtitle={
						waiting
							? `${waiting} ${waiting === 1 ? 'visitor is' : 'visitors are'} waiting for an agent`
							: 'Conversations escalated from the WinPeak assistant'
					}
					// The segmented control needs more room than the queue column has,
					// and it reads as a page-level filter rather than a list control.
					action={
						<SupportFilters
							value={filter}
							counts={counts}
							onChange={setFilter}
						/>
					}
				/>
			}
			content={
				<Paper
					className="flex min-h-0 w-full flex-1 overflow-hidden rounded-b-none"
					elevation={2}
				>
					<div className="w-88 shrink-0 border-r">
						<SupportQueue
							conversations={conversations}
							selectedId={selectedId}
							filter={filter}
							refreshing={isFetching}
							onSelect={setSelectedId}
						/>
					</div>

					<div className="flex min-w-0 flex-1">
						{selectedId ? (
							<SupportThread
								key={selectedId}
								conversationId={selectedId}
								onDelete={(id) => {
									deleteConversation.mutate(id);
									setSelectedId('');
								}}
							/>
						) : (
							<div className="m-auto flex flex-col items-center gap-3 p-8 text-center">
								<FuseSvgIcon
									size={40}
									className="opacity-30"
								>
									lucide:messages-square
								</FuseSvgIcon>
								<Typography
									className="text-sm"
									color="text.secondary"
								>
									Select a conversation to read it.
								</Typography>
							</div>
						)}
					</div>
				</Paper>
			}
		/>
	);
}

export default SupportView;
