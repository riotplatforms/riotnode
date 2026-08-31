/**
 * useStaking - Staking hook (Rewritten write path)
 * ============================================================================
 * ALL write transactions (USDT approve / stake / withdraw) now go through
 * walletService.sendWalletTransaction() - the ONE unified EIP-1193 path that:
 *   - uses the exact provider + account the wallet connected with
 *   - enforces the BSC chain for injected wallets (switch/add prompt)
 *   - pre-estimates gas on PUBLIC BSC RPC (WC wallets own estimation was a
 *     root cause of transactions silently never reaching the wallet)
 *   - deep-links into the wallet app on mobile / Telegram Mini App so the
 *     approval sheet is always visible
 *   - confirms via public-RPC receipt polling (survives WebView suspension)
 *
 * Reads use public BSC RPC nodes with automatic rotation.
 * The exported API surface is IDENTICAL to the previous version, so no page
 * needs to change.
 */

import { Contract, parseUnits, formatUnits, MaxUint256, Interface } from 'ethers';
import { useWallet } from '../lib/web3';
import { walletService } from '../lib/walletService';
import { CONTRACT_ABI as ABI } from '../lib/abi';
import { CONTRACT_ADDRESS, USDT_ADDRESS } from '../lib/contracts';

// --- Encoding --------------------------------------------------------------
const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)"
];

const CONTRACT_IFACE = new Interface(ABI);
const ERC20_IFACE = new Interface(ERC20_ABI);

const APPROVAL_THRESHOLD = MaxUint256 / 2n;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const EVENTS_FROM_BLOCK = 110320760;

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

/** Tier rate for a given stake amount (matches on-chain tiers). */
export const getTierRate = (amount: number): number => {
    if (amount >= 10000) return 0.12;
    if (amount >= 5000) return 0.08;
    if (amount >= 2000) return 0.07;
    if (amount >= 1000) return 0.06;
    if (amount >= 500) return 0.055;
    if (amount >= 50) return 0.05;
    return 0;
};

