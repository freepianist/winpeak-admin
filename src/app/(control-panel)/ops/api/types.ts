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

export type LedgerKind = 'BET' | 'WIN' | 'CANCEL' | 'DEPOSIT' | 'WITHDRAW' | 'BONUS' | 'CASHBACK' | 'REFERRAL';

/** Which aggregator a provider, game or transaction belongs to. */
export type GameSource = 'scorpio' | 'oroplay';

/** A ledger entry's origin. `internal` is money the casino moves itself. */
export type LedgerSource = GameSource | 'internal';

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
	/** Raised in manual mode: no invoice or payout exists, so staff settle it by hand. */
	manual: boolean;
	/** The transfer the player reported for a manual deposit. */
	txHash: string;
	conversionId: string;
	conversionStatus: string;
	settleCurrency: string;
	settleAmount: number | null;
	/** Coin units the player sent, and what they were worth once credited. */
	paidAmount: number | null;
	creditedAmount: number | null;
	/** EXACT, UNDERPAID or OVERPAID against the invoiced amount. */
	paymentOutcome: string;
	/** "daypgl" for the local-currency rail, empty for crypto. */
	provider: string;
	country: string;
	localCurrency: string;
	/** Local-currency figure DAYPGL was asked for. */
	localAmount: number | null;
	/** Local units per 1 wallet unit, spread included, locked when the request was made. */
	fxRate: number | null;
	/** Crypto on a non-USD wallet: wallet units per 1 USD, spread included. Null on USD wallets. */
	usdRate: number | null;
	/** What the crypto side is worth in USD: the invoice, or the payout to send. */
	amountUsd: number;
	/** DAYPGL trade_type (deposit) or bank_code (payout). */
	channel: string;
	payeeName: string;
	createdAt: string;
	updatedAt: string;
};

/** A wallet request plus what reconciling it against NOWPayments found. */
export type WalletRequestSync = WalletRequest & {
	syncChanged: boolean;
	syncMessage: string;
};

export type LedgerItem = {
	id: string;
	userId: string;
	playerName: string;
	playerEmail: string;
	/** The player's wallet currency; amounts are in it. */
	currency: string;
	providerTxId: string | null;
	referenceId: string | null;
	roundId: string | null;
	kind: LedgerKind;
	amount: number;
	balanceAfter: number;
	/** `internal` for money the casino moves itself, which has no provider. */
	source: LedgerSource;
	providerId: string | null;
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
	source: GameSource;
	/** Scorpio's numeric provider id or Oroplay's vendor code, as that source spells it. */
	providerId: string;
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
	source: string;
	providerId: string | null;
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
	queues?: {
		pendingDeposits: number;
		pendingWithdrawals: number;
		waitingSupportChats?: number;
		openSupportChats?: number;
	};
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
	clicks: number;
	uniqueClicks: number;
	repeatClicks: number;
	refreshClicks: number;
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
	payoutId: string | null;
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
	commissionCount: number;
	createdAt: string;
};

export type AffiliateVisitType = 'unique' | 'repeat' | 'refresh' | 'new_tab' | 'same_tab' | 'back';

export type AffiliateClick = {
	id: string;
	landingPath: string;
	source: string;
	createdAt: string;
	visitType: AffiliateVisitType;
	visitNumber: number;
	visitorVisits: number;
	visitorLabel: string;
	deviceType: string;
	os: string;
	browser: string;
	country: string;
	region: string;
	city: string;
};

export type AffiliateClickPage = {
	rows: AffiliateClick[];
	total: number;
	page: number;
	pageSize: number;
};

export type AffiliateClickPageParams = {
	page: number;
	pageSize: number;
	visitType?: string;
	search?: string;
	sort?: 'asc' | 'desc';
};

export type AffiliateClickSeriesPoint = {
	date: string;
	clicks: number;
	uniqueClicks: number;
};

export type AffiliatePartnerDetail = {
	partner: AffiliatePartner;
	stats: AffiliateBookStats;
	players: AffiliatePlayer[];
	clicks: AffiliateClick[];
	clickSeries: AffiliateClickSeriesPoint[];
	commissions: AffiliateCommission[];
	payouts: AffiliatePayout[];
};

