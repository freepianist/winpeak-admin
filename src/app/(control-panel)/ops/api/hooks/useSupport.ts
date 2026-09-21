import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { winpeakApi } from '../apiService';
import { statsQueryKey } from './useWinPeakStats';
import type { SupportAction } from '../types';

export const supportQueueQueryKey = (status?: string) => ['winpeak', 'support', 'queue', status || 'open'];
export const supportThreadQueryKey = (id: string) => ['winpeak', 'support', 'thread', id];
export const supportCountsQueryKey = ['winpeak', 'support', 'counts'];

/**
 * The player site is a separate deployment writing to the same database, so there
 * is no push channel to subscribe to and these two queries poll instead. The thread
 * is faster than the queue because an agent is watching it and a visitor is waiting
 * on the other end; `refetchIntervalInBackground` is left off so a forgotten tab
 * stops costing queries.
 */
export const useSupportQueue = (status?: string) =>
	useQuery({
		queryFn: () => winpeakApi.getSupportConversations(status),
		queryKey: supportQueueQueryKey(status),
		refetchInterval: 5000,
		// Each filter is its own cache entry, so without this the first switch to a
		// tab has no data and the desk would blank out behind a spinner. The stale
		// list stays on screen until the new one lands.
		placeholderData: keepPreviousData
	});

export const useSupportCounts = () =>
	useQuery({
		queryFn: winpeakApi.getSupportCounts,
		queryKey: supportCountsQueryKey,
		refetchInterval: 5000
	});

export const useSupportThread = (id: string) =>
	useQuery({
		queryFn: () => winpeakApi.getSupportConversation(id),
		queryKey: supportThreadQueryKey(id),
		enabled: Boolean(id),
		refetchInterval: 3000
	});

export const useSendSupportReply = (id: string) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: string) => winpeakApi.sendSupportReply(id, body),
		// The prefix covers the thread, every filter's queue and the tab counts, all
		// of which move when a reply lands.
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['winpeak', 'support'] });
		}
	});
};

export const useUpdateSupportConversation = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, action }: { id: string; action: SupportAction }) =>
			winpeakApi.updateSupportConversation(id, action),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['winpeak', 'support'] });
			queryClient.invalidateQueries({ queryKey: statsQueryKey });
		}
	});
};

export const useDeleteSupportConversation = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: winpeakApi.deleteSupportConversation,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['winpeak', 'support'] });
			queryClient.invalidateQueries({ queryKey: statsQueryKey });
		}
	});
};
