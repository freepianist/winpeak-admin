import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { winpeakApi } from '../apiService';
import { statsQueryKey } from './useWinPeakStats';
import type { Player } from '../types';

export const playersQueryKey = ['winpeak', 'players'];
export const playerQueryKey = (id: string) => ['winpeak', 'players', id];
export const walletRequestsQueryKey = ['winpeak', 'wallet-requests'];

export const usePlayers = () => {
	return useQuery({
		queryFn: winpeakApi.getPlayers,
		queryKey: playersQueryKey
	});
};

export const usePlayer = (id: string) => {
	return useQuery({
		queryFn: () => winpeakApi.getPlayer(id),
		queryKey: playerQueryKey(id),
		enabled: Boolean(id) && id !== 'new'
	});
};

export const useUpdatePlayer = (id: string) => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: Partial<Player>) => winpeakApi.updatePlayer(id, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: playersQueryKey });
			queryClient.invalidateQueries({ queryKey: playerQueryKey(id) });
			queryClient.invalidateQueries({ queryKey: statsQueryKey });
		}
	});
};

export const useWalletRequests = (params?: { status?: string; userId?: string }) => {
	return useQuery({
		queryFn: () => winpeakApi.getWalletRequests(params),
		queryKey: [...walletRequestsQueryKey, params?.status || 'all', params?.userId || 'all']
	});
};

export const useUpdateWalletRequest = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			id,
			status,
			reviewNote
		}: {
			id: string;
			status: 'APPROVED' | 'REJECTED';
			reviewNote?: string;
		}) => winpeakApi.updateWalletRequest(id, { status, reviewNote }),
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: walletRequestsQueryKey });
			queryClient.invalidateQueries({ queryKey: playersQueryKey });
			queryClient.invalidateQueries({ queryKey: playerQueryKey(data.userId) });
			queryClient.invalidateQueries({ queryKey: ['winpeak', 'ledger'] });
			queryClient.invalidateQueries({ queryKey: statsQueryKey });
		}
	});
};

/** Reconciles a stuck payout against NOWPayments and settles it if it finished. */
export const useSyncWalletRequest = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id }: { id: string }) => winpeakApi.syncWalletRequest(id),
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: walletRequestsQueryKey });
			queryClient.invalidateQueries({ queryKey: playersQueryKey });
			queryClient.invalidateQueries({ queryKey: playerQueryKey(data.userId) });
			queryClient.invalidateQueries({ queryKey: ['winpeak', 'ledger'] });
			queryClient.invalidateQueries({ queryKey: statsQueryKey });
		}
	});
};

export const useResetPassword = (id: string) => {
	return useMutation({
		mutationFn: (password: string) => winpeakApi.resetPassword(id, password)
	});
};
