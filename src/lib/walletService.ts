/**
 * walletService - Unified Wallet & Transaction Service (Single Source of Truth)
 * =============================================================================
 * One place that owns:
 *   - the currently ACTIVE EIP-1193 provider + account (registered by web3.tsx
 *     whenever the wallet connects, on every environment: Telegram Mini App,
 *     mobile browsers, in-wallet dApp browsers, desktop)
 *   - BSC chain enforcement for injected wallets (switch / add)
 *   - public-RPC gas pre-estimation (wallets own eth_estimateGas via
 *     WalletConnect often fails or hangs - that is a root cause of
 *     "wallet opens but no transaction popup appears")
 *   - sendWalletTransaction() - the ONE write path used by staking,
 *     approvals, withdrawals, withdrawal requests and admin actions
 *   - waitForReceipt() - receipt polling via public BSC RPC so tx
 *     confirmation survives Telegram WebView suspension / page reloads
 *   - wallet deep-links so the approval sheet is always visible on mobile
 */

import { JsonRpcProvider, FetchRequest } from 'ethers';

// ---------------------------------------------------------------------------
// Environment / chain constants
// ---------------------------------------------------------------------------

export const BSC_CHAIN_ID_HEX = '0x38';
export const BSC_CHAIN_ID_DEC = 56;

export const BSC_RPC_NODES = [
    'https://bsc-rpc.publicnode.com',
    'https://bsc-dataseed.binance.org',
    'https://bsc-dataseed1.binance.org',
    'https://binance.llamarpc.com',
    'https://bsc.meowrpc.com',
];

const BSC_ADD_CHAIN_PARAMS = {
    chainId: BSC_CHAIN_ID_HEX,
    chainName: 'BNB Smart Chain',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpcUrls: ['https://bsc-rpc.publicnode.com'],
    blockExplorerUrls: ['https://bscscan.com'],
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const sleep = (ms: number): Promise<void> => new Promise((res) => setTimeout(res, ms));

export function withTimeout<T>(promise: Promise<T>, ms: number, label = 'operation'): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(label + ' timed out after ' + ms + 'ms')), ms);
        promise.then(
            (v) => { clearTimeout(timer); resolve(v); },
            (e) => { clearTimeout(timer); reject(e); },
        );
    });
}

export function isTelegramWebApp(): boolean {
    try { return !!(window as any).Telegram?.WebApp; } catch { return false; }
}

export function isMobileUA(): boolean {
    try {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    } catch { return false; }
}

// ---------------------------------------------------------------------------
// Active connection registry
// ---------------------------------------------------------------------------

export interface ActiveConnection {
    provider: any;          // EIP-1193 provider (injected or WalletConnect)
    address: string;        // connected account
    walletType: string;     // 'metamask' | 'trust' | ... | 'walletconnect'
    isWalletConnect: boolean;
}

let active: ActiveConnection | null = null;

export function setActiveConnection(
    provider: any,
    address: string,
    walletType: string = 'wallet',
    isWalletConnect: boolean = false,
): void {
    if (!provider || !address) return;
    active = { provider, address, walletType, isWalletConnect };
    try {
        localStorage.setItem('aimining_address', address);
        localStorage.setItem('aimining_wallet_type', walletType);
        localStorage.setItem('aimining_is_walletconnect', isWalletConnect ? 'true' : 'false');
        (window as any).__walletServiceActive = active;
    } catch { /* storage unavailable - ignore */ }
    console.log('[walletService] Active connection: ' + walletType + ' (' + (isWalletConnect ? 'WalletConnect' : 'injected') + ') -> ' + address);
}

export function clearActiveConnection(): void {
    active = null;
    try {
        (window as any).__walletServiceActive = null;
        localStorage.removeItem('aimining_address');
        localStorage.removeItem('aimining_manual_address');
        localStorage.removeItem('aimining_is_walletconnect');
    } catch { /* ignore */ }
    console.log('[walletService] Active connection cleared');
}

