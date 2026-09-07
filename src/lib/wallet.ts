import type { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/db';
import { money } from '@/lib/money';
import { accrueAffiliateCpa } from '@/lib/affiliates';
import { grantDepositPromos } from '@/lib/promos';
import { createPayout, estimateCryptoAmount, isPayoutConfigured } from '@/lib/payments/nowpayments';
import {
	createConversion,
	getAvailableBalance,
	getConversion,
	getConversionBufferPct,
	getPayout,
	getSettlementCurrency,
	isConversionFailed,
	isConversionSettled,
	isPayoutFailed,
	isPayoutSettled,
	isPayoutUnverified,
	minConversionAmount,
	payoutFee
} from '@/lib/payments/treasury';

const TX = { maxWait: 15_000, timeout: 30_000 } as const;

async function lockWallet(client: Prisma.TransactionClient, userId: string) {
	await client.$queryRaw`SELECT 1 FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE`;
	return client.wallet.findUnique({ where: { userId } });
}

async function lockWalletRequest(client: Prisma.TransactionClient, id: string) {
	await client.$queryRaw`SELECT 1 FROM "WalletRequest" WHERE "id" = ${id} FOR UPDATE`;
	return client.walletRequest.findUnique({ where: { id } });
}

export function availableBalance(wallet: {
	balance: { toString(): string } | number;
	heldBalance?: { toString(): string } | number | null;
}) {
	return money(wallet.balance) - money(wallet.heldBalance ?? 0);
}

export async function applyDeposit(userId: string, amount: number, tx?: Prisma.TransactionClient) {
	if (amount <= 0) {
		throw new Error('Deposit amount must be greater than 0');
	}

	const run = async (client: Prisma.TransactionClient) => {
		const wallet = await lockWallet(client, userId);

		if (!wallet) {
			throw new Error('Wallet not found');
		}

		const next = money(wallet.balance) + amount;
		await client.wallet.update({
			where: { userId },
			data: { balance: next }
		});
		await client.ledgerEntry.create({
			data: {
				userId,
				kind: 'DEPOSIT',
				amount,
				balanceAfter: next
			}
		});
		await grantDepositPromos(userId, amount, client);

		const updated = await client.wallet.findUnique({ where: { userId } });
		return {
			balance: updated ? money(updated.balance) - money(updated.heldBalance) : availableBalance({ balance: next, heldBalance: wallet.heldBalance }),
			currency: wallet.currency
		};
	};

	if (tx) {
		return run(tx);
	}

	const result = await prisma.$transaction(run, TX);

	try {
		await accrueAffiliateCpa(userId, amount);
	} catch (error) {
		console.error('Affiliate CPA accrual failed', error);
	}

	return result;
}

export async function applyWithdraw(userId: string, amount: number, tx?: Prisma.TransactionClient) {
	if (amount <= 0) {
		throw new Error('Withdraw amount must be greater than 0');
	}

	const run = async (client: Prisma.TransactionClient) => {
		const wallet = await lockWallet(client, userId);

		if (!wallet) {
			throw new Error('Wallet not found');
		}

		if (money(wallet.balance) < amount) {
			throw new Error('Insufficient balance');
		}

		const next = money(wallet.balance) - amount;
		const nextHeld = Math.max(0, money(wallet.heldBalance) - amount);
		await client.wallet.update({
			where: { userId },
			data: { balance: next, heldBalance: nextHeld }
		});
		await client.ledgerEntry.create({
			data: {
				userId,
				kind: 'WITHDRAW',
				amount,
				balanceAfter: next
			}
		});

		return { balance: next - nextHeld, currency: wallet.currency };
	};

	if (tx) {
		return run(tx);
	}

	return prisma.$transaction(run, TX);
}

export async function approveWalletRequest(requestId: string, reviewedBy: string, reviewNote?: string) {
	const request = await prisma.walletRequest.findUnique({ where: { id: requestId } });

	if (!request) {
		throw new Error('Request not found');
	}

	if (request.status === 'PROCESSING') {
		throw new Error('This payout is already being sent');
	}

	if (request.status !== 'PENDING') {
		throw new Error('Request is no longer pending');
	}

	const amount = money(request.amount);

	if (request.type === 'WITHDRAW') {
		if (!request.payoutAddress) {
			throw new Error('This withdrawal has no crypto address. Reject it or ask the player to resubmit.');
		}

		if (!isPayoutConfigured()) {
			throw new Error(
				'NOWPayments payouts are not configured in admin. Add API key, email, and password before approving withdrawals.'
			);
		}

		await prisma.walletRequest.update({
			where: { id: requestId },
			data: {
				status: 'PROCESSING',
				reviewedBy,
				reviewedAt: new Date(),
				reviewNote: reviewNote?.trim() || 'Manual crypto payout submitted',
				providerStatus: 'submitting'
			}
		});

		const settlement = getSettlementCurrency();
		const destination = (
			request.payCurrency ||
			process.env.NOWPAYMENTS_PAYOUT_CURRENCY ||
			settlement
		).toLowerCase();

		try {
			// The treasury only holds the settlement coin, so a payout on another
			// network has to be funded by a conversion first. Where one is needed
			// the player site's scheduled tick finishes the payout once it settles.
			if (destination !== settlement && !request.conversionId) {
				const base = await estimateCryptoAmount(amount, destination);
				const fee = await payoutFee(destination, base);
				const required = (base + fee) * (1 + getConversionBufferPct() / 100);
				const available = await getAvailableBalance(destination);

				if (available < required) {
					const settlementNeeded =
						(await estimateCryptoAmount(amount, settlement)) * (required / base);
					const settlementAvailable = await getAvailableBalance(settlement);

					if (settlementAvailable < settlementNeeded) {
						throw new Error(
							`Treasury holds ${settlementAvailable.toFixed(2)} ${settlement.toUpperCase()} but this payout needs about ${settlementNeeded.toFixed(2)}. Top up before approving.`
						);
					}

					const minimum = await minConversionAmount(settlement, destination);
					if (minimum > 0 && settlementNeeded < minimum) {
						throw new Error(
							`${destination.toUpperCase()} payouts need at least ${minimum.toFixed(2)} ${settlement.toUpperCase()} to convert; this one is only ${settlementNeeded.toFixed(2)}.`
						);
					}

					const conversion = await createConversion(
						settlement,
						destination,
						Number(settlementNeeded.toFixed(8))
					);

					return prisma.walletRequest.update({
						where: { id: requestId },
						data: {
							providerStatus: 'converting',
							conversionId: conversion.id,
							conversionStatus: conversion.status,
							settleCurrency: settlement,
							settleAmount: Number(settlementNeeded.toFixed(8)),
							reviewNote: `Converting ${settlementNeeded.toFixed(2)} ${settlement.toUpperCase()} to ${destination.toUpperCase()} before sending`
						},
						include: {
							user: { select: { firstName: true, lastName: true, email: true, wallet: true } }
						}
					});
				}
			}

			const payout = await createPayout({
				amountUsd: amount,
				address: request.payoutAddress,
				currency: destination,
				requestId: request.id
			});

			return prisma.walletRequest.update({
				where: { id: requestId },
				data: {
					providerRef: payout.id,
					providerStatus: payout.status
				},
				include: {
					user: { select: { firstName: true, lastName: true, email: true, wallet: true } }
				}
			});
		} catch (error) {
			await prisma.walletRequest.update({
				where: { id: requestId },
				data: {
					status: 'PENDING',
					providerStatus: 'failed',
					reviewNote: error instanceof Error ? error.message : 'Payout failed'
				}
			});
			throw error;
		}
	}

	const approved = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
		const latest = await lockWalletRequest(tx, requestId);

		if (!latest || latest.status !== 'PENDING') {
			throw new Error('Request is no longer pending');
		}

		// An underpaid invoice has already credited whatever arrived, so approving
		// it tops the player up to the invoiced amount rather than paying twice.
		const alreadyCredited = latest.creditedAmount == null ? 0 : money(latest.creditedAmount);
		const owed = Number((money(latest.amount) - alreadyCredited).toFixed(2));
		const toppedUp = owed >= 0.01;

		if (toppedUp) {
			await applyDeposit(latest.userId, owed, tx);
			// The top-up covers the shortfall on the payment that came up short,
			// so it is credited against that payment. Booking it separately would
			// leave the payment still looking owed, and a late callback would then
			// pay the same shortfall a second time.
			const shortfall = await tx.depositPayment.findFirst({
				where: { requestId },
				orderBy: { updatedAt: 'desc' }
			});
			if (shortfall) {
				await tx.depositPayment.update({
					where: { id: shortfall.id },
					data: { creditedAmount: money(shortfall.creditedAmount) + owed }
				});
			} else {
				await tx.depositPayment.create({
					data: {
						requestId,
						paymentId: `legacy:${requestId}`,
						creditedAmount: owed,
						providerStatus: latest.providerStatus
					}
				});
			}
		}

		const request = await tx.walletRequest.update({
			where: { id: requestId },
			data: {
				status: 'APPROVED',
				...(toppedUp
					? { creditedAmount: money(latest.amount), paymentOutcome: 'EXACT' }
					: {}),
				reviewedBy,
				reviewedAt: new Date(),
				reviewNote:
					reviewNote?.trim() ||
					(alreadyCredited > 0
						? `Topped up $${owed.toFixed(2)} to the invoiced amount`
						: null)
			},
			include: {
				user: { select: { firstName: true, lastName: true, email: true, wallet: true } }
			}
		});

		return { request, credited: toppedUp ? owed : 0 };
	}, TX);

	if (approved.request.type === 'DEPOSIT' && approved.credited > 0) {
		try {
			await accrueAffiliateCpa(approved.request.userId, approved.credited);
		} catch (error) {
			console.error('Affiliate CPA accrual failed', error);
		}
	}

	return approved.request;
}

