# WinPeak Admin

Operations console for the WinPeak site: players, wallets, content, live chat, and affiliate partners.

## Local setup

1. Copy `.env.example` to `.env` and fill in values.
2. Use the same `DATABASE_URL` as the public site.
3. Install and run:

```bash
npm install
npm run dev
```

The app expects Node 22.12 or newer.

## Deploy

Set these on the host. Do not commit `.env`.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_BASE_URL` | Public URL of this admin app |
| `AUTH_URL` | Same URL as the admin app |
| `AUTH_SECRET` | Random secret for auth sessions |
| `DATABASE_URL` | Shared PostgreSQL URL |
| `ADMIN_EMAIL` | Staff login email |
| `ADMIN_PASSWORD` | Staff login password |
| `WINPEAK_SITE_URL` | Public player site origin |
| `WINPEAK_PUBLIC_ROOT` | Optional path to the public site so uploaded blog images are written there |

Build and start:

```bash
npm run build
npm start
```

Production notes:

- Keep the default branch as `master`. Use `dev` for staging if you want a preview.
- Prisma client is generated during `npm run build`.
- Blog image uploads write to disk. On serverless hosts that filesystem is not persistent, so set `WINPEAK_PUBLIC_ROOT` on a server with shared storage, or serve uploads from the public site.
- Unused Fuse demo pages and the public sign-up route are blocked.

## Live chat

Visitors chat with an AI assistant on the player site. When they ask for a human, or
the bot cannot resolve the request, the thread lands in **Live chat** (`/apps/support`).
Both apps read and write the same `SupportConversation` and `SupportMessage` tables and
poll them, because the player site is a separate deployment with no shared event bus.

Add support staff under **Staff** (`/apps/managers`) with the **Support agent** role.
They sign in here like any other staff member but only reach the live chat desk; they
cannot see players, wallets or affiliates. The AI keys (`OPENAI_API_KEY`,
`SUPPORT_AI_ENABLED`, `SUPPORT_NOTIFY_EMAIL`) live on the player site, not here.
