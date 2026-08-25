import type { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/db';
import { money } from '@/lib/money';
import { accrueAffiliateCpa } from '@/lib/affiliates';
import { createPayout, isPayoutConfigured } from '@/lib/payments/nowpayments';

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
		const wallet = await client.wallet.findUnique({ where: { userId } });

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

		return { balance: availableBalance({ balance: next, heldBalance: wallet.heldBalance }), currency: wallet.currency };
	};

	if (tx) {
		return run(tx);
	}

	const result = await prisma.$transaction(run);

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
		const wallet = await client.wallet.findUnique({ where: { userId } });

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

	return prisma.$transaction(run);
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

		try {
			const payout = await createPayout({
				amountUsd: amount,
				address: request.payoutAddress,
				currency: request.payCurrency || process.env.NOWPAYMENTS_PAYOUT_CURRENCY || 'usdttrc20',
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
		const latest = await tx.walletRequest.findUnique({ where: { id: requestId } });

		if (!latest || latest.status !== 'PENDING') {
			throw new Error('Request is no longer pending');
		}

		await applyDeposit(latest.userId, money(latest.amount), tx);

		return tx.walletRequest.update({
			where: { id: requestId },
			data: {
				status: 'APPROVED',
				reviewedBy,
				reviewedAt: new Date(),
				reviewNote: reviewNote?.trim() || null
			},
			include: {
				user: { select: { firstName: true, lastName: true, email: true, wallet: true } }
			}
		});
	});

	if (approved.type === 'DEPOSIT') {
		try {
			await accrueAffiliateCpa(approved.userId, money(approved.amount));
		} catch (error) {
			console.error('Affiliate CPA accrual failed', error);
		}
	}

	return approved;
}

export async function rejectWalletRequest(requestId: string, reviewedBy: string, reviewNote?: string) {
	return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
		const request = await tx.walletRequest.findUnique({ where: { id: requestId } });

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
			const wallet = await tx.wallet.findUnique({ where: { userId: request.userId } });

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
	});
}
