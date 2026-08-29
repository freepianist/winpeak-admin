export type PlayerStatus = 'ACTIVE' | 'SUSPENDED';

export type Player = {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
	displayName: string;
	scorpioPlayerCode: number | null;
	status: PlayerStatus;
	emailVerified: boolean;
	emailVerifiedAt: string | null;
	dateOfBirth: string | null;
	ageVerified: boolean;
	ageVerifiedAt: string | null;
	country: string | null;
	lastIp: string | null;
	notes: string;
	createdAt: string;
	updatedAt: string;
	balance: number;
	heldBalance: number;
	bonusBalance: number;
	playableBalance: number;
	currency: string;
	ledgerCount: number;
	reviewCount: number;
	ledger?: LedgerItem[];
	bonuses?: PlayerBonus[];
	activeBonus?: PlayerBonus | null;
};

export type LedgerKind =
	| 'BET'
	| 'WIN'
	| 'CANCEL'
	| 'DEPOSIT'
	| 'WITHDRAW'
	| 'BONUS'
	| 'CASHBACK'
	| 'REFERRAL';

export type WalletRequestType = 'DEPOSIT' | 'WITHDRAW';
export type WalletRequestStatus = 'PENDING' | 'PROCESSING' | 'APPROVED' | 'REJECTED';

export type WalletRequest = {
	id: string;
	userId: string;
	playerName: string;
	playerEmail: string;
	currency: string;
	type: WalletRequestType;
	amount: number;
	status: WalletRequestStatus;
	note: string;
	reviewNote: string;
	reviewedBy: string;
	reviewedAt: string | null;
	payCurrency: string;
	payoutAddress: string;
	invoiceUrl: string;
	providerRef: string;
	providerStatus: string;
	autoProcessed: boolean;
	createdAt: string;
	updatedAt: string;
};

export type LedgerItem = {
	id: string;
	userId: string;
	playerName: string;
	playerEmail: string;
	providerTxId: string | null;
	referenceId: string | null;
	roundId: string | null;
	kind: LedgerKind;
	amount: number;
	balanceAfter: number;
	providerId: number | null;
	gameCode: string | null;
	createdAt: string;
};

export type BlogPost = {
	id: string;
	slug: string;
	title: string;
	excerpt: string;
	image: string;
	tag: string;
	author: string;
	authorImage: string;
	publishedAt: string;
	intro: string;
	sectionsJson: string;
	commentCount: number;
};

export type BlogComment = {
	id: string;
	postId: string;
	postTitle: string;
	postSlug: string;
	authorName: string;
	authorEmail: string;
	content: string;
	createdAt: string;
};

export type ReviewReply = {
	id: string;
	authorName: string;
	content: string;
	createdAt: string;
};

export type GameReview = {
	id: string;
	providerId: number;
	gameCode: string;
	userId: string | null;
	playerName: string;
	authorName: string;
	authorEmail: string;
	rating: number;
	content: string;
	createdAt: string;
	replyCount: number;
	replies: ReviewReply[];
};

export type SuccessStory = {
	id: string;
	authorName: string;
	role: string;
	content: string;
	image: string;
	rating: number;
	createdAt: string;
};

export type InboxMessage = {
	id: string;
	name: string;
	email: string;
	phone: string;
	message: string;
	read: boolean;
	createdAt: string;
};

export type Subscriber = {
	id: string;
	email: string;
	createdAt: string;
};

export type GameStat = {
	providerId: number | null;
	gameCode: string;
	bets: number;
	wins: number;
	rounds: number;
	reviews: number;
	avgRating: number;
	ggr: number;
};

export type DashboardStats = {
	users: { total: number; newThisWeek: number; suspended: number };
	wallets: { totalBalance: number; currency: string };
	ledger: {
		deposits: number;
		withdrawals: number;
		bets: number;
		wins: number;
		netDeposits: number;
		ggr: number;
		counts: { deposits: number; withdrawals: number; bets: number; wins: number };
	};
	queues?: { pendingDeposits: number; pendingWithdrawals: number };
	content: {
		posts: number;
		comments: number;
		reviews: number;
		stories: number;
		unreadInbox: number;
		subscribers: number;
	};
	series: { date: string; deposits: number; withdrawals: number; bets: number; wins: number }[];
	recentUsers: Player[];
	recentLedger: LedgerItem[];
	affiliates?: {
		partners: number;
		ftds: number;
		pending: number;
	};
};

