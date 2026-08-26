import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { winpeakApi } from '../apiService';
import { statsQueryKey } from './useWinPeakStats';
import { playerQueryKey, playersQueryKey } from './usePlayers';
import type { PromoOffer } from '../types';

export const promosQueryKey = ['winpeak', 'promos'];

export const usePromos = () =>
	useQuery({
		queryFn: winpeakApi.getPromos,
		queryKey: promosQueryKey
	});

export const useUpdatePromo = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: Partial<PromoOffer> & { id: string }) => winpeakApi.updatePromo(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: promosQueryKey });
		}
	});
};

export const useRunCashback = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: winpeakApi.runCashback,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: promosQueryKey });
			queryClient.invalidateQueries({ queryKey: statsQueryKey });
			queryClient.invalidateQueries({ queryKey: playersQueryKey });
		}
	});
};

export const useForfeitBonus = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: winpeakApi.forfeitBonus,
		onSuccess: (bonus) => {
			queryClient.invalidateQueries({ queryKey: promosQueryKey });
			queryClient.invalidateQueries({ queryKey: playersQueryKey });
			queryClient.invalidateQueries({ queryKey: playerQueryKey(bonus.userId) });
			queryClient.invalidateQueries({ queryKey: ['winpeak', 'ledger'] });
		}
	});
};
