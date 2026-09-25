import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { winpeakApi } from '../apiService';
import { statsQueryKey } from './useWinPeakStats';

export const commentsQueryKey = ['winpeak', 'comments'];
export const reviewsQueryKey = ['winpeak', 'reviews'];
export const storiesQueryKey = ['winpeak', 'stories'];
export const storyQueryKey = (id: string) => ['winpeak', 'stories', id];
export const inboxQueryKey = ['winpeak', 'inbox'];
export const subscribersQueryKey = ['winpeak', 'subscribers'];
export const gamesQueryKey = ['winpeak', 'games'];

export const useComments = () => useQuery({ queryFn: winpeakApi.getComments, queryKey: commentsQueryKey });
export const useReviews = () => useQuery({ queryFn: winpeakApi.getReviews, queryKey: reviewsQueryKey });
export const useStories = () => useQuery({ queryFn: winpeakApi.getStories, queryKey: storiesQueryKey });
export const useStory = (id: string) =>
	useQuery({
		queryFn: () => winpeakApi.getStory(id),
		queryKey: storyQueryKey(id),
		enabled: Boolean(id) && id !== 'new'
	});
export const useInbox = () => useQuery({ queryFn: winpeakApi.getInbox, queryKey: inboxQueryKey });
export const useSubscribers = () => useQuery({ queryFn: winpeakApi.getSubscribers, queryKey: subscribersQueryKey });
export const useGames = () => useQuery({ queryFn: winpeakApi.getGames, queryKey: gamesQueryKey });

export const useDeleteComments = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: winpeakApi.deleteComments,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: commentsQueryKey });
			queryClient.invalidateQueries({ queryKey: statsQueryKey });
		}
	});
};

export const useDeleteReviews = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: winpeakApi.deleteReviews,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: reviewsQueryKey });
			queryClient.invalidateQueries({ queryKey: statsQueryKey });
		}
	});
};

export const useDeleteReply = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: winpeakApi.deleteReply,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: reviewsQueryKey })
	});
};

export const useCreateStory = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: winpeakApi.createStory,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: storiesQueryKey });
			queryClient.invalidateQueries({ queryKey: statsQueryKey });
		}
	});
};

export const useUpdateStory = (id: string) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: Parameters<typeof winpeakApi.updateStory>[1]) => winpeakApi.updateStory(id, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: storiesQueryKey });
			queryClient.invalidateQueries({ queryKey: storyQueryKey(id) });
		}
	});
};

export const useDeleteStory = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: winpeakApi.deleteStory,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: storiesQueryKey });
			queryClient.invalidateQueries({ queryKey: statsQueryKey });
		}
	});
};

export const useUpdateInbox = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, read }: { id: string; read: boolean }) => winpeakApi.updateInbox(id, read),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: inboxQueryKey });
			queryClient.invalidateQueries({ queryKey: statsQueryKey });
		}
	});
};

export const useDeleteInbox = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: winpeakApi.deleteInbox,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: inboxQueryKey });
			queryClient.invalidateQueries({ queryKey: statsQueryKey });
		}
	});
};

export const useDeleteSubscribers = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: winpeakApi.deleteSubscribers,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: subscribersQueryKey });
			queryClient.invalidateQueries({ queryKey: statsQueryKey });
		}
	});
};