export type AffiliateDealType = 'CPA' | 'REVSHARE' | 'HYBRID';
export type AffiliateStatus = 'INVITED' | 'ACTIVE' | 'PAUSED' | 'CLOSED';
export type CommissionKind = 'CPA' | 'REVSHARE';
export type CommissionStatus = 'PENDING' | 'APPROVED' | 'PAID' | 'VOID';
export type PayoutStatus = 'PENDING' | 'SENT';

export type AffiliateBookStats = {
	signups: number;
	ftds: number;
	bets: number;
	wins: number;
	ggr: number;
	estimatedRevShare: number;
	bookedCpa: number;
	bookedRevShare: number;
	pending: number;
	approved: number;
	paid: number;
	paidOut: number;
};

export type AffiliatePartner = {
	id: string;
	email: string;
	name: string;
	code: string;
	dealType: AffiliateDealType;
	cpaAmount: number;
	revSharePercent: number;
	minFtdAmount: number;
	status: AffiliateStatus;
	notes: string;
	hasPassword: boolean;
	trackingLink: string;
	createdAt: string;
	updatedAt: string;
	temporaryPassword?: string;
	stats?: AffiliateBookStats;
};

export type AffiliatePlayer = {
	id: string;
	label?: string;
	displayName: string;
	email: string;
	status?: string;
	joinedAt: string;
	firstDepositAt: string | null;
	qualified: boolean;
};

export type AffiliateCommission = {
	id: string;
	partnerId: string;
	partnerName: string;
	partnerEmail: string;
	partnerCode: string;
	userId: string | null;
	playerName: string;
	playerEmail: string;
	kind: CommissionKind;
	amount: number;
	basisAmount: number;
	status: CommissionStatus;
	createdAt: string;
};

export type AffiliatePayout = {
	id: string;
	partnerId: string;
	partnerName: string;
	partnerEmail: string;
	partnerCode: string;
	amount: number;
	status: PayoutStatus;
	note: string;
	createdAt: string;
};

export type AffiliatePartnerDetail = {
	partner: AffiliatePartner;
	stats: AffiliateBookStats;
	players: AffiliatePlayer[];
	commissions: AffiliateCommission[];
	payouts: AffiliatePayout[];
};

export type MarketingStats = {
	partners: { total: number; active: number; invited: number; paused: number };
	players: { signups: number; ftds: number };
	money: {
		bookedCpa: number;
		bookedRevShare: number;
		pending: number;
		approved: number;
		paid: number;
		paidOut: number;
		estimatedRevShare: number;
	};
	leaderboard: {
		id: string;
		name: string;
		code: string;
		dealType: AffiliateDealType;
		status: AffiliateStatus;
		stats?: AffiliateBookStats;
	}[];
};

export type StaffMember = {
	id: string;
	email: string;
	name: string;
	role: string;
	status: string;
	createdAt: string;
	updatedAt: string;
	temporaryPassword?: string;
};

export type PromoKind = 'WELCOME' | 'RELOAD' | 'CASHBACK' | 'REFERRAL';
export type PromoStatus = 'ACTIVE' | 'PAUSED';
export type PlayerBonusStatus = 'ACTIVE' | 'COMPLETED' | 'FORFEITED' | 'EXPIRED';

export type PromoOffer = {
	id: string;
	slug: string;
	kind: PromoKind;
	name: string;
	headline: string;
	details: string;
	matchPercent: number;
	maxAmount: number;
	minDeposit: number;
	wagerMultiplier: number;
	expireDays: number;
	maxBet: number;
	depositNumber: number | null;
	rewardAmount: number;
	status: PromoStatus;
};

export type PlayerBonus = {
	id: string;
	userId: string;
	playerName: string;
	playerEmail: string;
	offerId: string;
	offerName: string;
	kind: string;
	status: PlayerBonusStatus;
	bonusAmount: number;
	wagerRequired: number;
	wagerRemaining: number;
	depositAmount: number;
	expiresAt: string | null;
	grantedAt: string;
	completedAt: string | null;
	note: string;
};

export type CashbackRunResult = {
	credited: number;
	amount: number;
	scanned: number;
	periodStart: string;
	periodEnd: string;
};

export type PromosPayload = {
	offers: PromoOffer[];
	bonuses: PlayerBonus[];
	cashback: {
		lastAmount: number;
		lastCount: number;
	};
};

export type BlockedCountry = {
	code: string;
	name: string;
	note: string;
	createdAt: string;
	updatedAt: string;
};
