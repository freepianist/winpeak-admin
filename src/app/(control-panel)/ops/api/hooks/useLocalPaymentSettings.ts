import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { winpeakApi } from '../apiService';

export const localPaymentSettingsQueryKey = ['winpeak', 'local-payments'];

export const useLocalPaymentSettings = () =>
	useQuery({
		queryFn: winpeakApi.getLocalPaymentSettings,
		queryKey: localPaymentSettingsQueryKey
	});

export const useUpdateLocalPaymentSettings = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: winpeakApi.updateLocalPaymentSettings,
		onSuccess: (settings) => {
			queryClient.setQueryData(localPaymentSettingsQueryKey, settings);
		}
	});
};
