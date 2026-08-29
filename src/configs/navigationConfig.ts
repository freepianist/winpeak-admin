import i18n from '@i18n';
import { FuseNavItemType } from '@fuse/core/FuseNavigation/types/FuseNavItemType';
import ar from './navigation-i18n/ar';
import en from './navigation-i18n/en';
import tr from './navigation-i18n/tr';

i18n.addResourceBundle('en', 'navigation', en);
i18n.addResourceBundle('tr', 'navigation', tr);
i18n.addResourceBundle('ar', 'navigation', ar);

const navigationConfig: FuseNavItemType[] = [
	{
		id: 'dashboards',
		title: 'Dashboards',
		subtitle: 'Live WinPeak operations',
		type: 'group',
		icon: 'lucide:layout-dashboard',
		auth: ['admin'],
		children: [
			{
				id: 'dashboards.winpeak',
				title: 'Overview',
				type: 'item',
				icon: 'lucide:gauge',
				url: '/dashboards/winpeak',
				auth: ['admin']
			}
		]
	},
	{
		id: 'operations',
		title: 'Operations',
		subtitle: 'Players, money, and games',
		type: 'group',
		icon: 'lucide:briefcase',
		auth: ['admin'],
		children: [
			{
				id: 'apps.players',
				title: 'Players',
				type: 'item',
				icon: 'lucide:users',
				url: '/apps/players'
			},
			{
				id: 'apps.wallet-requests',
				title: 'Wallet requests',
				type: 'item',
				icon: 'lucide:wallet',
				url: '/apps/wallet-requests'
			},
			{
				id: 'apps.ledger',
				title: 'Ledger',
				type: 'item',
				icon: 'lucide:book-open',
				url: '/apps/ledger'
			},
			{
				id: 'apps.games',
				title: 'Games',
				type: 'item',
				icon: 'lucide:gamepad-2',
				url: '/apps/games'
			},
			{
				id: 'apps.promos',
				title: 'Promotions',
				type: 'item',
				icon: 'lucide:gift',
				url: '/apps/promos'
			},
			{
				id: 'apps.blocked-countries',
				title: 'Blocked countries',
				type: 'item',
				icon: 'lucide:globe-lock',
				url: '/apps/blocked-countries'
			}
		]
	},
	{
		id: 'content',
		title: 'Content',
		subtitle: 'What players see on WinPeak',
		type: 'group',
		icon: 'lucide:newspaper',
		auth: ['admin'],
		children: [
			{
				id: 'apps.blog',
				title: 'Blog',
				type: 'item',
				icon: 'lucide:file-text',
				url: '/apps/blog'
			},
			{
				id: 'apps.comments',
				title: 'Comments',
				type: 'item',
				icon: 'lucide:messages-square',
				url: '/apps/comments'
			},
			{
				id: 'apps.reviews',
				title: 'Reviews',
				type: 'item',
				icon: 'lucide:star',
				url: '/apps/reviews'
			},
			{
				id: 'apps.stories',
				title: 'Stories',
				type: 'item',
				icon: 'lucide:quote',
				url: '/apps/stories'
			}
		]
	},
	{
		id: 'communications',
		title: 'Communications',
		subtitle: 'Inbox and mailing list',
		type: 'group',
		icon: 'lucide:mail',
		auth: ['admin'],
		children: [
			{
				id: 'apps.inbox',
				title: 'Inbox',
				type: 'item',
				icon: 'lucide:inbox',
				url: '/apps/inbox'
			},
			{
				id: 'apps.subscribers',
				title: 'Subscribers',
				type: 'item',
				icon: 'lucide:mail-plus',
				url: '/apps/subscribers'
			}
		]
	},
	{
		id: 'marketing',
		title: 'Marketing',
		subtitle: 'Affiliate partners and deals',
		type: 'group',
		icon: 'lucide:megaphone',
		auth: ['admin', 'affiliate_manager'],
		children: [
			{
				id: 'dashboards.marketing',
				title: 'Affiliate overview',
				type: 'item',
				icon: 'lucide:chart-column',
				url: '/dashboards/marketing',
				auth: ['admin', 'affiliate_manager']
			},
			{
				id: 'apps.partners',
				title: 'Partners',
				type: 'item',
				icon: 'lucide:handshake',
				url: '/apps/partners',
				auth: ['admin', 'affiliate_manager']
			},
			{
				id: 'apps.commissions',
				title: 'Commissions',
				type: 'item',
				icon: 'lucide:badge-dollar-sign',
				url: '/apps/commissions',
				auth: ['admin', 'affiliate_manager']
			},
			{
				id: 'apps.payouts',
				title: 'Payouts',
				type: 'item',
				icon: 'lucide:banknote',
				url: '/apps/payouts',
				auth: ['admin', 'affiliate_manager']
			},
			{
				id: 'apps.managers',
				title: 'Affiliate managers',
				type: 'item',
				icon: 'lucide:user-cog',
				url: '/apps/managers',
				auth: ['admin']
			}
		]
	},
	{
		id: 'partner-portal',
		title: 'Partner portal',
		subtitle: 'Your tracking and earnings',
		type: 'group',
		icon: 'lucide:link',
		auth: ['affiliate'],
		children: [
			{
				id: 'dashboards.partner',
				title: 'My dashboard',
				type: 'item',
				icon: 'lucide:gauge',
				url: '/dashboards/partner'
			},
			{
				id: 'apps.partner.players',
				title: 'My players',
				type: 'item',
				icon: 'lucide:users',
				url: '/apps/partner/players'
			},
			{
				id: 'apps.partner.earnings',
				title: 'My earnings',
				type: 'item',
				icon: 'lucide:wallet',
				url: '/apps/partner/earnings'
			}
		]
	}
];

export default navigationConfig;