const WITH_PLAYER = {
	user: { select: { firstName: true, lastName: true, email: true, wallet: true } }
} as const;

/**
 * Matches the player site's claim TTL. Inside this window another process may
 * still be mid-submission, so a request with no provider reference yet cannot
 * be assumed abandoned.
 */
const CLAIM_TTL_MS = 5 * 60 * 1000;

/**
 * How long a finished conversion may sit without the player site's payment tick
 * touching it before staff are handed control. That tick runs every minute and
 * stamps the row each time it looks, so silence for this long means it is not
 * running and nothing would ever send the payout.
 */
const TICK_STALL_MS = 30 * 60 * 1000;

/**
 * Writes the terminal outcome of a payout we read back from NOWPayments.
 *
 * Re-checks the status under lock because the IPN can land while we are still
 * talking to the provider; whichever gets there first wins and the other is a
 * no-op, so the player is never paid or refunded twice.
 */
async function finalizeSyncedWithdraw(
	requestId: string,
	reviewedBy: string,
	outcome: 'paid' | 'failed',
	providerStatus: string,
	reviewNote: string
) {
	return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
		const latest = await lockWalletRequest(tx, requestId);

		if (!latest) {
			throw new Error('Request not found');
		}

		if (latest.status === 'APPROVED' || latest.status === 'REJECTED') {
			return tx.walletRequest.findUniqueOrThrow({ where: { id: requestId }, include: WITH_PLAYER });
		}

		if (outcome === 'failed') {
			const wallet = await lockWallet(tx, latest.userId);

			if (wallet) {
				await tx.wallet.update({
					where: { userId: latest.userId },
					data: { heldBalance: Math.max(0, money(wallet.heldBalance) - money(latest.amount)) }
				});
			}

			return tx.walletRequest.update({
				where: { id: requestId },
				data: {
					status: 'REJECTED',
					providerStatus,
					reviewedBy,
					reviewedAt: new Date(),
					reviewNote
				},
				include: WITH_PLAYER
			});
		}

		await applyWithdraw(latest.userId, money(latest.amount), tx);

		return tx.walletRequest.update({
			where: { id: requestId },
			data: {
				status: 'APPROVED',
				providerStatus,
				reviewedBy,
				reviewedAt: new Date(),
				reviewNote
			},
			include: WITH_PLAYER
		});
	}, TX);
}