export function getActiveProvider(): any | null {
    if (active?.provider) return active.provider;
    // Fallback: a connected injected provider (dApp browsers)
    return getInjectedProvider();
}

export function getActiveAddress(): string | null {
    if (active) return getProviderAccount(active.provider) || active.address;
    try {
        return localStorage.getItem('aimining_address') || localStorage.getItem('aimining_manual_address') || null;
    } catch { return null; }
}

export function getActiveWalletType(): string {
    if (active?.walletType) return active.walletType;
    try { return localStorage.getItem('aimining_wallet_type') || 'wallet'; } catch { return 'wallet'; }
}

export function isWalletConnectActive(): boolean {
    if (active) return active.isWalletConnect;
    try { return localStorage.getItem('aimining_is_walletconnect') === 'true'; } catch { return false; }
}

/** Extract the connected account from any provider shape (injected / WC / AppKit). */
export function getProviderAccount(provider: any): string | null {
    if (!provider) return null;
    try {
        if (Array.isArray(provider.accounts) && provider.accounts.length > 0) return provider.accounts[0];
        if (provider.selectedAddress) return provider.selectedAddress;
        const nsAcct = provider.session?.namespaces?.eip155?.accounts?.[0];
        if (nsAcct) {
            const parts = String(nsAcct).split(':');
            if (parts.length === 3 && parts[2]) return parts[2];
        }
        if (provider.address) return provider.address;
    } catch { /* ignore */ }
    return null;
}

/** Best-effort resolution of the account that should sign the next transaction. */
export function getTransactionFromAddress(): string | null {
    const fromActive = active ? getProviderAccount(active.provider) || active.address : null;
    if (fromActive) return fromActive;
    const injected = getInjectedProvider();
    if (injected) {
        const acct = getProviderAccount(injected);
        if (acct) return acct;
    }
    try {
        return localStorage.getItem('aimining_address') || localStorage.getItem('aimining_manual_address') || null;
    } catch { return null; }
}

// ---------------------------------------------------------------------------
// Injected provider discovery (EIP-6963 + legacy window flags)
// ---------------------------------------------------------------------------

const eip6963Providers: Array<{ info: any; provider: any }> = [];
if (typeof window !== 'undefined') {
    try {
        (window as any).addEventListener('eip6963:announceProvider', (e: any) => {
            if (e?.detail?.provider && !eip6963Providers.some((p) => p.info?.uuid === e.detail.info?.uuid)) {
                eip6963Providers.push(e.detail);
            }
        });
        (window as any).dispatchEvent(new Event('eip6963:requestProvider'));
    } catch { /* ignore */ }
}

const EIP6963_MATCHERS: Record<string, (info: any) => boolean> = {
    metamask: (i) => i?.rdns === 'io.metamask' || /metamask/i.test(i?.name || ''),
    trust: (i) => i?.rdns === 'com.trustwallet.app' || /trust/i.test(i?.name || ''),
    safepal: (i) => i?.rdns === 'io.safepal' || /safepal/i.test(i?.name || ''),
    tokenpocket: (i) => i?.rdns === 'pro.tokenpocket' || /tokenpocket/i.test(i?.name || ''),
    binance: (i) => i?.rdns === 'com.binance.wallet' || /binance/i.test(i?.name || ''),
    okx: (i) => i?.rdns === 'com.okex.wallet' || /okex|okx/i.test(i?.name || ''),
    bitget: (i) => i?.rdns === 'com.bitget.web3' || /bitget/i.test(i?.name || ''),
};

function find6963(walletType: string): any | null {
    const matcher = EIP6963_MATCHERS[walletType];
    if (!matcher) return null;
    const hit = eip6963Providers.find((p) => { try { return matcher(p.info); } catch { return false; } });
    return hit?.provider || null;
}