export type MarketingStats = {
	partners: { total: number; active: number; invited: number; paused: number };
	players: { signups: number; ftds: number; clicks: number; uniqueClicks: number };
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
	currency: string;
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

/** One casino receiving wallet. Returned for every supported coin, configured or not. */
export type ManualWallet = {
	payCurrency: string;
	label: string;
	address: string;
	qrImageUrl: string;
	enabled: boolean;
	updatedAt: string | null;
};

export type PaymentSettings = {
	/** When on, deposits and withdrawals skip NOWPayments and are settled by staff. */
	manualMode: boolean;
	/** Manual-rail floors in USD. Only applied while manual mode is on. */
	manualMinDeposit: number;
	manualMinWithdraw: number;
	updatedBy: string;
	updatedAt: string | null;
	wallets: ManualWallet[];
};

export type PaymentSettingsInput = {
	manualMode: boolean;
	manualMinDeposit: number;
	manualMinWithdraw: number;
	wallets: Omit<ManualWallet, 'label' | 'updatedAt'>[];
};

export type LocalPaymentChannel = {
	kind: WalletRequestType;
	code: string;
	label: string;
	enabled: boolean;
};

/** One DAYPGL country as staff configure it. */
export type LocalPaymentCountry = {
	country: string;
	currency: string;
	/** Local units per 1 USD, before spread. */
	fxRate: number;
	depositSpreadPct: number;
	withdrawSpreadPct: number;
	minDepositUsd: number;
	minWithdrawUsd: number;
	enabled: boolean;
	scorpioAgentId: string | null;
	oroplayAgentId: string | null;
	/** Accounts opened on this market, which lock its currency. */
	boundUsers: number;
	channels: LocalPaymentChannel[];
	/** Merchant payout balance at DAYPGL, when it could be read. */
	balance: { available: number; frozen: number; currency: string } | null;
	balanceError: string;
	updatedBy: string;
	updatedAt: string | null;
};

export type LocalPaymentSettings = {
	configured: boolean;
	/** Player site origin without `www`; each country is served on its `<code>.` subdomain. */
	siteOrigin: string;
	payinCallbackUrl: string;
	payoutCallbackUrl: string;
	countries: LocalPaymentCountry[];
};

export type LocalPaymentSettingsInput = {
	countries: Omit<LocalPaymentCountry, 'balance' | 'balanceError' | 'boundUsers' | 'updatedBy' | 'updatedAt'>[];
};

export type GameAgentSource = 'scorpio' | 'oroplay';

/** A game aggregator account in one currency. Secrets are never sent back, only whether one is stored. */
export type GameAgent = {
	id: string;
	label: string;
	source: GameAgentSource;
	currency: string;
	apiBaseUrl: string;
	language: string;
	clientId: string;
	proxyUrl: string;
	hasApiToken: boolean;
	hasClientSecret: boolean;
	enabled: boolean;
	/** Markets this agent is assigned to. */
	countries: string[];
	updatedBy: string;
	updatedAt: string | null;
};

export type GameAgentSettings = {
	keyConfigured: boolean;
	scorpioCallbackUrl: string;
	oroplayCallbackBase: string;
	agents: GameAgent[];
};

export type GameAgentInput = Pick<
	GameAgent,
	'label' | 'source' | 'currency' | 'apiBaseUrl' | 'language' | 'clientId' | 'proxyUrl' | 'enabled'
> & {
	id?: string;
	/** Blank keeps the stored secret. */
	apiToken?: string;
	clientSecret?: string;
};

export type GameAgentTestResult = { ok: boolean; message: string };

export type SupportStatus = 'BOT' | 'WAITING_AGENT' | 'AGENT' | 'RESOLVED';
export type SupportAuthor = 'VISITOR' | 'BOT' | 'AGENT' | 'SYSTEM';

export type SupportMessage = {
	id: string;
	author: SupportAuthor;
	body: string;
	authorName: string;
	createdAt: string;
};

export type SupportConversation = {
	id: string;
	userId: string | null;
	email: string;
	name: string;
	isGuest: boolean;
	status: SupportStatus;
	assignedStaffId: string | null;
	assignedStaffName: string;
	/** Why the bot or the visitor escalated, shown to the agent before they open the thread. */
	handoffReason: string;
	lastMessageAt: string;
	unreadForAgent: number;
	createdAt: string;
	preview?: string;
	previewAuthor?: SupportAuthor | null;
};

export type SupportConversationDetail = SupportConversation & {
	player: {
		id: string;
		email: string;
		name: string;
		status: string;
		emailVerified: boolean;
		createdAt: string;
	} | null;
	messages: SupportMessage[];
};

export type SupportAction = 'claim' | 'release' | 'resolve' | 'reopen';

/** Totals per status, plus `OPEN` for the default queue of waiting and claimed threads. */
export type SupportCounts = Record<SupportStatus, number> & { OPEN: number };
