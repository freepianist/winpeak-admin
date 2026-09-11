import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { winpeakApi } from '../apiService';

export const paymentSettingsQueryKey = ['winpeak', 'payment-settings'];

export const usePaymentSettings = () =>
	useQuery({
		queryFn: winpeakApi.getPaymentSettings,
		queryKey: paymentSettingsQueryKey
	});

export const useUpdatePaymentSettings = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: winpeakApi.updatePaymentSettings,
		onSuccess: (settings) => {
			queryClient.setQueryData(paymentSettingsQueryKey, settings);
		}
	});
};
