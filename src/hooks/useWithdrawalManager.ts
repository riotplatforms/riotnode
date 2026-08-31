/**
 * useWithdrawalManager — Withdrawal request hook (Rewritten write path)
 * =============================================================================
 * ALL writes (requestReferralWithdrawal / requestStakingRewardWithdrawal /
 * approveWithdrawal / processWithdrawal) go through
 * walletService.sendWalletTransaction() — the unified EIP-1193 path that uses
 * the exact provider + account the wallet connected with, enforces the BSC
 * chain, pre-estimates gas on public RPC, deep-links the wallet app on
 * mobile / TMA, and confirms via public-RPC receipt polling.
 *
 * The old implementation called browserProvider.getSigner() which dispatches
 * eth_requestAccounts — in Telegram Mini App the wallet app is not open to
 * answer, so it hung forever and NO withdrawal transaction was ever created.
 * That is exactly the bug this rewrite fixes.
 *
 * Reads use public BSC RPC nodes with rotation. API surface unchanged.
 */

import { Contract, parseUnits, formatUnits, Interface } from 'ethers';
import { walletService } from '../lib/walletService';
import { CONTRACT_ABI as WITHDRAWAL_MANAGER_ABI } from '../lib/abi';
import { WITHDRAWAL_MANAGER_ADDRESS } from '../lib/contracts';

const WM_IFACE = new Interface(WITHDRAWAL_MANAGER_ABI);

export function useWithdrawalManager() {
    // ─── READ path (public RPC rotation) ────────────────────────────────────
    const callReadOnly = async <T,>(fn: (contract: Contract) => Promise<T>): Promise<T> => {
        let lastErr: any = null;
        for (let attempt = 0; attempt < 4; attempt++) {
            try {
                const provider = walletService.getReadProvider();
                const contract = new Contract(WITHDRAWAL_MANAGER_ADDRESS, WITHDRAWAL_MANAGER_ABI as any, provider);
                return await fn(contract);
            } catch (err) {
                lastErr = err;
                walletService.rotateRpc();
            }
        }
        throw lastErr;
    };

    // ─── WRITE path (unified, via walletService) ────────────────────────────
    const sendWrite = async (functionName: string, args: any[], label: string) => {
        const from = walletService.getTransactionFromAddress();
        if (!from) throw new Error('Wallet connection not ready. Please reconnect your wallet and try again.');
        const data = WM_IFACE.encodeFunctionData(functionName, args);
        const hash = await walletService.sendWalletTransaction({
            to: WITHDRAWAL_MANAGER_ADDRESS,
            data,
            from,
            label,
        });
        return walletService.waitForReceipt(hash);
    };

    // ─── User actions ───────────────────────────────────────────────────────
    const requestReferralWithdrawal = async () => {
        return await sendWrite('requestReferralWithdrawal', [], 'Referral withdrawal request');
    };

    const requestStakingRewardWithdrawal = async (amount: string) => {
        const val = parseUnits(amount, 18);
        return await sendWrite('requestStakingRewardWithdrawal', [val], 'Staking reward withdrawal request');
    };

    // ─── Admin actions ───────────────────────────────────────────────────────
    const approveWithdrawal = async (requestId: number) => {
        return await sendWrite('approveWithdrawal', [requestId], 'Approve withdrawal');
    };

    const processWithdrawal = async (requestId: number) => {
        return await sendWrite('processWithdrawal', [requestId], 'Process withdrawal');
    };

    // ─── Reads ───────────────────────────────────────────────────────────────
    const getPendingRequestsCount = async () => {
        const count = await callReadOnly(async (contract) => await contract.getPendingRequestsCount());
        return Number(count);
    };

    const getUserRequests = async (userAddress: string) => {
        const requests = await callReadOnly(async (contract) => await contract.getUserRequests(userAddress));
        return requests.map((id: any) => Number(id));
    };

    const getWithdrawalRequest = async (requestId: number) => {
        const request = await callReadOnly(async (contract) => await contract.withdrawalRequests(requestId));
        return {
            user: request.user,
            amount: formatUnits(request.amount, 18),
            requestTime: Number(request.requestTime),
            approved: request.approved,
            processed: request.processed,
            withdrawalType: request.withdrawalType,
        };
    };

    const hasCompletedStakingCycle = async (userAddress: string) => {
        return await callReadOnly(async (contract) => await contract.hasCompletedStakingCycle(userAddress));
    };

    const getMatureStakingRewards = async (userAddress: string) => {
        const rewards = await callReadOnly(async (contract) => await contract.getMatureStakingRewards(userAddress));
        return formatUnits(rewards, 18);
    };

    const getTotalStakingRewardsWithdrawn = async (userAddress: string) => {
        const withdrawn = await callReadOnly(async (contract) => await contract.totalStakingRewardsWithdrawn(userAddress));
        return formatUnits(withdrawn, 18);
    };

    const getTotalReferralRewardsWithdrawn = async (userAddress: string) => {
        const withdrawn = await callReadOnly(async (contract) => await contract.totalReferralRewardsWithdrawn(userAddress));
        return formatUnits(withdrawn, 18);
    };

    return {
        requestReferralWithdrawal,
        requestStakingRewardWithdrawal,
        approveWithdrawal,
        processWithdrawal,
        getPendingRequestsCount,
        getUserRequests,
        getWithdrawalRequest,
        hasCompletedStakingCycle,
        getMatureStakingRewards,
        getTotalStakingRewardsWithdrawn,
        getTotalReferralRewardsWithdrawn
    };
}
