import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { winpeakApi } from '../apiService';

export const blockedCountriesQueryKey = ['winpeak', 'blocked-countries'];

export const useBlockedCountries = () =>
	useQuery({
		queryFn: winpeakApi.getBlockedCountries,
		queryKey: blockedCountriesQueryKey
	});

export const useAddBlockedCountry = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: winpeakApi.addBlockedCountry,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: blockedCountriesQueryKey });
		}
	});
};

export const useRemoveBlockedCountry = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: winpeakApi.removeBlockedCountry,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: blockedCountriesQueryKey });
		}
	});
};