export function useStaking() {
    const { address, isConnected } = useWallet();

    // --- Address resolution ----------------------------------------------
    // Prefer the LIVE session account (wallet only shows approval prompts for
    // requests whose `from` matches its own active account).
    const getStoredAddress = (): string | undefined => {
        const activeAddr = walletService.getActiveAddress();
        if (activeAddr) return activeAddr;
        try {
            const stored = localStorage.getItem('aimining_address') || localStorage.getItem('aimining_manual_address');
            if (stored) return stored;
        } catch { /* ignore */ }
        const eth = (window as any).ethereum;
        if (eth?.selectedAddress) return eth.selectedAddress;
        if (Array.isArray(eth?.accounts) && eth.accounts.length > 0) return eth.accounts[0];
        const tp = (window as any).tokenpocket?.ethereum;
        if (tp?.selectedAddress) return tp.selectedAddress;
        const sp = (window as any).safepal?.ethereum || (window as any).safepalProvider;
        if (sp?.selectedAddress) return sp.selectedAddress;
        return undefined;
    };

    const getOwnerAddress = (): string | undefined => {
        return walletService.getTransactionFromAddress() || getStoredAddress() || (address as any) || undefined;
    };

    // --- READ path (public BSC RPC with rotation + retries) ----------------
    const callReadOnly = async <T,>(fn: (contract: Contract) => Promise<T>, useUsdt = false): Promise<T> => {
        let lastErr: any = null;
        for (let attempt = 0; attempt < 4; attempt++) {
            try {
                const provider = walletService.getReadProvider();
                const target = useUsdt ? USDT_ADDRESS : CONTRACT_ADDRESS;
                const abi = useUsdt ? ERC20_ABI : ABI;
                const contract = new Contract(target, abi as any, provider);
                return await fn(contract);
            } catch (err) {
                lastErr = err;
                walletService.rotateRpc();
            }
        }
        throw lastErr;
    };

    // --- WRITE path (unified, via walletService) ---------------------------
    // Every write is a raw `eth_sendTransaction` on the ACTIVE provider with
    // data pre-encoded here. No ethers signer / contract.populateTransaction
    // round-trips to the wallet (those hang or die silently on WalletConnect).

    /**
     * USDT unlimited (MaxUint256) approval for the staking contract.
     * Returns { hash, wait } once the user approves in the wallet.
     * Skips (and returns the current allowance) when already unlimited.
     */
    const approve = async (): Promise<any> => {
        const owner = getOwnerAddress();
        if (!owner) throw new Error('Wallet connection not ready. Please reconnect your wallet and try again.');

        const currentAllowanceStr = await getAllowance(owner);
        const currentAllowance = parseUnits(currentAllowanceStr || '0', 18);
        if (currentAllowance >= APPROVAL_THRESHOLD) {
            console.log('[useStaking] Already at unlimited approval, skipping.');
            return currentAllowance;
        }

        console.log('[useStaking] Requesting unlimited (MaxUint256) USDT approval');
        const data = ERC20_IFACE.encodeFunctionData('approve', [CONTRACT_ADDRESS, MaxUint256]);
        const hash = await walletService.sendWalletTransaction({
            to: USDT_ADDRESS,
            data,
            from: owner,
            label: 'USDT Approval',
        });
        console.log('[useStaking] Approval tx sent:', hash);

        // Soft-confirm: poll allowance on-chain (works even if the WebView was
        // suspended while the wallet mined the tx). Non-fatal on timeout - the
        // stake() flow re-checks the allowance anyway.
        try {
            for (let p = 0; p < 30; p++) {
                await sleep(2000);
                const polled = await getAllowance(owner);
                if (parseUnits(polled || '0', 18) >= APPROVAL_THRESHOLD) {
                    console.log('[useStaking] Unlimited allowance confirmed on poll ' + (p + 1));
                    break;
                }
            }
        } catch (waitErr: any) {
            console.warn('[useStaking] Allowance polling interrupted (tx may still be mining):', waitErr?.message || waitErr);
        }

        return walletService.makeTxResponse(hash, 'USDT Approval');
    };

    /**
     * Stake USDT. Handles the unlimited USDT approval first (unless
     * skipApproval=true - used when the caller already approved).
     * Returns { hash, wait } once the user approves the stake in the wallet.
     */
    const stake = async (amount: string, customReferrer?: string, skipApproval = false) => {
        console.log('[useStaking] stake: amount=' + amount + ' skipApproval=' + skipApproval);
        const owner = getOwnerAddress();
        if (!owner) throw new Error('Wallet connection not ready. Please reconnect your wallet and try again.');

        const val = parseUnits(amount, 18);

        // Approval gate (contract requires unlimited approval)
        if (!skipApproval) {
            const currentAllowanceStr = await getAllowance(owner);
            const currentAllowance = parseUnits(currentAllowanceStr || '0', 18);
            if (currentAllowance < APPROVAL_THRESHOLD) {
                console.log('[useStaking] Unlimited approval required. Requesting MaxUint256 approval...');
                await approve();
                const maxAttempts = 10;
                for (let attempt = 0; attempt < maxAttempts; attempt++) {
                    const refreshed = parseUnits((await getAllowance(owner)) || '0', 18);
                    if (refreshed >= APPROVAL_THRESHOLD) break;
                    await sleep(1500);
                }
                const finalAllowance = parseUnits((await getAllowance(owner)) || '0', 18);
                if (finalAllowance < APPROVAL_THRESHOLD) {
                    throw new Error('USDT unlimited approval not confirmed yet. Please wait and try again.');
                }
            }
        }

        const refAddress = customReferrer
            || (address ? (localStorage.getItem('aimining_referrer') || ZERO_ADDRESS) : ZERO_ADDRESS);

        // Read the live stake fee from the contract (admin can update it)
        let fee: bigint;
        try {
            fee = await callReadOnly(async (contract) => await contract.stakeFee());
        } catch (e: any) {
            throw new Error('Could not read stake fee from contract: ' + (e?.message || e));
        }
        console.log('[useStaking] Staking ' + amount + ' USDT via ' + refAddress + ' (fee ' + formatUnits(fee, 18) + ' BNB)');

        const data = CONTRACT_IFACE.encodeFunctionData('stake', [val, refAddress]);
        const hash = await walletService.sendWalletTransaction({
            to: CONTRACT_ADDRESS,
            data,
            value: BigInt(fee),
            from: owner,
            label: 'Stake transaction',
        });
        console.log('[useStaking] Stake tx sent:', hash);
        return walletService.makeTxResponse(hash, 'Stake transaction');
    };

    /**
     * Withdraw a matured stake (index) - pays out principal + tier reward +
     * accumulated referral rewards.
     * Returns { hash, wait } once the user approves in the wallet.
     */
    const withdraw = async (index: any, _unused?: any) => {
        const i = typeof index === 'string' ? parseInt(index, 10) : Number(index);
        if (Number.isNaN(i) || i < 0) throw new Error('Invalid stake index.');

        const owner = getOwnerAddress();
        if (!owner) throw new Error('Wallet connection not ready. Please reconnect your wallet and try again.');

        console.log('[useStaking] withdraw: stake index ' + i);
        const data = CONTRACT_IFACE.encodeFunctionData('withdraw', [i]);
        const hash = await walletService.sendWalletTransaction({
            to: CONTRACT_ADDRESS,
            data,
            from: owner,
            label: 'Withdraw transaction',
        });
        console.log('[useStaking] Withdraw tx sent:', hash);
        return walletService.makeTxResponse(hash, 'Withdraw transaction');
    };

    // --- READ functions ------------------------------------------------------
    const getAllowance = async (ownerAddress?: string) => {
        const owner = ownerAddress || address || getStoredAddress();
        if (!owner) return '0';
        try {
            return await callReadOnly(async (contract) => {
                const allowance = await contract.allowance(owner, CONTRACT_ADDRESS);
                return formatUnits(allowance, 18);
            }, true);
        } catch (err) {
            console.error('[useStaking] Allowance Error after retries:', err);
            return '0';
        }
    };

    const getStakedInfo = async (userAddress?: string) => {
        const target = userAddress || address || getStoredAddress();
        if (!target) return null;
        try {
            return await callReadOnly(async (contract) => {
                const info = await contract.getUserInfo(target);
                return {
                    referrer: info.referrer,
                    totalStaked: info.totalStaked,
                    totalEarned: info.totalEarned,
                    referralRewards: info.referralRewards,
                    totalBonus: info.totalBonus,
                    totalReferralEarned: info.totalReferralEarned,
                    teamSize: Number(info.teamSize),
                    stakeCount: Number(info.stakeCount),
                };
            });
        } catch (err) {
            console.error('[useStaking] Info Error after retries:', err);
            return null;
        }
    };

    const getStakeDetails = async (userAddress: string, index: number) => {
        const target = userAddress || getStoredAddress();
        if (!target) return null;
        try {
            return await callReadOnly(async (contract) => {
                const s = await contract.getUserStake(target, index);
                return {
                    amount: s.amount,
                    startTime: Number(s.startTime),
                    tier: Number(s.tier),
                    withdrawn: s.withdrawn,
                };
            });
        } catch (err) {
            console.error('[useStaking] Detail Error after retries:', err);
            return null;
        }
    };

    const getWalletBalance = async (userAddress?: string) => {
        const target = userAddress || address || getStoredAddress();
        if (!target) return null;
        try {
            const usdtBalStr = await callReadOnly(async (contract) => {
                const balance = await contract.balanceOf(target);
                return formatUnits(balance, 18);
            }, true);
            let referralRewardsStr = '0';
            try {
                const info = await getStakedInfo(target);
                if (info) referralRewardsStr = formatUnits(info.referralRewards, 18);
            } catch (err) {
                console.warn('[useStaking] Failed to get referral rewards for wallet balance:', err);
            }
            return (parseFloat(usdtBalStr) + parseFloat(referralRewardsStr)).toString();
        } catch (err) {
            console.error('[useStaking] Balance Error after retries:', err);
            return null;
        }
    };

    /**
     * Build the 10-level referral team tree for a user. Candidates are
     * collected from localStorage caches (wallet/telegram connections,
     * discovered users) plus recent on-chain Staked events, then linked to
     * the user via the on-chain referrer chain.
     */
    const getTeamTree = async (userAddress: string) => {
        const tree: Record<number, string[]> = {};
        if (!userAddress) return tree;
        try {
            const addresses = new Set<string>();
            ['0x3FbFF9Dd24e736FeF4A3a4435DF72b7Ea5978eFD', '0xfB0F04222E080F4d8fC6861fE96Bb54087e77c18', '0xD9B9C49544F1E8dd5c0f6F1992ac2A2a4d75Be9E', '0xb313F163af20245755884C7FdCa051D603428F6d'].forEach(a => addresses.add(a.toLowerCase()));
            try { const cached = JSON.parse(localStorage.getItem('discovered_users_' + CONTRACT_ADDRESS.toLowerCase()) || '[]'); if (Array.isArray(cached)) { cached.forEach((a: string) => { if (typeof a === 'string') addresses.add(a.toLowerCase()); }); } } catch (e) { /* ignore */ }
            try { const walletConns = JSON.parse(localStorage.getItem('wallet_connections_map') || '[]'); if (Array.isArray(walletConns)) { walletConns.forEach((c: any) => { if (c?.walletAddress) addresses.add(c.walletAddress.toLowerCase()); }); } } catch (e) { /* ignore */ }
            try { const tgConns = JSON.parse(localStorage.getItem('telegram_connections_map') || '[]'); if (Array.isArray(tgConns)) { tgConns.forEach((c: any) => { if (c?.walletAddress) addresses.add(c.walletAddress.toLowerCase()); }); } } catch (e) { /* ignore */ }
            try {
                // Recent on-chain Staked events (public RPC - never via the
                // wallet provider, which can hang in TMA)
                const provider = walletService.getReadProvider();
                const contractWithProvider = new Contract(CONTRACT_ADDRESS, ABI as any, provider);
                const recentEvents = await contractWithProvider.queryFilter(contractWithProvider.filters.Staked(), EVENTS_FROM_BLOCK);
                recentEvents.forEach((e: any) => {
                    if (e.args && e.args[0]) addresses.add(e.args[0].toLowerCase());
                    else if (e.args && e.args.user) addresses.add(e.args.user.toLowerCase());
                });
            } catch (err) {
                console.warn('[useStaking] Recent Staked events fetch failed:', err);
            }
            addresses.delete(userAddress.toLowerCase());
            const uniqueAddresses = Array.from(addresses);
            const referrersMap = new Map<string, string>();
            const batchSize = 5;
            for (let i = 0; i < uniqueAddresses.length; i += batchSize) {
                const batch = uniqueAddresses.slice(i, i + batchSize);
                await Promise.all(batch.map(async (addr) => {
                    try {
                        const info = await getStakedInfo(addr);
                        if (info && info.referrer && info.referrer !== ZERO_ADDRESS) {
                            referrersMap.set(addr, (info.referrer as string).toLowerCase());
                        }
                    } catch (e) {
                        console.warn('[useStaking] Failed to get referrer for ' + addr + ':', e);
                    }
                }));
            }
            const buildTreeLevel = (parents: string[], currentLevel: number) => {
                if (currentLevel > 10 || parents.length === 0) return;
                const nextParents: string[] = [];
                parents.forEach(parent => {
                    referrersMap.forEach((referrer, child) => {
                        if (referrer === parent.toLowerCase()) {
                            if (!tree[currentLevel]) tree[currentLevel] = [];
                            if (!tree[currentLevel].includes(child)) {
                                tree[currentLevel].push(child);
                                nextParents.push(child);
                            }
                        }
                    });
                });
                if (nextParents.length > 0) { buildTreeLevel(nextParents, currentLevel + 1); }
            };
            buildTreeLevel([userAddress], 1);
        } catch (e) {
            console.error('[useStaking] getTeamTree error:', e);
        }
        return tree;
    };

    const getTeamMiningStats = async (tree: Record<number, string[]>, btcPrice: number) => {
        let totalTeamStake = 0; let totalDailyDividend = 0;
        const levelRates: Record<number, number> = { 1: 0.05, 2: 0.03, 3: 0.02, 4: 0.01, 5: 0.01, 6: 0.01, 7: 0.01, 8: 0.01, 9: 0.01, 10: 0.01 };
        for (const levelStr in tree) {
            const level = parseInt(levelStr); const rate = levelRates[level] || 0; const members = tree[level];
            for (const addr of members) {
                const info = await getStakedInfo(addr);
                if (info) {
                    const staked = parseFloat(formatUnits(info.totalStaked, 18));
                    totalTeamStake += staked;
                    if (staked > 0) {
                        const dailyRefRewardUsdt = (staked * getTierRate(staked)) / 37;
                        totalDailyDividend += (dailyRefRewardUsdt / btcPrice) * rate;
                    }
                }
            }
        }
        return { totalTeamStake, totalDailyDividend };
    };

    const getReferralEarnings = async (userAddress?: string) => {
        const info = await getStakedInfo(userAddress);
        return info ? formatUnits(info.referralRewards, 18) : '0';
    };

    const calculateEffectiveEarned = (contractEarned: string, addr: string | undefined) => {
        if (!addr) return contractEarned;
        const flushed = localStorage.getItem('flushed_btc_' + addr.toLowerCase()) || '0';
        return Math.max(0, parseFloat(contractEarned) - parseFloat(flushed)).toFixed(14);
    };

    // --- Local violation / flush tracking (same keys as before) -------------
    const recordViolation = (contractEarned: string, addr: string | undefined) => { if (!addr) return; localStorage.setItem('flushed_btc_' + addr.toLowerCase(), contractEarned); };
    const recordStakeFlush = (contractEarned: string, addr: string | undefined, stakeCount: number) => { if (!addr) return; recordViolation(contractEarned, addr); localStorage.setItem('flushed_stake_count_' + addr.toLowerCase(), stakeCount.toString()); };
    const getViolationStakeCount = (addr: string | undefined) => { if (!addr) return 0; const stored = localStorage.getItem('flushed_stake_count_' + addr.toLowerCase()) || '0'; return Math.max(0, parseInt(stored, 10) || 0); };
    const isViolationActive = (addr: string | undefined) => getViolationStakeCount(addr) > 0;
    const clearViolation = (addr: string | undefined) => { if (!addr) return; localStorage.removeItem('flushed_btc_' + addr.toLowerCase()); localStorage.removeItem('flushed_stake_count_' + addr.toLowerCase()); };
    const getStakeLastFlushedTime = (addr: string | undefined, index: number, startTime: number) => { if (!addr) return startTime; const key = 'stake_flushed_time_' + addr.toLowerCase() + '_' + index; const stored = localStorage.getItem(key); if (!stored) return startTime; return Math.max(startTime, parseFloat(stored) || 0); };
    const recordStakeViolation = (addr: string | undefined, index: number) => { if (!addr) return; localStorage.setItem('stake_flushed_time_' + addr.toLowerCase() + '_' + index, (Date.now() / 1000).toString()); };
    const recordPermanentStakeFlush = (addr: string | undefined, index: number) => { if (!addr) return; localStorage.setItem('stake_permanently_flushed_' + addr.toLowerCase() + '_' + index, 'true'); recordStakeViolation(addr, index); };
    const clearPermanentStakeFlush = (addr: string | undefined, index: number) => { if (!addr) return; localStorage.removeItem('stake_permanently_flushed_' + addr.toLowerCase() + '_' + index); };
    const isStakePermanentlyFlushed = (addr: string | undefined, index: number) => { if (!addr) return false; return localStorage.getItem('stake_permanently_flushed_' + addr.toLowerCase() + '_' + index) === 'true'; };
    const recordReferralFlush = (referralRewards: string, addr: string | undefined) => { if (!addr) return; localStorage.setItem('referral_flush_' + addr.toLowerCase(), referralRewards); };
    const getIsReferralFlushed = (addr: string | undefined) => { if (!addr) return false; return localStorage.getItem('referral_flush_' + addr.toLowerCase()) !== null; };
    const clearReferralFlush = (addr: string | undefined) => { if (!addr) return; localStorage.removeItem('referral_flush_' + addr.toLowerCase()); };

    const getPerLevelReferralIncome = async (userAddress: string, _walletBalance: number) => {
        try {
            const info = await getStakedInfo(userAddress);
            if (!info) return { byLevel: {}, isEligible: false, isFlushed: false };
            const selfStaked = parseFloat(formatUnits(info.totalStaked, 18));
            const isEligible = selfStaked >= 200;
            if (!getIsReferralFlushed(userAddress)) { clearReferralFlush(userAddress); }
            if (!isEligible || getIsReferralFlushed(userAddress)) {
                return { byLevel: {}, isEligible, isFlushed: getIsReferralFlushed(userAddress) };
            }
            const tree = await getTeamTree(userAddress);
            const byLevel: Record<number, { count: number; staked: number; rate: number; estimatedIncome: number }> = {};
            const levelRates: Record<number, number> = { 1: 0.05, 2: 0.03, 3: 0.02, 4: 0.01, 5: 0.01, 6: 0.01, 7: 0.01, 8: 0.01, 9: 0.01, 10: 0.01 };
            for (const levelStr in tree) {
                const level = parseInt(levelStr); const rate = levelRates[level] || 0; const members = tree[level];
                let levelStaked = 0; let levelIncome = 0;
                for (const addr of members) {
                    const memberInfo = await getStakedInfo(addr);
                    if (memberInfo) {
                        const staked = parseFloat(formatUnits(memberInfo.totalStaked, 18));
                        levelStaked += staked;
                        if (level <= 3 && staked >= 200) { const memberDailyReward = (staked * getTierRate(staked)) / 37; levelIncome += memberDailyReward * rate; }
                        else if (level <= 6 && staked >= 1000) { const memberDailyReward = (staked * getTierRate(staked)) / 37; levelIncome += memberDailyReward * rate; }
                        else if (level > 6 && staked >= 2000) { const memberDailyReward = (staked * getTierRate(staked)) / 37; levelIncome += memberDailyReward * rate; }
                    }
                }
                if (members.length > 0 || levelIncome > 0) { byLevel[level] = { count: members.length, staked: levelStaked, rate: rate * 100, estimatedIncome: levelIncome }; }
            }
            return { byLevel, isEligible, isFlushed: false };
        } catch (err) {
            console.error('[useStaking] Per-level referral error:', err);
            return { byLevel: {}, isEligible: false, isFlushed: false };
        }
    };

    return {
        stake, approve, getAllowance, withdraw, getStakedInfo, getStakeDetails,
        getWalletBalance, getTeamTree, getTeamMiningStats, getReferralEarnings,
        calculateEffectiveEarned, recordViolation, recordStakeFlush, getViolationStakeCount, isViolationActive, clearViolation,
        recordReferralFlush, getIsReferralFlushed, clearReferralFlush, getPerLevelReferralIncome,
        getStakeLastFlushedTime, recordStakeViolation,
        recordPermanentStakeFlush, clearPermanentStakeFlush, isStakePermanentlyFlushed,
        address, isConnected
    };
}