/** True when the page is running inside a wallet own dApp browser. */
export function isInsideWalletBrowser(): boolean {
    return !!getInjectedProvider();
}

/**
 * Locate an injected EIP-1193 provider, optionally for a specific wallet.
 * Returns null in plain mobile browsers / Telegram (no injection there -
 * those environments use WalletConnect instead).
 */
export function getInjectedProvider(walletType?: string): any | null {
    if (typeof window === 'undefined') return null;
    const w = window as any;

    if (walletType) {
        // EIP-6963 first (multi-wallet desktop browsers)
        const via6963 = find6963(walletType);
        if (via6963) return via6963;
        // Legacy flags
        switch (walletType) {
            case 'metamask': {
                const e = w.ethereum;
                if (e?.isMetaMask) return e;
                if (Array.isArray(e?.providers)) { const m = e.providers.find((p: any) => p?.isMetaMask); if (m) return m; }
                break;
            }
            case 'trust': {
                const e = w.ethereum;
                if (e?.isTrust || e?.isTrustWallet) return e;
                if (Array.isArray(e?.providers)) { const t = e.providers.find((p: any) => p?.isTrust || p?.isTrustWallet); if (t) return t; }
                if (w.trustwallet?.ethereum) return w.trustwallet.ethereum;
                break;
            }
            case 'safepal': {
                const sp = w.safepal?.ethereum || w.safepalProvider || w.safepal;
                if (sp) return sp;
                if (w.ethereum?.isSafePal) return w.ethereum;
                break;
            }
            case 'tokenpocket': {
                const tp = w.tokenpocket?.ethereum || w.tokenpocket;
                if (tp) return tp;
                if (w.ethereum?.isTokenPocket) return w.ethereum;
                break;
            }
            case 'binance': {
                const bc = w.BinanceChain || (w.ethereum?.isBinance ? w.ethereum : null);
                if (bc) return bc;
                break;
            }
            case 'okx': {
                const ok = w.okxwallet || (w.ethereum?.isOkxWallet ? w.ethereum : null);
                if (ok) return ok;
                break;
            }
            case 'bitget': {
                const bg = w.bitget?.ethereum || (w.ethereum?.isBitKeep ? w.ethereum : null);
                if (bg) return bg;
                break;
            }
        }
        return null;
    }

    // Generic: any injected provider
    if (w.ethereum) return w.ethereum;
    return null;
}

// ---------------------------------------------------------------------------
// Wallet deep-links (so the approval sheet is reachable on mobile / TMA)
// ---------------------------------------------------------------------------

export const WALLET_OPEN_LINKS: Record<string, string> = {
    metamask: 'https://metamask.app.link/',
    trust: 'https://link.trustwallet.com/',
    safepal: 'https://link.safepal.io/',
    tokenpocket: 'https://tpsa.app/',
    binance: 'https://app.binance.com/',
    okx: 'https://www.okx.com/',
    bitget: 'https://share.bwb.site/',
    walletconnect: 'https://walletconnect.network/',
};

export function getWalletOpenLink(walletType?: string | null): string | null {
    const wt = (walletType || getActiveWalletType() || '').toLowerCase();
    return WALLET_OPEN_LINKS[wt] || null;
}

/** Open the wallet app (mobile / TMA only) so the user can approve a pending tx. */
export function openWalletApp(walletType?: string): boolean {
    if (!isMobileUA()) return false;
    const link = getWalletOpenLink(walletType);
    if (!link) return false;
    try {
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.openLink) {
            tg.openLink(link, { try_instant_view: false });
        } else {
            window.open(link, '_blank');
        }
        console.log('[walletService] Opened wallet app for approval: ' + link);
        return true;
    } catch (e) {
        console.warn('[walletService] Failed to open wallet app:', e);
        return false;
    }
}

// ---------------------------------------------------------------------------
// Public BSC RPC (reads / gas / receipts) with node rotation
// ---------------------------------------------------------------------------

