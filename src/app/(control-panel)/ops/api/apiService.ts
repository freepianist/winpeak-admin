import { api } from '@/utils/api';
import { HTTPError } from 'ky';
import type {
	BlogComment,
	BlogPost,
	DashboardStats,
	GameReview,
	AffiliateCommission,
	AffiliatePartner,
	AffiliatePartnerDetail,
	AffiliatePayout,
	GameStat,
	InboxMessage,
	LedgerItem,
	MarketingStats,
	Player,
	StaffMember,
	Subscriber,
	SuccessStory,
	WalletRequest,
	WalletRequestSync,
	PromoOffer,
	PromosPayload,
	PlayerBonus,
	CashbackRunResult,
	BlockedCountry
} from './types';

async function unwrap<T>(request: Promise<T>) {
	try {
		return await request;
	} catch (error) {
		if (error instanceof HTTPError) {
			const body = (await error.response.json().catch(() => null)) as { error?: string } | null;
			throw new Error(body?.error || error.message);
		}

		throw error;
	}
}

export const winpeakApi = {
	getStats: () => unwrap(api.get('winpeak/stats').json<DashboardStats>()),
	getPlayers: () => unwrap(api.get('winpeak/users').json<Player[]>()),
	getPlayer: (id: string) => unwrap(api.get(`winpeak/users/${id}`).json<Player>()),
	updatePlayer: (id: string, data: Partial<Player>) =>
		unwrap(api.patch(`winpeak/users/${id}`, { json: data }).json<Player>()),
	resetPassword: (id: string, password: string) =>
		unwrap(api.post(`winpeak/users/${id}/password`, { json: { password } }).json<{ success: boolean }>()),
	getWalletRequests: (params?: { status?: string; userId?: string }) => {
		const search = new URLSearchParams();
		if (params?.status) search.set('status', params.status);
		if (params?.userId) search.set('userId', params.userId);
		const suffix = search.toString() ? `?${search.toString()}` : '';
		return unwrap(api.get(`winpeak/wallet-requests${suffix}`).json<WalletRequest[]>());
	},
	updateWalletRequest: (id: string, data: { status: 'APPROVED' | 'REJECTED'; reviewNote?: string }) =>
		unwrap(api.patch(`winpeak/wallet-requests/${id}`, { json: data }).json<WalletRequest>()),
	syncWalletRequest: (id: string) =>
		unwrap(api.post(`winpeak/wallet-requests/${id}/sync`).json<WalletRequestSync>()),
	getLedger: (params?: { kind?: string; userId?: string }) => {
		const search = new URLSearchParams();
		if (params?.kind) search.set('kind', params.kind);
		if (params?.userId) search.set('userId', params.userId);
		const suffix = search.toString() ? `?${search.toString()}` : '';
		return unwrap(api.get(`winpeak/ledger${suffix}`).json<LedgerItem[]>());
	},
	getBlogs: () => unwrap(api.get('winpeak/blogs').json<BlogPost[]>()),
	getBlog: (id: string) => unwrap(api.get(`winpeak/blogs/${id}`).json<BlogPost>()),
	uploadImage: (file: File, folder: 'blog' | 'authors' | 'stories') => {
		const formData = new FormData();
		formData.append('file', file);
		formData.append('folder', folder);
		return unwrap(api.post('winpeak/uploads', { body: formData }).json<{ url: string }>());
	},
	createBlog: (data: Partial<BlogPost>) => unwrap(api.post('winpeak/blogs', { json: data }).json<BlogPost>()),
	updateBlog: (id: string, data: Partial<BlogPost>) =>
		unwrap(api.put(`winpeak/blogs/${id}`, { json: data }).json<BlogPost>()),
	deleteBlog: (id: string) => unwrap(api.delete(`winpeak/blogs/${id}`).json<{ success: boolean }>()),
	getComments: () => unwrap(api.get('winpeak/comments').json<BlogComment[]>()),
	deleteComments: (ids: string[]) =>
		unwrap(api.delete('winpeak/comments', { json: { ids } }).json<{ success: boolean }>()),
	getReviews: () => unwrap(api.get('winpeak/reviews').json<GameReview[]>()),
	deleteReviews: (ids: string[]) =>
		unwrap(api.delete('winpeak/reviews', { json: { ids } }).json<{ success: boolean }>()),
	deleteReply: (id: string) => unwrap(api.delete(`winpeak/replies/${id}`).json<{ success: boolean }>()),
	getStories: () => unwrap(api.get('winpeak/stories').json<SuccessStory[]>()),
	getStory: (id: string) => unwrap(api.get(`winpeak/stories/${id}`).json<SuccessStory>()),
	createStory: (data: Partial<SuccessStory>) =>
		unwrap(api.post('winpeak/stories', { json: data }).json<SuccessStory>()),
	updateStory: (id: string, data: Partial<SuccessStory>) =>
		unwrap(api.put(`winpeak/stories/${id}`, { json: data }).json<SuccessStory>()),
	deleteStory: (id: string) => unwrap(api.delete(`winpeak/stories/${id}`).json<{ success: boolean }>()),
	getInbox: () => unwrap(api.get('winpeak/inbox').json<InboxMessage[]>()),
	updateInbox: (id: string, read: boolean) =>
		unwrap(api.patch(`winpeak/inbox/${id}`, { json: { read } }).json<InboxMessage>()),
	deleteInbox: (id: string) => unwrap(api.delete(`winpeak/inbox/${id}`).json<{ success: boolean }>()),
	getSubscribers: () => unwrap(api.get('winpeak/subscribers').json<Subscriber[]>()),
	deleteSubscribers: (ids: string[]) =>
		unwrap(api.delete('winpeak/subscribers', { json: { ids } }).json<{ success: boolean }>()),
	getGames: () => unwrap(api.get('winpeak/games').json<GameStat[]>()),
	getMarketingStats: () => unwrap(api.get('winpeak/affiliates/stats').json<MarketingStats>()),
	getPartners: () => unwrap(api.get('winpeak/affiliates').json<AffiliatePartner[]>()),
	getPartner: (id: string) => unwrap(api.get(`winpeak/affiliates/${id}`).json<AffiliatePartnerDetail>()),
	invitePartner: (data: Partial<AffiliatePartner> & { password?: string }) =>
		unwrap(api.post('winpeak/affiliates', { json: data }).json<AffiliatePartner>()),
	updatePartner: (id: string, data: Partial<AffiliatePartner> & { password?: string }) =>
		unwrap(api.patch(`winpeak/affiliates/${id}`, { json: data }).json<AffiliatePartner>()),
	bookRevShare: (id: string) =>
		unwrap(api.post(`winpeak/affiliates/${id}/revshare`).json<AffiliateCommission>()),
	getCommissions: () => unwrap(api.get('winpeak/affiliates/commissions').json<AffiliateCommission[]>()),
	updateCommission: (id: string, status: string) =>
		unwrap(api.patch(`winpeak/affiliates/commissions/${id}`, { json: { status } }).json<AffiliateCommission>()),
	getPayouts: () => unwrap(api.get('winpeak/affiliates/payouts').json<AffiliatePayout[]>()),
	createPayout: (data: { partnerId: string; amount: number; note?: string; status?: string }) =>
		unwrap(api.post('winpeak/affiliates/payouts', { json: data }).json<AffiliatePayout>()),
	updatePayout: (id: string, data: { status?: string; note?: string }) =>
		unwrap(api.patch(`winpeak/affiliates/payouts/${id}`, { json: data }).json<AffiliatePayout>()),
	getMyAffiliate: () => unwrap(api.get('winpeak/affiliates/me').json<AffiliatePartnerDetail>()),
	getStaff: () => unwrap(api.get('winpeak/staff').json<StaffMember[]>()),
	inviteStaff: (data: { name: string; email: string; password?: string }) =>
		unwrap(api.post('winpeak/staff', { json: data }).json<StaffMember>()),
	updateStaff: (id: string, data: { name?: string; status?: string; password?: string }) =>
		unwrap(api.patch(`winpeak/staff/${id}`, { json: data }).json<StaffMember>()),
	getPromos: () => unwrap(api.get('winpeak/promos').json<PromosPayload>()),
	updatePromo: (data: Partial<PromoOffer> & { id: string }) =>
		unwrap(api.patch('winpeak/promos', { json: data }).json<PromoOffer>()),
	runCashback: () => unwrap(api.post('winpeak/promos/cashback').json<CashbackRunResult>()),
	forfeitBonus: (id: string) =>
		unwrap(api.post(`winpeak/promos/bonuses/${id}/forfeit`).json<PlayerBonus>()),
	getBlockedCountries: () => unwrap(api.get('winpeak/blocked-countries').json<BlockedCountry[]>()),
	addBlockedCountry: (data: { code: string; note?: string }) =>
		unwrap(api.post('winpeak/blocked-countries', { json: data }).json<BlockedCountry>()),
	removeBlockedCountry: (code: string) =>
		unwrap(api.delete(`winpeak/blocked-countries/${code}`).json<{ success: boolean; code: string }>())
};
