import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { winpeakApi } from '../apiService';
import { localPaymentSettingsQueryKey } from './useLocalPaymentSettings';

export const gameAgentsQueryKey = ['winpeak', 'game-agents'];

export const useGameAgents = () =>
	useQuery({
		queryFn: winpeakApi.getGameAgents,
		queryKey: gameAgentsQueryKey
	});

export const useUpdateGameAgents = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: winpeakApi.updateGameAgents,
		onSuccess: (settings) => {
			queryClient.setQueryData(gameAgentsQueryKey, settings);
			// Countries pick agents from this list.
			void queryClient.invalidateQueries({ queryKey: localPaymentSettingsQueryKey });
		}
	});
};

export const useTestGameAgent = () =>
	useMutation({
		mutationFn: winpeakApi.testGameAgent
	});