let rpcIdx = 0;
export function getReadProvider(): JsonRpcProvider {
    const url = BSC_RPC_NODES[rpcIdx % BSC_RPC_NODES.length];
    const freq = new FetchRequest(url);
    freq.timeout = 10000; // never let a stalled RPC hang the flow for minutes
    return new JsonRpcProvider(freq, BSC_CHAIN_ID_DEC, { staticNetwork: true });
}
export function rotateRpc(): void {
    rpcIdx = (rpcIdx + 1) % BSC_RPC_NODES.length;
}

/** Run a read/estimation against public RPCs, rotating nodes on failure. */
export async function callReadRpc<T>(fn: (provider: JsonRpcProvider) => Promise<T>): Promise<T> {
    let lastErr: any = null;
    for (let attempt = 0; attempt < BSC_RPC_NODES.length; attempt++) {
        try {
            return await fn(getReadProvider());
        } catch (err) {
            lastErr = err;
            rotateRpc();
        }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

// ---------------------------------------------------------------------------
// Chain enforcement (injected wallets - WC sessions are pinned to BSC)
// ---------------------------------------------------------------------------

export async function ensureBscChain(provider: any): Promise<void> {
    let chainId: string | null = null;
    try {
        chainId = String(await withTimeout(provider.request({ method: 'eth_chainId' }), 6000, 'eth_chainId'));
    } catch { /* some wallets do not respond - continue anyway */ }

    if (chainId && chainId.toLowerCase() === BSC_CHAIN_ID_HEX) return;

    if (chainId) {
        try {
            await withTimeout(provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BSC_CHAIN_ID_HEX }] }), 45000, 'wallet_switchEthereumChain');
        } catch (switchErr: any) {
            const code = switchErr?.code ?? switchErr?.data?.originalError?.code;
            if (code === 4902 || code === -32603) {
                try { await withTimeout(provider.request({ method: 'wallet_addEthereumChain', params: [BSC_ADD_CHAIN_PARAMS] }), 45000, 'wallet_addEthereumChain'); }
                catch { throw new Error('Please add the BNB Smart Chain network in your wallet and try again.'); }
            } else {
                throw new Error('Please switch your wallet to the BNB Smart Chain network and try again.');
            }
        }
        // Verify after switching
        try {
            const after = String(await withTimeout(provider.request({ method: 'eth_chainId' }), 6000, 'eth_chainId'));
            if (after && after.toLowerCase() !== BSC_CHAIN_ID_HEX) {
                throw new Error('Wallet is not on the BNB Smart Chain network.');
            }
        } catch (e: any) {
            if (e?.message?.includes('BNB Smart Chain')) throw e;
        }
    }
}

// ---------------------------------------------------------------------------
// WalletConnect session pre-flight
// ---------------------------------------------------------------------------

/**
 * Verify the WalletConnect session is actually ALIVE before dispatching a
 * signing request. A dead / expired session (relay socket dropped after a
 * WebView suspension or wallet-app round trip) means the request NEVER reaches
 * the wallet - so `eth_sendTransaction` never resolves and the UI hangs on
 * "Opening wallet..." forever. This is the #1 cause of that symptom.
 */
export async function ensureWalletSessionAlive(provider: any): Promise<void> {
    const session = provider?.session || provider?.provider?.session || null;
    if (!isWalletConnectActive() && !session) return; // injected wallet - prompts natively

    // Expired session -> the request can never be delivered.
    if (session?.expiry && session.expiry * 1000 < Date.now()) {
        throw new Error('Wallet connection session expired. Please reconnect your wallet and try again.');
    }

    // WalletConnect EthereumProvider exposes `connected`. If the relay dropped,
    // try to restore the stored session once (bounded - never hangs forever).
    if (provider && provider.connected === false && typeof provider.connect === 'function') {
        console.log('[walletService] WalletConnect provider disconnected - restoring session...');
        try {
            await withTimeout(provider.connect(), 10000, 'wallet session restore');
            console.log('[walletService] WalletConnect session restored');
        } catch {
            throw new Error('Wallet connection lost. Please reconnect your wallet and try again.');
        }
    }
}

