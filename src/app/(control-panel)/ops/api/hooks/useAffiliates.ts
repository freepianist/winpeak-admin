import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { winpeakApi } from '../apiService';
import type { AffiliatePartner } from '../types';

export const marketingStatsQueryKey = ['winpeak', 'affiliates', 'stats'];
export const partnersQueryKey = ['winpeak', 'affiliates'];
export const partnerQueryKey = (id: string) => ['winpeak', 'affiliates', id];
export const commissionsQueryKey = ['winpeak', 'affiliates', 'commissions'];
export const payoutsQueryKey = ['winpeak', 'affiliates', 'payouts'];
export const myAffiliateQueryKey = ['winpeak', 'affiliates', 'me'];

function invalidateAffiliateQueries(queryClient: ReturnType<typeof useQueryClient>, id?: string) {
	queryClient.invalidateQueries({ queryKey: partnersQueryKey });
	queryClient.invalidateQueries({ queryKey: marketingStatsQueryKey });
	queryClient.invalidateQueries({ queryKey: commissionsQueryKey });
	queryClient.invalidateQueries({ queryKey: payoutsQueryKey });
	queryClient.invalidateQueries({ queryKey: myAffiliateQueryKey });

	if (id) {
		queryClient.invalidateQueries({ queryKey: partnerQueryKey(id) });
	}
}

export const useMarketingStats = () => {
	return useQuery({
		queryFn: winpeakApi.getMarketingStats,
		queryKey: marketingStatsQueryKey
	});
};

export const usePartners = () => {
	return useQuery({
		queryFn: winpeakApi.getPartners,
		queryKey: partnersQueryKey
	});
};

export const usePartner = (id: string) => {
	return useQuery({
		queryFn: () => winpeakApi.getPartner(id),
		queryKey: partnerQueryKey(id),
		enabled: Boolean(id)
	});
};

export const useInvitePartner = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: Partial<AffiliatePartner> & { password?: string }) => winpeakApi.invitePartner(data),
		onSuccess: () => invalidateAffiliateQueries(queryClient)
	});
};

export const useReviewPartner = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'CLOSED' }) =>
			winpeakApi.updatePartner(id, { status }),
		onSuccess: (_data, vars) => invalidateAffiliateQueries(queryClient, vars.id)
	});
};

export const useUpdatePartner = (id: string) => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: Partial<AffiliatePartner> & { password?: string }) => winpeakApi.updatePartner(id, data),
		onSuccess: () => invalidateAffiliateQueries(queryClient, id)
	});
};

export const useBookRevShare = (id: string) => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: () => winpeakApi.bookRevShare(id),
		onSuccess: () => invalidateAffiliateQueries(queryClient, id)
	});
};

export const useCommissions = () => {
	return useQuery({
		queryFn: winpeakApi.getCommissions,
		queryKey: commissionsQueryKey
	});
};

export const useUpdateCommission = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, status }: { id: string; status: string }) => winpeakApi.updateCommission(id, status),
		onSuccess: () => invalidateAffiliateQueries(queryClient)
	});
};

export const usePayouts = () => {
	return useQuery({
		queryFn: winpeakApi.getPayouts,
		queryKey: payoutsQueryKey
	});
};

export const useCreatePayout = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: { partnerId: string; amount: number; note?: string; status?: string }) =>
			winpeakApi.createPayout(data),
		onSuccess: () => invalidateAffiliateQueries(queryClient)
	});
};

export const useUpdatePayout = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, ...data }: { id: string; status?: string; note?: string }) =>
			winpeakApi.updatePayout(id, data),
		onSuccess: () => invalidateAffiliateQueries(queryClient)
	});
};

export const useMyAffiliate = () => {
	return useQuery({
		queryFn: winpeakApi.getMyAffiliate,
		queryKey: myAffiliateQueryKey,
		staleTime: 0,
		refetchOnMount: 'always'
	});
};

export const staffQueryKey = ['winpeak', 'staff'];

export const useStaff = () => {
	return useQuery({
		queryFn: winpeakApi.getStaff,
		queryKey: staffQueryKey
	});
};

export const useInviteStaff = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: { name: string; email: string; password?: string; role?: string }) =>
			winpeakApi.inviteStaff(data),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: staffQueryKey })
	});
};

export const useUpdateStaff = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, ...data }: { id: string; name?: string; status?: string; password?: string }) =>
			winpeakApi.updateStaff(id, data),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: staffQueryKey })
	});
};