async function recordSyncProgress(requestId: string, data: Prisma.WalletRequestUpdateInput) {
	return prisma.walletRequest.update({ where: { id: requestId }, data, include: WITH_PLAYER });
}

/**
 * Manual reconciliation for a withdrawal stuck in PROCESSING.
 *
 * Payouts and conversions only reach a terminal state in our database when
 * NOWPayments delivers an IPN. A dropped or rejected callback would otherwise
 * strand the request forever, with the player's balance held and no button that
 * will touch it. This asks the provider what actually happened and writes that
 * down — it never guesses, so it cannot pay out money the provider did not send.
 */
export async function syncWalletRequest(requestId: string, reviewedBy: string) {
	const request = await prisma.walletRequest.findUnique({
		where: { id: requestId },
		include: WITH_PLAYER
	});

	if (!request) {
		throw new Error('Request not found');
	}

	if (request.type !== 'WITHDRAW') {
		throw new Error('Only crypto withdrawals need syncing. Deposits settle from the invoice IPN.');
	}

	if (request.status === 'APPROVED' || request.status === 'REJECTED') {
		throw new Error(`This request is already ${request.status.toLowerCase()}`);
	}

	if (!isPayoutConfigured()) {
		throw new Error('NOWPayments payouts are not configured in admin. Add API key, email, and password first.');
	}

	// A submitted payout is the authoritative record; check it before anything else.
	if (request.providerRef) {
		const payout = await getPayout(request.providerRef);

		if (!payout) {
			return {
				request,
				changed: false,
				message: `NOWPayments has no payout ${request.providerRef}. Escalate before touching this request.`
			};
		}

		if (isPayoutSettled(payout.status)) {
			const updated = await finalizeSyncedWithdraw(
				requestId,
				reviewedBy,
				'paid',
				payout.status,
				payout.hash ? `Payout confirmed on-chain (${payout.hash})` : 'Payout confirmed by NOWPayments'
			);
			return {
				request: updated,
				changed: true,
				message: `Payout finished${payout.hash ? ` (${payout.hash})` : ''}. Balance debited and the hold released.`
			};
		}

		if (isPayoutFailed(payout.status)) {
			const updated = await finalizeSyncedWithdraw(
				requestId,
				reviewedBy,
				'failed',
				payout.status,
				payout.error || `Payout ${payout.status.toLowerCase()} at NOWPayments`
			);
			return {
				request: updated,
				changed: true,
				message: `Payout ${payout.status.toLowerCase()}. The hold was released and the funds are back in the player's balance.`
			};
		}

		const updated = await recordSyncProgress(requestId, { providerStatus: payout.status });

		return {
			request: updated,
			changed: request.providerStatus !== payout.status,
			message: isPayoutUnverified(payout.status)
				? `Payout is still CREATING, which means payout 2FA is on and nothing verified it. Approve or cancel it in the NOWPayments dashboard.`
				: `Payout is ${payout.status} at NOWPayments. Nothing to settle yet.`
		};
	}

	// No payout yet, so a conversion is what this is waiting on.
	if (request.conversionId) {
		const conversion = await getConversion(request.conversionId);

		if (!conversion) {
			return {
				request,
				changed: false,
				message: `NOWPayments has no conversion ${request.conversionId}. Escalate before touching this request.`
			};
		}

		if (isConversionFailed(conversion.status)) {
			const updated = await recordSyncProgress(requestId, {
				status: 'PENDING',
				autoProcessed: false,
				providerStatus: 'needs_review',
				conversionStatus: conversion.status,
				reviewNote: `Treasury conversion ${conversion.status.toLowerCase()} — no payout was sent`
			});
			return {
				request: updated,
				changed: true,
				message: `Conversion ${conversion.status.toLowerCase()}. Back in the queue as pending; no funds left the treasury.`
			};
		}

		if (isConversionSettled(conversion.status)) {
			// The coins are already in the destination wallet, so the only thing
			// left is submitting the payout. That is the tick's job, unless the tick
			// is clearly not running.
			if (Date.now() - request.updatedAt.getTime() > TICK_STALL_MS) {
				const updated = await recordSyncProgress(requestId, {
					status: 'PENDING',
					autoProcessed: false,
					providerStatus: 'needs_review',
					conversionStatus: conversion.status,
					reviewNote: 'Conversion finished but no payout was sent — approve to send it'
				});
				return {
					request: updated,
					changed: true,
					message:
						'Conversion finished, but nothing has processed it for half an hour — check that the payments cron is running. Returned to pending so you can approve it manually.'
				};
			}

			// Already queued, so there is nothing to write. Saving anyway would push
			// updatedAt forward, and that timestamp is the only signal that the tick
			// is alive — pressing Sync twice would then hide a dead scheduler.
			if (request.providerStatus === 'retry' && request.conversionStatus === conversion.status) {
				return {
					request,
					changed: false,
					message: 'Conversion finished and the payout is queued. It goes out on the next tick.'
				};
			}

			// Left in PROCESSING and flagged for retry so the player site's payment
			// tick sends the payout. Returning it to PENDING would drop it out of
			// that queue, which is what used to leave a paid-for conversion sitting
			// in the treasury with no payout behind it.
			const updated = await recordSyncProgress(requestId, {
				status: 'PROCESSING',
				providerStatus: 'retry',
				conversionStatus: conversion.status,
				reviewNote: 'Conversion finished — the payout is sent automatically'
			});
			return {
				request: updated,
				changed: true,
				message: 'Conversion finished. The payout goes out on the next tick, so no action is needed.'
			};
		}

		const updated = await recordSyncProgress(requestId, {
			providerStatus: 'converting',
			conversionStatus: conversion.status
		});
		return {
			request: updated,
			changed: request.conversionStatus !== conversion.status,
			message: `Treasury conversion is ${conversion.status}. Check again shortly.`
		};
	}

	// Neither a payout nor a conversion exists, so nothing was ever submitted and
	// the request is only PROCESSING because a claim was left behind. Wait out the
	// claim window first: another process may be between /payout and writing the
	// reference back, and releasing it now would let staff approve a second payout.
	if (Date.now() - request.updatedAt.getTime() < CLAIM_TTL_MS) {
		return {
			request,
			changed: false,
			message: 'This payout was picked up moments ago and may still be submitting. Try again in a few minutes.'
		};
	}

	const updated = await recordSyncProgress(requestId, {
		status: 'PENDING',
		autoProcessed: false,
		providerStatus: 'needs_review',
		reviewNote: 'No payout reached NOWPayments — safe to approve or reject'
	});

	return {
		request: updated,
		changed: true,
		message: 'Nothing was submitted to NOWPayments. Returned to pending so you can approve or reject it.'
	};
}

export async function rejectWalletRequest(requestId: string, reviewedBy: string, reviewNote?: string) {
	return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
		const request = await lockWalletRequest(tx, requestId);

		if (!request) {
			throw new Error('Request not found');
		}

		if (request.status === 'PROCESSING') {
			throw new Error('This payout is already being sent');
		}

		if (request.status !== 'PENDING') {
			throw new Error('Request is no longer pending');
		}

		if (request.type === 'WITHDRAW') {
			const wallet = await lockWallet(tx, request.userId);

			if (!wallet) {
				throw new Error('Wallet not found');
			}

			const nextHeld = Math.max(0, money(wallet.heldBalance) - money(request.amount));
			await tx.wallet.update({
				where: { userId: request.userId },
				data: { heldBalance: nextHeld }
			});
		}

		return tx.walletRequest.update({
			where: { id: requestId },
			data: {
				status: 'REJECTED',
				reviewedBy,
				reviewedAt: new Date(),
				reviewNote: reviewNote?.trim() || null
			},
			include: {
				user: { select: { firstName: true, lastName: true, email: true, wallet: true } }
			}
		});
	}, TX);
}