// ---------------------------------------------------------------------------
// THE unified write path
// ---------------------------------------------------------------------------

export interface TxRequest {
    to: string;
    data: string;
    value?: bigint;
    from?: string;
    gasLimit?: bigint;
    label?: string;
}

function normalizeTxError(err: any, label: string): Error {
    const msg: string = err?.shortMessage || err?.message || String(err);
    const lower = (msg || '').toLowerCase();
    if (err?.code === 4001 || lower.includes('user rejected') || lower.includes('user disapproved') || lower.includes('rejected the request') || lower.includes('user declined')) {
        return new Error(label + ' was rejected in the wallet. Please open your wallet and approve the request.');
    }
    if (lower.includes('insufficient funds')) {
        return new Error('Insufficient BNB for the transaction fee. Please top up your wallet.');
    }
    if (lower.includes('not connected') || (lower.includes('session') && lower.includes('expired'))) {
        return new Error('Wallet connection lost. Please reconnect your wallet and try again.');
    }
    return new Error(label + ' failed: ' + msg);
}

async function estimateGasSafe(from: string, req: TxRequest): Promise<bigint> {
    try {
        const est = await withTimeout(
            callReadRpc((p) => p.estimateGas({
                from,
                to: req.to,
                data: req.data,
                value: req.value ?? 0n,
            })),
            8000,
            'gas estimation',
        );
        let gas = (est * 13n) / 10n; // +30% safety buffer
        if (gas < 80000n) gas = 80000n;
        return gas;
    } catch {
        // Estimation can fail (wallet not on BSC yet, or contract-level
        // reverts that wallets still accept). Use a generous default rather
        // than blocking the tx.
        return 400000n;
    }
}

/**
 * Send a transaction through the ACTIVE wallet provider.
 * Works on: Telegram Mini App (deep-links to the wallet app so the approval
 * is visible), mobile browsers, in-wallet dApp browsers (native prompt) and
 * desktop (QR-paired WC or extension).
 *
 * @returns the transaction hash once the user approves in the wallet.
 */
export async function sendWalletTransaction(req: TxRequest): Promise<string> {
    const label = req.label || 'Transaction';

    const provider = active?.provider || getInjectedProvider();
    if (!provider || typeof provider.request !== 'function') {
        throw new Error('No wallet connected. Please connect your wallet and try again.');
    }

    const from = (req.from || getTransactionFromAddress() || getProviderAccount(provider) || '').toLowerCase();
    if (!from) {
        throw new Error('Wallet account not available. Please reconnect your wallet and try again.');
    }

    const isWC = isWalletConnectActive() || !!(provider as any).session;

    // Injected wallets must be on BSC before we send (WC sessions are pinned).
    if (!isWC) {
        await ensureBscChain(provider);
    } else {
        // WalletConnect: verify the session is alive BEFORE dispatching. A dead
        // or expired session means the request never reaches the wallet, which
        // is exactly the "wallet never opens / hangs forever" symptom.
        await ensureWalletSessionAlive(provider);
    }

    // Pre-estimate gas on PUBLIC RPC so the wallet does not have to (WC wallets
    // frequently fail eth_estimateGas, which kills the request silently - this
    // was one of the root causes of "wallet opens but nothing happens").
    let gasLimit = req.gasLimit ?? 0n;
    if (gasLimit <= 0n) gasLimit = await estimateGasSafe(from, req);

    const params: Array<Record<string, string>> = [{
        from,
        to: req.to,
        data: req.data,
        gas: '0x' + gasLimit.toString(16),
    }];
    if (req.value && req.value > 0n) {
        params[0].value = '0x' + req.value.toString(16);
    }

    console.log('[walletService] ' + label + ': sending via ' + (isWC ? 'WalletConnect' : 'injected') + ' provider', { from, to: req.to, gas: params[0].gas, value: params[0].value || '0x0' });

    // On mobile / TMA with WalletConnect, deep-link into the wallet app shortly
    // after the request is dispatched so the approval sheet is in front of the
    // user. (The request is already in-flight over the WC relay.)
    if (isWC && (isMobileUA() || isTelegramWebApp())) {
        // Re-fire the deep-link a few times: the first one can fire before the
        // request is actually dispatched over the WC relay, and on some devices
        // the first openLink is swallowed by the WebView transition. These only
        // run while the user is still in the Mini App (JS is suspended once the
        // wallet app is in the foreground).
        [900, 8000, 20000].forEach((ms) => {
            setTimeout(() => { try { openWalletApp(); } catch { /* ignore */ } }, ms);
        });
    }

    let hash: string;
    try {
        // HARD TIMEOUT: without this, a dead WalletConnect relay (or a wallet
        // that never shows the approval sheet) leaves the promise pending
        // FOREVER - the exact "Opening wallet to confirm stake..." hang.
        hash = await withTimeout(
            provider.request({ method: 'eth_sendTransaction', params }) as Promise<string>,
            180000,
            label + ' wallet response',
        );
    } catch (err: any) {
        if (err?.message?.includes('timed out after')) {
            throw new Error(
                label + ': your wallet did not respond in time. Please open your wallet app manually and approve the request - if no request is shown there, reconnect your wallet and try again.'
            );
        }
        throw normalizeTxError(err, label);
    }

    if (!hash || typeof hash !== 'string') {
        throw new Error(label + ': wallet did not return a transaction hash.');
    }

    console.log('[walletService] ' + label + ': tx sent -> ' + hash);
    return hash;
}

/**
 * Poll the public BSC RPCs for a transaction receipt. Independent of the
 * wallet provider, so confirmation works even after the Telegram WebView was
 * suspended or the mobile browser navigated away and back.
 */
export async function waitForReceipt(
    hash: string,
    timeoutMs: number = 300000,
    pollMs: number = 4000,
): Promise<any> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const receipt = await callReadRpc((p) => p.getTransactionReceipt(hash));
            if (receipt) {
                if (receipt.status === 0) {
                    throw new Error('Transaction failed on-chain (reverted).');
                }
                return receipt;
            }
        } catch (err: any) {
            if (err?.message?.includes('reverted')) throw err;
            // transient RPC failure - rotate and keep polling
        }
        await sleep(pollMs);
    }
    throw new Error('Transaction is taking longer than expected to confirm. It may still land on-chain - please check again shortly.');
}

/** Build a lightweight TransactionResponse-like object ({ hash, wait }). */
export function makeTxResponse(hash: string, label: string = 'Transaction'): { hash: string; wait: (confirmations?: number) => Promise<any> } {
    return {
        hash,
        wait: async (_confirmations?: number) => {
            console.log('[walletService] ' + label + ': waiting for receipt -> ' + hash);
            return await waitForReceipt(hash);
        },
    };
}

export { ZERO_ADDRESS };

// ---------------------------------------------------------------------------
// Convenience namespace - lets consumers import a single object:
//   import { walletService } from '../lib/walletService';
// ---------------------------------------------------------------------------
export const walletService = {
    setActiveConnection,
    clearActiveConnection,
    getActiveProvider,
    getActiveAddress,
    getActiveWalletType,
    isWalletConnectActive,
    getProviderAccount,
    getTransactionFromAddress,
    getInjectedProvider,
    isInsideWalletBrowser,
    getWalletOpenLink,
    openWalletApp,
    getReadProvider,
    rotateRpc,
    callReadRpc,
    ensureBscChain,
    ensureWalletSessionAlive,
    sendWalletTransaction,
    waitForReceipt,
    makeTxResponse,
    withTimeout,
    sleep,
};
