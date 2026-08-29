// Wallet System v2 - Telegram Mini App Compatible - Updated - v3
import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserProvider, JsonRpcSigner } from 'ethers';
import { createAppKit, useAppKit, useAppKitAccount, useAppKitProvider, useDisconnect, useWalletInfo } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { bsc } from '@reown/appkit/networks';
import metamaskLogo from '../assets/metamask.png';
import safepalLogo from '../assets/safepal.png';
import tpLogo from '../assets/tp.png';
import trustLogo from '../assets/trust.png';
import binanceLogo from '../assets/binance.png';
import okxLogo from '../assets/okx.png';
import { walletConnectionsManager } from './walletConnections';


// 1. Connection Config (REOWN / WALLETCONNECT)
const projectId = 'ec457184730a7f1e24bbe58a393f442b';

let globalEthereumProvider: any = null;
let globalEthereumProviderPromise: Promise<any> | null = null;
let activeDisplayUriCallback: ((uri: string) => void) | null = null;
let globalAppKitProvider: any = null;
let _activeWalletType: string | null = localStorage.getItem('aimining_wallet_type');
export const setGlobalAppKitProvider = (p: any) => { globalAppKitProvider = p; (window as any).__globalAppKitProvider = p; };
export const getGlobalAppKitProvider = () => globalAppKitProvider;
export const setActiveWalletType = (type: string) => { _activeWalletType = type; localStorage.setItem('aimining_wallet_type', type); };

export const getGlobalEthereumProvider = async () => {
    if (globalEthereumProvider) return globalEthereumProvider;
    if (globalEthereumProviderPromise) return globalEthereumProviderPromise;

    const { EthereumProvider } = await import('@walletconnect/ethereum-provider');
    globalEthereumProviderPromise = EthereumProvider.init({
        projectId,
        metadata,
        showQrModal: false,
        chains: [56],
        methods: ["eth_sendTransaction", "eth_sign", "personal_sign", "eth_signTypedData"],
        events: ["accountsChanged", "chainChanged"],
        rpcMap: { 56: 'https://bsc-rpc.publicnode.com' }
    }).then(provider => {
        globalEthereumProvider = provider;
        return provider;
    });

    return globalEthereumProviderPromise;
};

const metadata = {
    name: 'Riot Mining Platform',
    description: 'Riot-powered Staking Platform',
    url: window.location.origin,
    icons: [`${window.location.origin}/logo.png`]
};

const BSC_CHAIN_ID_HEX = '0x38';

const WALLET_REDIRECT_LINKS: Record<string, string> = {
    metamask: 'https://metamask.app.link/',
    trust: 'https://link.trustwallet.com/',
    safepal: 'https://link.safepal.io/',
    tokenpocket: 'https://tpsa.app/',
    binance: 'https://app.binance.com/',
    okx: 'https://www.okx.com/',
    bitget: 'https://share.bwb.site/'
};

const checkIsWalletConnect = (provider: any): boolean => {
    if (!provider) return false;
    if (localStorage.getItem('aimining_is_walletconnect') === 'true') return true;
    if (provider.session || provider.provider?.session || provider.connector || provider.provider?.connector) {
        return true;
    }
    const name = provider.constructor?.name || '';
    if (name.includes('WalletConnect') || name.includes('EthereumProvider')) {
        return true;
    }
    return false;
};

const getRedirectLinkForProvider = (provider: any): string | null => {
    let walletType = localStorage.getItem('aimining_wallet_type');
    
    const session = provider?.session || provider?.provider?.session;
    if ((!walletType || walletType === 'walletconnect') && session?.peer?.metadata?.name) {
        const peerName = session.peer.metadata.name.toLowerCase();
        if (peerName.includes('metamask')) walletType = 'metamask';
        else if (peerName.includes('trust')) walletType = 'trust';
        else if (peerName.includes('safepal')) walletType = 'safepal';
        else if (peerName.includes('tokenpocket')) walletType = 'tokenpocket';
        else if (peerName.includes('binance')) walletType = 'binance';
        else if (peerName.includes('okx')) walletType = 'okx';
        else if (peerName.includes('bitget')) walletType = 'bitget';
    }

    if (walletType) {
        localStorage.setItem('aimining_wallet_type', walletType);
        return WALLET_REDIRECT_LINKS[walletType.toLowerCase()] || null;
    }
    return null;
};
const detectWalletFromPeerName = (peerName: string): string | null => {
    const lower = peerName.toLowerCase();
    if (lower.includes('metamask')) return 'metamask';
    if (lower.includes('trust')) return 'trust';
    if (lower.includes('safepal')) return 'safepal';
    if (lower.includes('tokenpocket')) return 'tokenpocket';
    if (lower.includes('binance')) return 'binance';
    if (lower.includes('okx')) return 'okx';
    if (lower.includes('bitget')) return 'bitget';
    return null;
};

const detectWalletFromEthereum = (): string | null => {
    const eth = (window as any).ethereum;
    if (!eth) return null;
    if (eth.isTrust || eth.isTrustWallet) return 'trust';
    if (eth.isMetaMask && !eth.isTrust && !eth.isSafePal && !eth.isTokenPocket) return 'metamask';
    if (eth.isSafePal) return 'safepal';
    if (eth.isTokenPocket) return 'tokenpocket';
    if (eth.isBinance || eth.isBinanceChain) return 'binance';
    if (eth.isOkxWallet || eth.isOKX) return 'okx';
    if (eth.isBitget) return 'bitget';
    // Check providers array
    if (Array.isArray(eth.providers)) {
        for (const p of eth.providers) {
            if (p.isTrust || p.isTrustWallet) return 'trust';
            if (p.isMetaMask && !p.isTrust && !p.isSafePal) return 'metamask';
            if (p.isSafePal) return 'safepal';
            if (p.isTokenPocket) return 'tokenpocket';
        }
    }
    return null;
};

export const getWalletRedirectUrl = (): string => {
    // 1. Check module-level variable first
    let walletType = _activeWalletType;
    console.log(`[getWalletRedirectUrl] _activeWalletType=${walletType}`);

    // 2. Fallback to localStorage
    if (!walletType || walletType === 'walletconnect') {
        walletType = localStorage.getItem('aimining_wallet_type');
        console.log(`[getWalletRedirectUrl] localStorage=${walletType}`);
    }

    // 3. Try to get redirect URL and wallet type from ALL WC session sources
    const tryGetSessionRedirect = (session: any): { url: string | null; type: string | null } => {
        if (!session?.peer?.metadata) return { url: null, type: null };
        const meta = session.peer.metadata;
        const peerName = (meta.name || '').toLowerCase();
        const detected = detectWalletFromPeerName(peerName);

        // WalletConnect v2 sessions include redirect URLs in peer metadata
        // redirect.native = custom URI scheme (trust://, metamask://)
        // redirect.universal = universal link (https://link.trustwallet.com/)
        const nativeRedirect = meta.redirect?.native || '';
        const universalRedirect = meta.redirect?.universal || '';

        // Prefer native URI scheme (e.g., trust://) — opens app directly
        const bestUrl = nativeRedirect || universalRedirect || '';
        console.log(`[getWalletRedirectUrl] session peer="${peerName}" type="${detected}" native="${nativeRedirect}" universal="${universalRedirect}"`);
        return { url: bestUrl || null, type: detected };
    };

    let sessionRedirectUrl: string | null = null;

    if (!walletType || walletType === 'walletconnect') {
        // Try global AppKit provider session (multiple paths)
        const globalWp = getGlobalAppKitProvider();
        if (globalWp) {
            const session = globalWp.session
                || globalWp.provider?.session
                || globalWp.provider?.provider?.session
                || globalWp.connector?.session;
            const result = tryGetSessionRedirect(session);
            if (result.type) walletType = result.type;
            if (result.url) sessionRedirectUrl = result.url;
        }

        // Try manualWalletProvider session (custom WC flow)
        if (!walletType || walletType === 'walletconnect') {
            const mwp = (window as any).__manualWalletProvider;
            if (mwp) {
                const mSession = mwp.session || mwp.provider?.session;
                const result = tryGetSessionRedirect(mSession);
                if (result.type) walletType = result.type;
                if (result.url) sessionRedirectUrl = result.url;
            }
        }

        // Try injected window.ethereum — skip if WalletConnect is active (avoids picking up MetaMask extension when user connected via Trust Wallet WC)
        if (!walletType || walletType === 'walletconnect') {
            const isWC = localStorage.getItem('aimining_is_walletconnect') === 'true';
            if (!isWC) {
                const detected = detectWalletFromEthereum();
                console.log(`[getWalletRedirectUrl] window.ethereum detection=${detected} (isWC=${isWC})`);
                if (detected) walletType = detected;
            } else {
                console.log(`[getWalletRedirectUrl] Skipping window.ethereum — WalletConnect session active`);
            }
        }
    } else {
        // We already have a wallet type, but still try to get session redirect URL
        const globalWp = getGlobalAppKitProvider();
        if (globalWp) {
            const session = globalWp.session
                || globalWp.provider?.session
                || globalWp.provider?.provider?.session
                || globalWp.connector?.session;
            const result = tryGetSessionRedirect(session);
            if (result.url) sessionRedirectUrl = result.url;
        }
        if (!sessionRedirectUrl) {
            const mwp = (window as any).__manualWalletProvider;
            if (mwp) {
                const mSession = mwp.session || mwp.provider?.session;
                const result = tryGetSessionRedirect(mSession);
                if (result.url) sessionRedirectUrl = result.url;
            }
        }
    }

    // 4. Persist
    if (walletType && walletType !== 'walletconnect') {
        _activeWalletType = walletType;
        localStorage.setItem('aimining_wallet_type', walletType);
    }

    // 5. Return the best URL: session native redirect > hardcoded fallback
    if (sessionRedirectUrl) {
        console.log(`[getWalletRedirectUrl] Using session redirect: ${sessionRedirectUrl}`);
        return sessionRedirectUrl;
    }
    if (walletType) {
        const url = WALLET_REDIRECT_LINKS[walletType.toLowerCase()];
        if (url) {
            console.log(`[getWalletRedirectUrl] Using fallback URL for "${walletType}": ${url}`);
            return url;
        }
    }

    // 6. Last resort: fallback to MetaMask
    console.warn('[getWalletRedirectUrl] No wallet detected, falling back to MetaMask');
    return WALLET_REDIRECT_LINKS.metamask;
};

const getWalletConnectionLink = (walletName: string | null | undefined, encodedUri: string): string => {
    // encodedUri = encodeURIComponent(activeUri) — standard WC v2 deep link format
    if (!walletName || typeof walletName !== 'string') {
        return `https://metamask.app.link/wc?uri=${encodedUri}`;
    }
    switch (walletName.toLowerCase()) {
        case 'metamask': return `https://metamask.app.link/wc?uri=${encodedUri}`;
        case 'trust': return `https://link.trustwallet.com/wc?uri=${encodedUri}`;
        case 'safepal': return `https://link.safepal.io/wc?uri=${encodedUri}`;
        case 'tokenpocket': return `https://tpsa.app/wc?uri=${encodedUri}`;
        case 'binance': return `https://app.binance.com/cedefi/wc?uri=${encodedUri}`;
        case 'okx': return `https://www.okx.com/ul/wc?uri=${encodedUri}`;
        case 'bitget': return `https://bkcode.vip/wc?uri=${encodedUri}`;
        default: return `https://metamask.app.link/wc?uri=${encodedUri}`;
    }
};

// Desktop vs mobile detection — decides between wallet deep links (mobile:
// the wallet app is on the same device) and QR codes (desktop/laptop: the
// user scans with their phone's wallet app).
const isMobileUA = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// WalletConnect sessions expire (1-7 days, wallet dependent). An expired
// session still sits in WC storage — provider.session is truthy and
// provider.accounts still lists the old account — so the app LOOKS connected,
// but eth_sendTransaction published on the dead session topic never reaches
// the wallet: the wallet opens (deep link) but shows NO approval popup.
export const isWCSessionExpired = (provider: any): boolean => {
    try {
        if (!provider || typeof provider.connect !== 'function') return false; // not a WC provider
        const expiry = Number(provider?.session?.expiry || 0);
        return expiry > 0 && (expiry * 1000) < Date.now() + 30000; // expired / expiring within 30s
    } catch { return false; }
};

const getWalletDappDeepLink = (walletName: string | null | undefined, dappUrl: string): string => {
    const url = encodeURIComponent(dappUrl);
    switch ((walletName || '').toLowerCase()) {
        case 'metamask': {
            // MetaMask uses /dapp/ path — URL should NOT be encoded
            const clean = dappUrl.replace(/^https?:\/\//, '');
            return `https://metamask.app.link/dapp/${clean}`;
        }
        case 'trust':
            return `https://link.trustwallet.com/open_url?url=${url}`;
        case 'safepal':
            return `https://link.safepal.io/open_url?url=${url}`;
        case 'tokenpocket':
            return `https://tokenpocket.pro/dapp?url=${url}`;
        case 'binance':
            return `https://app.binance.com/cedefi/dapp?url=${url}`;
        case 'okx':
            return `https://www.okx.com/download?deeplink=${encodeURIComponent(`okx://web3/dapp?url=${dappUrl}`)}`;
        case 'bitget':
            return `https://www.bitget.com/ul/dapp?url=${url}`;
        default:
            return `https://metamask.app.link/dapp/${dappUrl.replace(/^https?:\/\//, '')}`;
    }
};

// HTTPS-only fallback pages — removed (unused after TMA dapp browser approach)

const TOKENPOCKET_ANDROID_PACKAGE = 'vip.mytokenpocket';
const TOKENPOCKET_DOWNLOAD_URL = 'https://www.tokenpocket.pro/download/app';

const getDappUrl = (autoConnectTokenPocket = false) => {
    const url = new URL(window.location.href);
    if (autoConnectTokenPocket) {
        url.searchParams.set('tpconnect', '1');
    }
    return url.toString();
};

const getTokenPocketAppUri = (autoConnect = true) => {
    const dappUrl = getDappUrl(autoConnect);
    const openParams = JSON.stringify({
        url: dappUrl,
        chain: 'BSC',
        source: 'Riot Mining Platform'
    });
    const outsideParams = JSON.stringify({
        url: dappUrl,
        action: 'open',
        protocol: 'TokenPocket',
        version: '1.0',
        source: 'Riot Mining Platform',
        chain: 'BSC'
    });
    const encodedOpenParams = encodeURIComponent(openParams);
    const encodedOutsideParams = encodeURIComponent(outsideParams);
    const encodedFallback = encodeURIComponent(TOKENPOCKET_DOWNLOAD_URL);

    return {
        direct: `tpdapp://open?params=${encodedOpenParams}`,
        directIntent: `intent://open?params=${encodedOpenParams}#Intent;scheme=tpdapp;package=${TOKENPOCKET_ANDROID_PACKAGE};S.browser_fallback_url=${encodedFallback};end`,
        alternate: `tpoutside://pull.activity?param=${encodedOutsideParams}`,
        alternateIntent: `intent://pull.activity?param=${encodedOutsideParams}#Intent;scheme=tpoutside;package=${TOKENPOCKET_ANDROID_PACKAGE};S.browser_fallback_url=${encodedFallback};end`,
        fallback: TOKENPOCKET_DOWNLOAD_URL
    };
};

const openTokenPocketApp = (autoConnect = true) => {
    const uris = getTokenPocketAppUri(autoConnect);
    const isAndroid = /Android/i.test(navigator.userAgent);
    const primary = isAndroid ? uris.directIntent : uris.direct;
    const secondary = isAndroid ? uris.alternateIntent : uris.alternate;

    // TokenPocket documents tpdapp://open for opening a DApp URL. The older
    // app.link DApp fallback can show "that link could not be found".
    launchExternalLink(primary);
    setTimeout(() => {
        launchExternalLink(secondary);
    }, 700);
    setTimeout(() => {
        if (document.visibilityState === 'visible') {
            launchExternalLink(uris.fallback);
        }
    }, 1800);
};

const clearWalletConnectPairingCache = () => {
    const shouldRemove = (key: string) =>
        key.startsWith('wc@2') ||
        key.includes('walletconnect') ||
        key.includes('WALLETCONNECT') ||
        key.includes('appkit') ||
        key.includes('wcm@2');

    Object.keys(localStorage).forEach(key => {
        if (shouldRemove(key)) localStorage.removeItem(key);
    });
    Object.keys(sessionStorage).forEach(key => {
        if (shouldRemove(key)) sessionStorage.removeItem(key);
    });
};

export const runWithTimeout = async <T,>(label: string, promise: Promise<T>, timeoutMs = 20000): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    try {
        return await Promise.race([promise, timeout]);
    } finally {
        if (timer) clearTimeout(timer);
    }
};

export const launchExternalLink = (url: string) => {
    const tg = (window as any).Telegram?.WebApp;
    console.log('[Web3] launchExternalLink:', url.substring(0, 120));

    // In Telegram WebView — prefer tg.openLink for deep links (window.open is unreliable in WebView)
    if (tg) {
        // Method 1: tg.openLink (Telegram API — most reliable for deep links in TMA)
        if (tg.openLink) {
            try {
                tg.openLink(url, { try_instant_view: false });
                console.log('[Web3] Used tg.openLink');
                return;
            } catch (e) { console.warn('[Web3] tg.openLink error:', e); }
        }

        // Method 2: window.open (fallback)
        try {
            const w = window.open(url, '_blank');
            if (w) { console.log('[Web3] Used window.open'); return; }
        } catch (e) { console.warn('[Web3] window.open error:', e); }

        // Method 3: location.href (OS may intercept universal link)
        try { window.location.href = url; return; } catch {}
        return;
    }

    // Non-Telegram
    try {
        const anchor = document.createElement('a');
        anchor.href = url; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
        document.body.appendChild(anchor); anchor.click(); document.body.removeChild(anchor);
    } catch (e) {
        console.warn("[Web3] Link launch fallback:", e);
        try { window.open(url, '_blank'); } catch {}
    }
};

// Initialize AppKit with Instance Guard
let appKitInitialized = false;

if (!appKitInitialized) {
    createAppKit({
        adapters: [new EthersAdapter()],
        networks: [bsc],
        defaultNetwork: bsc,
        metadata,
        projectId,
        allWallets: 'SHOW',
        featuredWalletIds: [
            '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0', // Trust Wallet
            'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
            '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369', // Rainbow
            'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa', // Coinbase
            '0b415a74b010e646b3a393a1953494349efe26d62a3d7e716e7b45f4b7b4b1d0', // SafePal
            '8a0ee50d1f22f6651afcae7eb4253e52a3310b90af5daef78a8c4929a9bb60d7', // TokenPocket
        ],
        enableMobileFullScreen: true,
        features: {
            analytics: true,
            email: false,
            socials: false
        },
        themeMode: 'dark',
        themeVariables: {
            '--w3m-accent': '#FFD700',
            '--w3m-border-radius-master': '1px'
        }
    });
    appKitInitialized = true;
}

interface WalletContextType {
    address: string | undefined;
    isConnected: boolean;
    signer: JsonRpcSigner | null;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    isConnecting: boolean;
    walletType: string | null;
    walletProvider: any;
    referral: string | null;
    isWalletConnect: boolean;
    // Compatibility properties
    forceSync: () => Promise<void>;
    hardReset: () => void;
    setIsDisconnectModalOpen: (open: boolean) => void;
    setIsConnectModalOpen: (open: boolean) => void;
    stakeNow: (amount: string) => Promise<void>;
    openInWalletBrowser: (type: 'safepal' | 'tokenpocket') => void;
    manualWalletProvider: any;
    miningStats: any;
    setMiningStats: (stats: any) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
    const context = useContext(WalletContext);
    if (!context) throw new Error('useWallet must be used within a WalletProvider');
    return context;
};

export function WalletProvider({ children }: { children: React.ReactNode }) {
    const { open } = useAppKit();
    const { disconnect: appKitDisconnect } = useDisconnect();
    const { address, isConnected, status } = useAppKitAccount();
    const { walletProvider } = useAppKitProvider('eip155');
    const { walletInfo } = useWalletInfo();
    const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
    const [hasSynced, setHasSynced] = useState(false);
    const [manualAddress, setManualAddress] = useState<string | null>(localStorage.getItem('aimining_manual_address'));
    const [manualWalletProvider, setManualWalletProvider] = useState<any>(null);
    const [walletType, setWalletType] = useState<string | null>(localStorage.getItem('aimining_wallet_type'));
    const [referral, setReferral] = useState<string | null>(null);
    const [isWalletConnect, setIsWalletConnect] = useState<boolean>(() => {
        return localStorage.getItem('aimining_is_walletconnect') === 'true';
    });
    const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
    const [_isDisconnectModalOpen, _setIsDisconnectModalOpen] = useState(false);
    const [_tpLoading, setTpLoading] = useState(false);
    const [showTpFallback, setShowTpFallback] = useState(false);
    const skipAutoConnectRef = React.useRef(false); // Prevent auto-reconnect after disconnect

    // Sync wallet type from AppKit walletInfo
    useEffect(() => {
        if (walletInfo?.name) {
            const peerName = walletInfo.name.toLowerCase();
            let wt = null;
            if (peerName.includes('metamask')) wt = 'metamask';
            else if (peerName.includes('trust')) wt = 'trust';
            else if (peerName.includes('safepal')) wt = 'safepal';
            else if (peerName.includes('tokenpocket')) wt = 'tokenpocket';
            else if (peerName.includes('binance')) wt = 'binance';
            else if (peerName.includes('okx')) wt = 'okx';
            else if (peerName.includes('bitget')) wt = 'bitget';

            if (wt) {
                console.log("[Web3] Detected active wallet from AppKit info:", wt);
                setWalletType(wt);
                setActiveWalletType(wt);
            }
        }
    }, [walletInfo]);

// ✅ Sync walletProvider to global variable for cross-page access
    useEffect(() => {
        if (walletProvider) {
            setGlobalAppKitProvider(walletProvider);
            console.log('[Web3] Global AppKit provider updated');
        }
    }, [walletProvider]);
    // Background WalletConnect states
    const [activeUri, setActiveUri] = useState<string | null>(null);
    const [activeProvider, setActiveProvider] = useState<any>(null);
    const [connectingWallet, setConnectingWallet] = useState<string | null>(null);
    const [isGeneratingUri, setIsGeneratingUri] = useState<boolean>(false);
    const [miningStats, setMiningStats] = useState<any>({
        balance: '0.00000000000000',
        miningPower: '0.0',
        dailyProfit: '0.00000000000000',
        walletBalance: '0.00',
        totalStaked: '0.00',
        rewardPerSecond: 0,
        isLoaded: false
    });

    const isConnecting = (status === 'connecting' || status === 'reconnecting') && !address && !manualAddress;

    // Identity Persistence: Ensure identity doesn't leak or flicker
    const [finalAddress, setFinalAddress] = useState<string | undefined>(address || manualAddress || undefined);
    const [finalIsConnected, setFinalIsConnected] = useState<boolean>(isConnected || !!manualAddress);

    // Sync AppKit connection → manual state
    useEffect(() => {
        const addr = address || manualAddress;
        if (addr && addr !== finalAddress) {
            setFinalAddress(addr);
            setFinalIsConnected(true);
        } else if (!addr && finalIsConnected && status !== 'connecting') {
            setFinalAddress(undefined);
            setFinalIsConnected(false);
        }
    }, [address, manualAddress, isConnected, status]);

    // Re-check connection when user comes back to Telegram (after approving in wallet app)
    useEffect(() => {
        const handleVisibility = async () => {
            if (document.visibilityState !== 'visible') return;

            // Wait for AppKit to restore WC session after returning from wallet app
            await new Promise(r => setTimeout(r, 2000));

            // Check if AppKit already connected (user returned from wallet app)
            const appKitAddress = address;
            const appKitConnected = isConnected;
            if (appKitAddress && appKitConnected && !finalIsConnected) {
                console.log('[TMA] AppKit connection detected after return:', appKitAddress);
                setFinalAddress(appKitAddress);
                setFinalIsConnected(true);
                setManualAddress(appKitAddress);
                localStorage.setItem('aimining_manual_address', appKitAddress);
                localStorage.setItem('aimining_address', appKitAddress);
                return;
            }

            // Also check AppKit walletProvider
            if (walletProvider && appKitAddress && !finalIsConnected) {
                try {
                    const bp = new BrowserProvider(walletProvider as any);
                    const sg = await bp.getSigner(appKitAddress);
                    setSigner(sg);
                    setManualAddress(appKitAddress);
                    setManualWalletProvider(walletProvider);
                    setFinalAddress(appKitAddress);
                    setFinalIsConnected(true);
                    localStorage.setItem('aimining_manual_address', appKitAddress);
                    localStorage.setItem('aimining_address', appKitAddress);
                    console.log('[TMA] Synced from AppKit walletProvider:', appKitAddress);
                    return;
                } catch (e) { console.warn('[TMA] AppKit walletProvider sync failed:', e); }
            }

            const currentAddr = address || manualAddress;

            // If already connected, just re-sync signer if needed
            if (currentAddr && finalIsConnected) {
                if (!signer) {
                    const p = walletProvider || manualWalletProvider || (window as any).ethereum;
                    if (p) {
                        try {
                            const bp = new BrowserProvider(p);
                            setSigner(await bp.getSigner());
                            setHasSynced(true);
                        } catch {}
                    }
                }
                return;
            }

            // Check if WalletConnect session was established while we were suspended
            // Try the global provider first (most reliable)
            try {
                const prov = globalEthereumProvider;
                if (prov?.session) {
                    const accs = prov.accounts;
                    if (accs?.[0]) {
                        const wcAddress = accs[0];
                        const bp = new BrowserProvider(prov);
                        const sg = await bp.getSigner(wcAddress);
                        setSigner(sg); setManualAddress(wcAddress); setManualWalletProvider(prov);
                        setIsWalletConnect(true);
                        localStorage.setItem('aimining_is_walletconnect', 'true');
                        setHasSynced(true); setFinalAddress(wcAddress); setFinalIsConnected(true);
                        localStorage.setItem('aimining_manual_address', wcAddress);
                        localStorage.setItem('aimining_address', wcAddress);
                        walletConnectionsManager.saveConnection(wcAddress, localStorage.getItem('aimining_wallet_type') || 'walletconnect');
                        setConnectingWallet(null); setActiveUri(null); setIsConnectModalOpen(false);
                        console.log('[TMA] Re-synced wallet from global provider:', wcAddress);
                        return;
                    }
                }
            } catch (err) {
                console.warn('[TMA] Global provider check failed:', err);
            }

            // Fallback: Check SignClient for sessions
            try {
                const { SignClient } = await import('@walletconnect/sign-client');
                const client = await SignClient.init({
                    projectId: 'ec457184730a7f1e24bbe58a393f442b',
                });
                const sessions = client.session.getAll();
                if (sessions.length > 0) {
                    const session = sessions[sessions.length - 1];
                    const accounts = session.namespaces.eip155?.accounts || [];
                    const account = accounts[0];
                    const wcAddress = account ? account.split(':')[2] : null;
                    if (wcAddress) {
                        // Create provider from session
                        const { EthereumProvider } = await import('@walletconnect/ethereum-provider');
                        const prov = await EthereumProvider.init({
                            projectId: 'ec457184730a7f1e24bbe58a393f442b',
                            metadata,
                            showQrModal: false,
                            chains: [56],
                            session,
                            rpcMap: { 56: 'https://bsc-rpc.publicnode.com' },
                        });
                        const bp = new BrowserProvider(prov);
                        const sg = await bp.getSigner(wcAddress);
                        setSigner(sg);
                        setManualAddress(wcAddress);
                        setManualWalletProvider(prov);
                        setIsWalletConnect(true);
                        localStorage.setItem('aimining_is_walletconnect', 'true');
                        setHasSynced(true);
                        setFinalAddress(wcAddress);
                        setFinalIsConnected(true);
                        localStorage.setItem('aimining_manual_address', wcAddress);
                        localStorage.setItem('aimining_address', wcAddress);
                        walletConnectionsManager.saveConnection(wcAddress, localStorage.getItem('aimining_wallet_type') || 'walletconnect');
                        console.log('[TMA] Re-synced wallet from WC session:', wcAddress);
                        return;
                    }
                }
            } catch (err) {
                console.warn('[TMA] WC session check failed:', err);
            }

            // Fallback: update state if AppKit address became available
            if (address && !finalIsConnected) {
                setFinalAddress(address);
                setFinalIsConnected(true);
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('focus', handleVisibility);
        // Run immediately on mount to restore WC session after page refresh
        handleVisibility();
        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('focus', handleVisibility);
        };
    }, [address, manualAddress, finalIsConnected, signer, walletProvider, manualWalletProvider]);

    // Auto-connect when app is opened inside a wallet's built-in browser (NOT in TMA)
    useEffect(() => {
        const isTMA = !!(window as any).Telegram?.WebApp;
        if (isTMA) return; // Skip auto-connect in TMA — use WalletConnect instead
        if (finalIsConnected || manualAddress || signer) return;
        if (skipAutoConnectRef.current) return;

        // Don't auto-connect if user just opened normally (not from wallet browser)
        // Only auto-connect if a wallet-specific provider is detected
        const detectWalletProvider = () => {
            const eth = (window as any).ethereum;
            if (!eth) return null;

            // Check for wallet-specific flags
            if (eth.isMetaMask && !(window as any).trustwallet) return 'metamask';
            if ((window as any).trustwallet?.ethereum || eth.isTrust) return 'trust';
            if ((window as any).safepal?.ethereum || (window as any).safepalProvider || eth.isSafePal) return 'safepal';
            if ((window as any).tokenpocket?.ethereum || eth.isTokenPocket) return 'tokenpocket';
            if ((window as any).binance?.ethereum || eth.isBinance) return 'binance';
            if ((window as any).okxwallet?.ethereum || eth.isOKX) return 'okx';
            if ((window as any).bitget?.ethereum || eth.isBitget) return 'bitget';
            return null;
        };

        let retries = 0;
        const maxRetries = 12;
        const tryAutoConnect = async () => {
            const detectedWallet = detectWalletProvider();
            if (!detectedWallet) {
                if (retries < maxRetries) {
                    retries++;
                    setTimeout(tryAutoConnect, 1000);
                }
                return;
            }

            console.log('[AutoConnect] Detected wallet provider:', detectedWallet);
            const status = await connectInjectedWallet(detectedWallet);
            console.log('[AutoConnect] Result:', status);
            if (status !== 'connected' && retries < maxRetries) {
                retries++;
                setTimeout(tryAutoConnect, 2000);
            }
        };

        // Start checking after 1 second (give wallet browser time to inject)
        setTimeout(tryAutoConnect, 1000);
    }, [finalIsConnected, manualAddress, signer]);

    // Sync Signer when connection changes (High-Performance Mode for TMA)
    useEffect(() => {
        const syncSigner = async () => {
            const currentProvider = walletProvider || manualWalletProvider || (window as any).ethereum || (window as any).tokenpocket?.ethereum || (window as any).safepal?.ethereum || (window as any).trustwallet?.ethereum || (window as any).binance?.ethereum || (window as any).okxwallet?.ethereum || (window as any).bitget?.ethereum;
            const currentAddress = address || manualAddress;

            if (currentAddress && currentProvider) {
                try {
                    const isWc = checkIsWalletConnect(currentProvider);
                    // AppKit (Reown) uses WalletConnect under the hood — always mark as WC
                    const isAppKit = !!walletProvider && !manualWalletProvider;
                    if (isWc || isAppKit) {
                        setIsWalletConnect(true);
                        localStorage.setItem('aimining_is_walletconnect', 'true');
                        // Store WC peer name for redirect detection
                        try {
                            const session = currentProvider?.session || currentProvider?.provider?.session;
                            const peerName = session?.peer?.metadata?.name || '';
                            if (peerName) {
                                (window as any).__wcPeerName = peerName;
                                localStorage.setItem('aimining_last_wc_peer', peerName);
                            }
                        } catch {}
                    }

                    // Intercept provider request for transaction redirects (fixes background execution freeze)
                    if (currentProvider.request && !currentProvider._isIntercepted) {
                        try {
                            const originalRequest = currentProvider.request.bind(currentProvider);
                            currentProvider.request = async (args: any) => {
                                const method = args?.method;
                                const isSignOrTx = method === 'eth_sendTransaction' || 
                                                  method === 'personal_sign' || 
                                                  method === 'eth_sign' ||
                                                  method === 'eth_signTypedData' || 
                                                  method === 'eth_signTypedData_v4';

                                if (args && isSignOrTx) {
                                    const promise = originalRequest(args);
                                    // Never redirect for injected providers (wallet's
                                    // built-in dApp browser) — the native approval
                                    // prompt appears over the page automatically and
                                    // a redirect here navigates the browser away and
                                    // kills the pending prompt.
                                    const looksInjected = !!(currentProvider && (currentProvider.isMetaMask || currentProvider.isTrust || currentProvider.isSafePal || currentProvider.isTokenPocket || currentProvider.isBinance || currentProvider.isOKX || currentProvider.isBitget));
                                    if (isMobileUA() && !looksInjected && localStorage.getItem('aimining_is_walletconnect') === 'true') {
                                        const redirectUrl = getRedirectLinkForProvider(currentProvider);
                                        if (redirectUrl) {
                                            console.log(`[Web3] Intercepted ${method}, redirecting to wallet in 150ms...`);
                                            setTimeout(() => {
                                                launchExternalLink(redirectUrl);
                                            }, 150);
                                        }
                                    }
                                    return promise;
                                }
                                return originalRequest(args);
                            };
                            currentProvider._isIntercepted = true;
                            console.log("[Web3] Successfully patched currentProvider.request");
                        } catch (patchErr) {
                            console.warn("[Web3] Failed to patch provider request method:", patchErr);
                        }
                    }

                    const browserProvider = new BrowserProvider(currentProvider as any);
                    let s: JsonRpcSigner | null = null;

                    // CRITICAL: Direct JsonRpcSigner constructor FIRST (no RPC call = no hang)
                    // browserProvider.getSigner() calls eth_requestAccounts which HANGS in TMA
                    // because the wallet app isn't open to respond.
                    try {
                        s = new JsonRpcSigner(browserProvider, currentAddress);
                        console.log("[Web3] Created signer directly via JsonRpcSigner constructor");
                    } catch (directErr) {
                        console.warn("[Web3] Direct JsonRpcSigner creation failed, trying getSigner():", directErr);
                        // Only fallback to getSigner() if direct constructor fails
                        try {
                            s = await runWithTimeout('getSigner sync', browserProvider.getSigner(), 8000);
                        } catch (getSignerErr) {
                            console.warn("[Web3] getSigner() also failed:", getSignerErr);
                        }
                    }

                    if (s) {
                        setSigner(s);
                        setHasSynced(true);
                        localStorage.setItem('aimining_address', currentAddress);

                        // Track wallet connection
                        walletConnectionsManager.saveConnection(currentAddress, localStorage.getItem('aimining_wallet_type') || 'walletconnect');

                        const savedType = localStorage.getItem('aimining_wallet_type');
                        if (!savedType) {
                            const conn = walletConnectionsManager.getByWallet(currentAddress);
                            const wt = conn?.walletType || 'walletconnect';
                            setWalletType(wt);
                            setActiveWalletType(wt);
                        }

                        // Clear manual address if it's different from the native one being synced
                        if (manualAddress && manualAddress.toLowerCase() !== currentAddress.toLowerCase()) {
                            setManualAddress(null);
                            localStorage.removeItem('aimining_manual_address');
                        }
                    }
                } catch (e) {
                    console.error("[Web3] Signer sync status:", e);
                }
            } else if (!address && !manualAddress) {
                setSigner(null);
                setHasSynced(false);
                localStorage.removeItem('aimining_address');
            }
        };

        // Faster sync for better UX
        const timeout = setTimeout(() => syncSigner(), 500);
        syncSigner(); // Immediate attempt

        // FIX: Manual Re-sync on App Resume (Fixes Telegram background freeze)
        let lastSync = 0;
        const handleFocus = async () => {
            const now = Date.now();
            if (now - lastSync < 3000) return; // 3s throttle for stability
            lastSync = now;

            // TMA FIX: When Telegram WebView returns to foreground after user
            // approved a transaction in the wallet app, the WC relay WebSocket
            // may have been killed by the OS. Reconnect it proactively so
            // subsequent eth_sendTransaction calls don't hang forever.
            const isTMA = !!(window as any).Telegram?.WebApp;
            if (isTMA) {
                const wp = (window as any).__globalAppKitProvider || (window as any).__manualWalletProvider;
                if (wp && typeof wp.connect === 'function' && !wp.connected) {
                    try {
                        console.log('[Web3] TMA resume: WC provider disconnected, reconnecting...');
                        await wp.connect();
                        console.log('[Web3] TMA resume: WC provider reconnected');
                    } catch (e) {
                        console.warn('[Web3] TMA resume: WC reconnect failed:', e);
                    }
                }
            }

            syncSigner();
        };

        window.addEventListener("focus", handleFocus);
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") handleFocus();
        });

        // Referral Injection Logic
        const urlParams = new URLSearchParams(window.location.search);
        const ref = urlParams.get('ref') || urlParams.get('start');
        if (ref && /^0x[a-fA-F0-9]{40}$/.test(ref)) {
            localStorage.setItem('aimining_referrer', ref);
            setReferral(ref);
        } else {
            setReferral(localStorage.getItem('aimining_referrer'));
        }

        // FAST SYNC: High-speed interval to catch address updates from AppKit
        const interval = setInterval(() => {
            // Sync from AppKit if connected but our state isn't updated
            if (address && isConnected && !finalIsConnected) {
                console.log('[FastSync] AppKit connected, syncing:', address);
                setFinalAddress(address);
                setFinalIsConnected(true);
                setManualAddress(address);
                localStorage.setItem('aimining_manual_address', address);
                localStorage.setItem('aimining_address', address);
            }

            // Sync signer from AppKit walletProvider
            if (address && isConnected && walletProvider && !signer) {
                const bp = new BrowserProvider(walletProvider as any);
                bp.getSigner(address).then(s => {
                    setSigner(s);
                    setManualWalletProvider(walletProvider);
                    console.log('[FastSync] Synced signer from AppKit walletProvider');
                }).catch(() => {});
            }

            const savedAddress = localStorage.getItem('aimining_manual_address') || localStorage.getItem('aimining_address');
            if (savedAddress && !manualAddress) {
                setManualAddress(savedAddress);
            }

            if ((window as any).ethereum?.selectedAddress) {
                localStorage.setItem('aimining_address', (window as any).ethereum.selectedAddress);
                if (!manualAddress && !address) {
                    setManualAddress((window as any).ethereum.selectedAddress);
                }
            }
        }, 800);

        // GLOBAL HIGH-FIDELITY TICKER: Animates the mining balance every second across ALL pages
        const ticker = setInterval(() => {
            setMiningStats((prev: any) => {
                if (!prev.isLoaded) return prev;
                
                const dailyProfit = parseFloat(prev.dailyProfit || '0');
                if (isNaN(dailyProfit) || dailyProfit <= 0) return prev;
                
                const rewardPerSecond = dailyProfit / 86400;
                const currentBalance = parseFloat(prev.balance || '0');
                if (isNaN(currentBalance)) return prev;

                return {
                    ...prev,
                    balance: (currentBalance + rewardPerSecond).toFixed(14)
                };
            });
        }, 1000);

        return () => {
            clearTimeout(timeout);
            clearInterval(interval);
            clearInterval(ticker);
            window.removeEventListener("focus", handleFocus);
        };
    }, [isConnected, walletProvider, address, hasSynced, manualWalletProvider, manualAddress]);

    const connect = async () => {
        // Always use the custom WalletConnect modal. The AppKit modal has two
        // problems: (1) in the Telegram WebView its relay is unreliable, and
        // (2) in normal browsers (e.g. Chrome on desktop) its wallet list
        // redirects to wallet DOWNLOAD pages for mobile-only wallets. The
        // custom modal shows a scannable QR code on desktop/laptop and a
        // wallet deep link on mobile.
        console.log("[Web3] Opening custom WalletConnect modal");
        setIsConnectModalOpen(true);
    };

    const connectInjectedWallet = async (preferredWallet?: string): Promise<'connected' | 'not_installed' | 'failed'> => {
        // NOTE: Only call this when window.ethereum is already available (checked by caller)
        // The 7.5s wait loop has been removed since it blocks the UI unnecessarily
        let ethereum = (window as any).ethereum;
        let injectedProvider = null;

        if (preferredWallet === 'tokenpocket') {
            injectedProvider = (window as any).tokenpocket?.ethereum || ethereum;
        } else if (preferredWallet === 'metamask') {
            if (ethereum) {
                if (ethereum.isMetaMask && !ethereum.isTrust && !ethereum.isSafePal && !ethereum.isTokenPocket) {
                    injectedProvider = ethereum;
                } else if (ethereum.providers && Array.isArray(ethereum.providers)) {
                    injectedProvider = ethereum.providers.find((p: any) => p.isMetaMask && !p.isTrust && !p.isSafePal && !p.isTokenPocket);
                    if (!injectedProvider) {
                        injectedProvider = ethereum.providers.find((p: any) => p.isMetaMask);
                    }
                } else if (ethereum.isMetaMask) {
                    injectedProvider = ethereum;
                } else {
                    injectedProvider = ethereum; // fallback
                }
            }
        } else if (preferredWallet === 'trust') {
            if (ethereum) {
                if (ethereum.isTrust) {
                    injectedProvider = ethereum;
                } else if (ethereum.providers && Array.isArray(ethereum.providers)) {
                    injectedProvider = ethereum.providers.find((p: any) => p.isTrust) || ethereum;
                } else {
                    injectedProvider = ethereum;
                }
            }
        } else if (preferredWallet === 'safepal') {
            const safepalObj = (window as any).safepal || (window as any).safepalProvider;
            injectedProvider = safepalObj?.ethereum || ethereum;
            if (ethereum && !injectedProvider) {
                if (ethereum.isSafePal) {
                    injectedProvider = ethereum;
                } else if (ethereum.providers && Array.isArray(ethereum.providers)) {
                    injectedProvider = ethereum.providers.find((p: any) => p.isSafePal) || ethereum;
                } else {
                    injectedProvider = ethereum;
                }
            }
        } else {
            injectedProvider = (window as any).tokenpocket?.ethereum || ethereum;
        }

        const web3Provider = (window as any).web3?.currentProvider;
        if (!injectedProvider && web3Provider) {
            injectedProvider = web3Provider;
        }

        if (!injectedProvider?.request) {
            return 'not_installed';
        }

        try {
            // 1. Request accounts first to establish connection
            const accounts = await runWithTimeout<string[]>(
                `${preferredWallet || 'injected'} eth_requestAccounts`,
                injectedProvider.request({ method: 'eth_requestAccounts' }) as Promise<string[]>
            );
            const connectedAddress = accounts?.[0] || injectedProvider.selectedAddress;
            if (!connectedAddress) return 'failed';

            // 2. Check current chain ID and switch if necessary
            try {
                const currentChainId = await runWithTimeout(
                    `${preferredWallet || 'injected'} eth_chainId`,
                    injectedProvider.request({ method: 'eth_chainId' })
                );
                const currentChainIdStr = typeof currentChainId === 'string' ? currentChainId : '0x' + Number(currentChainId).toString(16);

                if (currentChainIdStr.toLowerCase() !== BSC_CHAIN_ID_HEX.toLowerCase()) {
                    try {
                        await runWithTimeout(
                            `${preferredWallet || 'injected'} wallet_switchEthereumChain`,
                            injectedProvider.request({
                                method: 'wallet_switchEthereumChain',
                                params: [{ chainId: BSC_CHAIN_ID_HEX }]
                            })
                        );
                    } catch (switchError: any) {
                        if (switchError?.code === 4902 || switchError?.data?.originalError?.code === 4902) {
                            await runWithTimeout(
                                `${preferredWallet || 'injected'} wallet_addEthereumChain`,
                                injectedProvider.request({
                                    method: 'wallet_addEthereumChain',
                                    params: [{
                                        chainId: BSC_CHAIN_ID_HEX,
                                        chainName: 'BNB Smart Chain',
                                        nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
                                        rpcUrls: ['https://bsc-rpc.publicnode.com'],
                                        blockExplorerUrls: ['https://bscscan.com']
                                    }]
                                })
                            );
                        } else {
                            throw switchError;
                        }
                    }
                }
            } catch (chainErr) {
                console.warn("[Web3] Switch chain failed or was rejected:", chainErr);
                return 'failed';
            }

            const browserProvider = new BrowserProvider(injectedProvider);
            const injectedSigner = await browserProvider.getSigner(connectedAddress);

            const wt = preferredWallet || 'injected';
            setManualAddress(connectedAddress);
            setManualWalletProvider(injectedProvider);
            setSigner(injectedSigner);
            setWalletType(wt);
            setActiveWalletType(wt);
            setIsWalletConnect(false);
            localStorage.setItem('aimining_is_walletconnect', 'false');
            setHasSynced(true);
            setFinalAddress(connectedAddress);
            setFinalIsConnected(true);
            localStorage.setItem('aimining_manual_address', connectedAddress);
            localStorage.setItem('aimining_address', connectedAddress);

            // Track wallet connection
            walletConnectionsManager.saveConnection(connectedAddress, wt);

            setIsConnectModalOpen(false);
            setTpLoading(false);
            setShowTpFallback(false);
            return 'connected';
        } catch (err) {
            console.warn("[Web3] Injected wallet connect failed:", err);
            return 'failed';
        }
    };

    const handleWalletClick = async (wallet: string) => {
        const isTMA = !!(window as any).Telegram?.WebApp;

        // 1. Quick check: are we inside a wallet dApp browser?
        const ethereum = (window as any).ethereum;
        if (ethereum) {
            setConnectingWallet(wallet);
            const result = await connectInjectedWallet(wallet);
            if (result === 'connected') {
                console.log(`[Web3] ${wallet} connected via injection`);
                return;
            }
        }

        // 2. In TMA — AppKit modal is unreliable in Telegram WebView (WebSocket relay issues).
        //    Go straight to the custom WalletConnect flow that generates a WC URI
        //    and shows an "Open Wallet" deep-link button.
        if (isTMA) {
            console.log(`[Web3] ${wallet}: TMA detected, opening custom WC modal`);
            setConnectingWallet(wallet);
            setIsConnectModalOpen(true);
            return;
        }

        // 3. Not in wallet browser, not TMA — desktop or mobile browser.
        //    Use the custom WalletConnect flow (NOT AppKit — its wallet list
        //    redirects to wallet DOWNLOAD pages on desktop for mobile-only
        //    wallets). The custom modal shows a scannable QR code on desktop
        //    and a deep link on mobile (where the wallet app is installed).
        console.log(`[Web3] ${wallet}: browser detected, opening custom WC modal`);
        setConnectingWallet(wallet);
        setIsConnectModalOpen(true);
    };

    const handleDirectConnect = async () => {
        const isTMA = !!(window as any).Telegram?.WebApp;
        if (isTMA) {
            setIsConnectModalOpen(true);
            return;
        }
        try {
            await open({ view: 'Connect' });
        } catch (err) {
            console.warn("[Web3] Connect failed:", err);
        }
    };

    const openInWalletBrowser = (_type: 'safepal' | 'tokenpocket') => {
        // Disabled — everything works inside Telegram Mini App via WalletConnect
        console.log('[Wallet] openInWalletBrowser disabled — use WalletConnect in TMA');
    };

    // Auto-reconnect on boot & Init Raw Client
    useEffect(() => {
        const bootSync = async () => {
            if (skipAutoConnectRef.current) return; // Skip if user just disconnected
            const params = new URLSearchParams(window.location.search);
            if (params.get('tpconnect') === '1') {
                const status = await connectInjectedWallet('tokenpocket');
                if (status === 'connected') {
                    params.delete('tpconnect');
                    const cleanUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash}`;
                    window.history.replaceState({}, '', cleanUrl);
                    return;
                }
            }

            try {
                const provider = await getGlobalEthereumProvider();

                if (provider.session) {
                    // EXPIRED SESSION CHECK — an expired session LOOKS connected
                    // (session + accounts still in storage) but transactions never
                    // reach the wallet (no approval popup). Disconnect and require
                    // a clean reconnect instead of silently restoring it.
                    if (isWCSessionExpired(provider)) {
                        console.warn('[Web3] Boot: stored WC session is EXPIRED — disconnecting so the user reconnects cleanly');
                        try { await provider.disconnect(); } catch {}
                        localStorage.removeItem('aimining_is_walletconnect');
                        localStorage.removeItem('aimining_address');
                        localStorage.removeItem('aimining_manual_address');
                    } else {
                    const accounts = provider.accounts;
                    if (accounts && accounts.length > 0) {
                        const connectedAddress = accounts[0];

                        // Intercept provider request for transaction redirects (fixes background execution freeze)
                        if (!provider._isIntercepted) {
                            const originalRequest = provider.request.bind(provider);
                            (provider as any).request = async (args: any) => {
                                const method = args?.method;
                                const isSignOrTx = method === 'eth_sendTransaction' || 
                                                  method === 'personal_sign' || 
                                                  method === 'eth_sign' ||
                                                  method === 'eth_signTypedData' || 
                                                  method === 'eth_signTypedData_v4';
                                
                                if (args && isSignOrTx) {
                                    const promise = originalRequest(args);
                                    // Only redirect on mobile (wallet app on same device).
                                    // Desktop: the deep link just opens the wallet's
                                    // download website — the user scans/checks their phone.
                                    if (isMobileUA()) {
                                        const redirectUrl = getRedirectLinkForProvider(provider);
                                        if (redirectUrl) {
                                            console.log(`[Web3] Intercepted ${method}, redirecting to wallet in 150ms...`);
                                            setTimeout(() => {
                                                launchExternalLink(redirectUrl);
                                            }, 150);
                                        }
                                    }
                                    return promise;
                                }
                                return originalRequest(args);
                            };
                            provider._isIntercepted = true;
                        }

                        setManualAddress(connectedAddress);
                        setManualWalletProvider(provider);
                        (window as any).__manualWalletProvider = provider; // immediate access for getRawProvider()
                        setGlobalAppKitProvider(provider); // also set global for cross-module access
                        setHasSynced(true);
                        setFinalAddress(connectedAddress);
                        setFinalIsConnected(true);
                        localStorage.setItem('aimining_manual_address', connectedAddress);
                        localStorage.setItem('aimining_address', connectedAddress);
                        setIsWalletConnect(true);
                        localStorage.setItem('aimining_is_walletconnect', 'true');
                        return;
                    }
                    }
                }
            } catch (err) {
                console.warn("[Web3] Session Restore failed:", err);
            }

            // Secondary check for injected providers on boot
            const saved = localStorage.getItem('aimining_manual_address') || localStorage.getItem('aimining_address');
            if (saved) setManualAddress(saved);
        };

        bootSync();
    }, []);

    const resetActiveConnection = async () => {
        if (activeProvider) {
            // Cleanup WC event listeners (visibilitychange, session_update, etc.)
            if (activeProvider._wcCleanup) {
                try { activeProvider._wcCleanup(); } catch {}
            }
            try {
                if (typeof activeProvider.disconnect === 'function') {
                    await activeProvider.disconnect();
                }
            } catch (e) {
                console.warn("[Web3] Disconnect active provider error:", e);
            }
            setActiveProvider(null);
            setActiveUri(null);
        }
    };

    // Helper: check if WC provider has accounts and finalize connection
    const checkAndFinalizeConnection = async (provider: any, retries = 3): Promise<boolean> => {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                // Check both .accounts and .session for connected state
                const accounts = provider.accounts || (provider.session?.namespaces?.eip155?.accounts?.map((a: string) => a.split(':').pop()) ?? []);
                console.log(`[Web3] checkAndFinalizeConnection attempt ${attempt}/${retries} — accounts:`, accounts?.length, 'connected:', provider.connected);

                if (accounts && accounts.length > 0) {
                    const connectedAddress = accounts[0];
                    const browserProvider = new BrowserProvider(provider);
                    const s = await browserProvider.getSigner(connectedAddress);
                    setSigner(s);
                    setManualAddress(connectedAddress);
                    setManualWalletProvider(provider);
                    setGlobalAppKitProvider(provider); // Also set global so sendRawTx in useStaking can find it
                    setIsWalletConnect(true);
                    localStorage.setItem('aimining_is_walletconnect', 'true');
                    // Save wallet type so getWalletRedirectUrl() returns the correct wallet deep link
                    // Check session peer metadata FIRST — most reliable source
                    const peerName = provider.session?.peer?.metadata?.name || '';
                    const peerDetected = peerName.toLowerCase().includes('trust') ? 'trust'
                        : peerName.toLowerCase().includes('metamask') ? 'metamask'
                        : peerName.toLowerCase().includes('safepal') ? 'safepal'
                        : peerName.toLowerCase().includes('tokenpocket') ? 'tokenpocket'
                        : peerName.toLowerCase().includes('binance') ? 'binance'
                        : peerName.toLowerCase().includes('okx') ? 'okx'
                        : peerName.toLowerCase().includes('bitget') ? 'bitget'
                        : null;
                    const detectedType = peerDetected || connectingWallet || localStorage.getItem('aimining_wallet_type') || 'walletconnect';
                    console.log(`[Web3] Wallet type detected: peer="${peerName}" → "${peerDetected}", connectingWallet="${connectingWallet}", final="${detectedType}"`);
                    setWalletType(detectedType);
                    setActiveWalletType(detectedType);
                    setHasSynced(true);
                    setFinalAddress(connectedAddress);
                    setFinalIsConnected(true);
                    localStorage.setItem('aimining_manual_address', connectedAddress);
                    localStorage.setItem('aimining_address', connectedAddress);
                    walletConnectionsManager.saveConnection(connectedAddress, localStorage.getItem('aimining_wallet_type') || 'walletconnect');
                    setIsConnectModalOpen(false);
                    setConnectingWallet(null);
                    setActiveUri(null);

                    // Cleanup WC event listeners
                    if (provider._wcCleanup) provider._wcCleanup();
                    console.log('[Web3] WalletConnect connection finalized for:', connectedAddress);
                    return true;
                }

                // Wait before retry (give WebSocket time to reconnect)
                if (attempt < retries) {
                    console.log(`[Web3] No accounts yet, waiting 2s before retry...`);
                    await new Promise(r => setTimeout(r, 2000));
                }
            } catch (err) {
                console.warn(`[Web3] checkAndFinalizeConnection attempt ${attempt} error:`, err);
                if (attempt < retries) await new Promise(r => setTimeout(r, 2000));
            }
        }
        return false;
    };

    const prepareWalletConnect = async () => {
        if (isGeneratingUri) {
            console.log('[Web3] prepareWalletConnect already running, skipping');
            return;
        }
        setIsGeneratingUri(true);
        console.log('[Web3] prepareWalletConnect starting...');
        try {
            // Always create a FRESH provider — reusing a stale provider after a failed
            // connection causes corrupted internal state
            const { EthereumProvider } = await import('@walletconnect/ethereum-provider');
            const provider = await EthereumProvider.init({
                projectId,
                metadata,
                showQrModal: false,
                chains: [56],
                methods: ["eth_sendTransaction", "eth_sign", "personal_sign", "eth_signTypedData"],
                events: ["accountsChanged", "chainChanged"],
                rpcMap: { 56: 'https://bsc-rpc.publicnode.com' }
            });
            globalEthereumProvider = provider;
            console.log('[Web3] Fresh WC provider created');

            // Intercept provider request for transaction redirects (fixes background execution freeze)
            if (!(provider as any)._isIntercepted) {
                const originalRequest = provider.request.bind(provider);
                (provider as any).request = async (args: any) => {
                    const method = args?.method;
                    const isSignOrTx = method === 'eth_sendTransaction' || 
                                      method === 'personal_sign' || 
                                      method === 'eth_sign' ||
                                      method === 'eth_signTypedData' || 
                                      method === 'eth_signTypedData_v4';

                    if (args && isSignOrTx) {
                        const promise = originalRequest(args);
                        // Only redirect on mobile (the wallet app is on the same
                        // device). On desktop/laptop the deep link just opens the
                        // wallet's download website — the user scans the QR /
                        // checks their phone instead.
                        if (isMobileUA()) {
                            const redirectUrl = getRedirectLinkForProvider(provider);
                            if (redirectUrl) {
                                console.log(`[Web3] Intercepted ${method}, redirecting to wallet in 150ms...`);
                                setTimeout(() => {
                                    launchExternalLink(redirectUrl);
                                }, 150);
                            }
                        }
                        return promise;
                    }
                    return originalRequest(args);
                };
                (provider as any)._isIntercepted = true;
            }

            // Remove existing listener safely using stored reference
            if (activeDisplayUriCallback) {
                try {
                    provider.removeListener('display_uri', activeDisplayUriCallback);
                } catch (e) {
                    console.warn("[Web3] removeListener failed:", e);
                }
            }

            // Define new listener
            activeDisplayUriCallback = (uri: string) => {
                console.log("[Web3] Generated display_uri:", uri);
                setActiveUri(uri);
            };
            provider.on('display_uri', activeDisplayUriCallback);

            setActiveProvider(provider);
            setIsGeneratingUri(false);

            try {
                console.log('[Web3] Calling provider.connect() (fire-and-forget)...');
                provider.connect().then(() => {
                    console.log('[Web3] provider.connect() resolved');
                    checkAndFinalizeConnection(provider);
                }).catch((err: any) => {
                    console.warn('[Web3] provider.connect() rejected:', err?.message);
                });

                // Listen on signClient directly (survives provider.connect rejection)
                const sc = (provider as any).signClient || (provider as any).client;
                if (sc) {
                    sc.on('session_ping', () => checkAndFinalizeConnection(provider));
                    sc.on('session_update', () => checkAndFinalizeConnection(provider));
                }

                // When user returns from wallet app, force relay reconnect
                const onVisibilityChange = async () => {
                    if (document.visibilityState === 'visible') {
                        console.log('[Web3] App visible — reconnecting WC relay...');
                        try {
                            const sc2 = (provider as any).signClient || (provider as any).client;
                            if (sc2?.core?.relayer?.transportOpen) {
                                await sc2.core.relayer.transportOpen();
                                console.log('[Web3] WC relay reconnected');
                            }
                        } catch (e) { console.warn('[Web3] relay reconnect err:', e); }
                        setTimeout(() => checkAndFinalizeConnection(provider), 2000);
                    }
                };
                document.addEventListener('visibilitychange', onVisibilityChange);
                (provider as any)._wcCleanup = () => {
                    document.removeEventListener('visibilitychange', onVisibilityChange);
                };

            } catch (innerErr) {
                console.warn("[Web3] Inner connect setup error:", innerErr);
            } finally {
                setIsGeneratingUri(false);
            }
        } catch (err) {
            console.error("[Web3] Pre-connect init failed:", err);
            setIsGeneratingUri(false);
            setActiveUri(null);
            setActiveProvider(null);
            setConnectingWallet(null);
        }
    };

    // Fast URI generation for TMA — removed (unused after TMA dapp browser approach)

    useEffect(() => {
        if (isConnectModalOpen) {
            prepareWalletConnect();
        } else {
            setConnectingWallet(null);
            setIsGeneratingUri(false); // Reset guard so prepareWalletConnect can run again
            resetActiveConnection();
        }
    }, [isConnectModalOpen]);

    useEffect(() => {
        const isTMA = !!(window as any).Telegram?.WebApp;
        if (activeUri && connectingWallet) {
            if (isTMA) {
                // In TMA: Don't auto-redirect — show "Open Wallet" button in the modal
                // User taps the button when ready to switch to wallet app
                console.log('[Web3] WC URI ready, showing "Open Wallet" button in modal for:', connectingWallet);
            } else if (isMobileUA()) {
                // Non-TMA MOBILE: auto-open wallet deep link (wallet app is on
                // the same phone). DESKTOP: never auto-open the deep link — it
                // just opens the wallet's DOWNLOAD website. The modal shows a
                // scannable QR code instead.
                const encoded = encodeURIComponent(activeUri);
                const link = getWalletConnectionLink(connectingWallet, encoded);
                if (link) {
                    console.log('[Web3] Opening WC deeplink for:', connectingWallet);
                    launchExternalLink(link);
                }
            }
        } else if (connectingWallet && !isTMA && isMobileUA()) {
            // Non-TMA mobile only: open dapp in wallet browser as fallback
            const dappUrl = getDappUrl();
            const deepLink = getWalletDappDeepLink(connectingWallet, dappUrl);
            launchExternalLink(deepLink);
        }
    }, [activeUri, connectingWallet]);

    // Timeout: if WC URI not generated within 20 seconds, reset and show error
    useEffect(() => {
        if (!connectingWallet || activeUri) return;
        const isTMA = !!(window as any).Telegram?.WebApp;
        if (!isTMA) return;

        const timer = setTimeout(() => {
            if (connectingWallet && !activeUri) {
                console.warn('[Web3] WC URI generation timeout (20s). Showing fallback...');
                // Don't reset — let the user see the "Open Wallet" button as fallback
            }
        }, 20000);

        return () => clearTimeout(timer);
    }, [connectingWallet, activeUri]);

    const disconnect = async () => {
        console.log("Starting disconnect process...");
        _setIsDisconnectModalOpen(false);
        skipAutoConnectRef.current = true; // Block auto-reconnect

        try {
            // 1. AppKit Disconnect (with timeout)
            try {
                const disconnectPromise = appKitDisconnect();
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
                await Promise.race([disconnectPromise, timeoutPromise]);
            } catch (e) {
                console.warn("AppKit disconnect skipped:", e);
            }

            // 2. Manual Provider Disconnect
            if (manualWalletProvider && typeof manualWalletProvider.disconnect === 'function') {
                try { await manualWalletProvider.disconnect(); } catch (e) { console.warn("Manual provider disconnect:", e); }
            }

            // 3. Global WC Provider Disconnect
            if (globalEthereumProvider && typeof globalEthereumProvider.disconnect === 'function') {
                try { await globalEthereumProvider.disconnect(); } catch (e) {}
            }
            globalEthereumProvider = null;
            globalEthereumProviderPromise = null;

            // 4. Clear ALL wallet-related localStorage
            const keysToRemove = Object.keys(localStorage).filter(key =>
                key.startsWith('wc@2') ||
                key.startsWith('aimining_') ||
                key.includes('walletconnect') ||
                key.includes('WALLETCONNECT') ||
                key.includes('appkit') ||
                key.includes('wcm@2') ||
                key.includes('wallet_') ||
                key.includes('wc_')
            );
            keysToRemove.forEach(key => localStorage.removeItem(key));

            // 5. Reset ALL state
            setManualAddress(null);
            setManualWalletProvider(null);
            setWalletType(null);
            _activeWalletType = null;
            localStorage.removeItem('aimining_wallet_type');
            setSigner(null);
            setHasSynced(false);
            setFinalAddress(undefined);
            setFinalIsConnected(false);
            setIsWalletConnect(false);
            setConnectingWallet(null);
            setActiveUri(null);
            setActiveProvider(null);

            console.log("Disconnect successful, reloading...");
            try { sessionStorage.clear(); } catch {}

            setTimeout(() => {
                window.location.href = window.location.origin + '?disconnected=true';
            }, 300);
        } catch (error) {
            console.error("Critical disconnect error:", error);
            localStorage.clear();
            sessionStorage.clear();
            window.location.reload();
        }
    };

    const forceSync = async () => { console.log("Force sync"); };
    const hardReset = () => { localStorage.clear(); window.location.reload(); };
    const stakeNow = async () => { console.log("Stake now"); };

    const setIsDisconnectModalOpen = (isOpen: boolean) => {
        _setIsDisconnectModalOpen(isOpen);
    };


    return (
        <WalletContext.Provider value={{
            address: finalAddress || undefined,
            isConnected: finalIsConnected,
            signer,
            connect,
            disconnect,
            isConnecting: isConnecting,
            walletType,
            walletProvider: walletProvider || manualWalletProvider,
            referral,
            isWalletConnect,
            forceSync,
            hardReset,
            setIsDisconnectModalOpen,
            setIsConnectModalOpen: (open: boolean) => {
                if (!open) {
                    setConnectingWallet(null);
                    setShowTpFallback(false);
                }
                setIsConnectModalOpen(open);
            },
            stakeNow,
            openInWalletBrowser: openInWalletBrowser as any,
            manualWalletProvider,
            miningStats,
            setMiningStats
        }}>
            {children}
            {isConnectModalOpen && (
                <div className="fixed inset-0 z-[2000] flex items-end justify-center">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => {
                        setIsConnectModalOpen(false);
                        setConnectingWallet(null);
                        setShowTpFallback(false);
                    }}></div>
                    <div className="relative w-full max-w-lg bg-[#0a0a0a] border-t border-white/10 rounded-t-[40px] p-8 pb-14 animate-slide-up shadow-2xl transition-all max-h-[90vh] overflow-y-auto no-scrollbar">
                        <div className="w-16 h-1.5 bg-white/10 rounded-full mx-auto mb-8 sticky top-0"></div>

                        {connectingWallet === 'tokenpocket' && (
                            <div className="mb-10 flex flex-col items-center gap-6 animate-fade-in py-6 bg-primary/5 rounded-[32px] border border-primary/10 mx-2">
                                <div className="relative">
                                    <div className="w-16 h-16 border-4 border-primary/20 rounded-full"></div>
                                    <div className="absolute inset-0 w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <img src={tpLogo} className="w-8 h-8 rounded-lg animate-pulse" alt="TP" />
                                    </div>
                                </div>
                                <div className="text-center px-6">
                                    <h4 className="text-primary font-black uppercase text-[14px] tracking-[4px] mb-2">Opening TokenPocket</h4>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed">
                                        Please Wait while we redirect you...
                                    </p>
                                </div>

                                {showTpFallback && (
                                    <button
                                        onClick={() => {
                                            clearWalletConnectPairingCache();
                                            const tg = (window as any).Telegram?.WebApp;
                                            if (tg) {
                                                openInWalletBrowser('tokenpocket');
                                                return;
                                            }
                                            openTokenPocketApp(true);
                                        }}
                                        className="mt-2 bg-primary text-black px-8 py-4 rounded-[20px] flex items-center gap-3 transition-all active:scale-95 border-none font-black text-[11px] uppercase tracking-[2px] shadow-neon cursor-pointer"
                                    >
                                        <span className="material-icons-round text-lg">rocket_launch</span>
                                        Open TokenPocket
                                    </button>
                                )}
                            </div>
                        )}

                        {connectingWallet && connectingWallet !== 'tokenpocket' && (
                            <div className="mb-10 flex flex-col items-center gap-6 animate-fade-in py-6 bg-[#FFD700]/5 rounded-[32px] border border-[#FFD700]/10 mx-2">
                                <div className="relative">
                                    <div className="w-16 h-16 border-4 border-[#FFD700]/20 rounded-full"></div>
                                    <div className="absolute inset-0 w-16 h-16 border-4 border-[#FFD700] border-t-transparent rounded-full animate-spin"></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <img 
                                            src={
                                                connectingWallet === 'metamask' ? metamaskLogo :
                                                connectingWallet === 'trust' ? trustLogo :
                                                connectingWallet === 'safepal' ? safepalLogo :
                                                connectingWallet === 'tokenpocket' ? tpLogo :
                                                undefined
                                            } 
                                            className="w-8 h-8 rounded-lg animate-pulse" 
                                            alt={connectingWallet} 
                                        />
                                    </div>
                                </div>
                                <div className="text-center px-6">
                                    <h4 className="text-[#FFD700] font-black uppercase text-[14px] tracking-[4px] mb-2">Connecting {connectingWallet === 'metamask' ? 'MetaMask' : connectingWallet === 'trust' ? 'Trust Wallet' : connectingWallet === 'safepal' ? 'SafePal' : connectingWallet === 'tokenpocket' ? 'TokenPocket' : connectingWallet === 'binance' ? 'Binance Web3' : connectingWallet === 'okx' ? 'OKX Wallet' : 'Wallet'}</h4>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed">
                                        {activeUri
                                            ? (isMobileUA()
                                                ? "Please approve the connection request in your wallet app."
                                                : "Scan this QR code with your wallet's mobile app to connect.")
                                            : (window as any).Telegram?.WebApp
                                                ? "Opening your wallet app... If nothing happens, tap the button below."
                                                : "Initializing secure connection... Please wait."}
                                    </p>
                                </div>

                                {activeUri ? (
                                    // Desktop / laptop: show a scannable QR code — the wallet deep
                                    // link would only open the wallet's DOWNLOAD page there.
                                    // Mobile (incl. Telegram): show the "Open Wallet" deep-link button.
                                    !isMobileUA() ? (
                                        <div className="flex flex-col items-center gap-3 mt-2">
                                            <div className="bg-white p-3 rounded-2xl shadow-neon">
                                                <img
                                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=0&data=${encodeURIComponent(activeUri)}`}
                                                    alt="WalletConnect QR Code"
                                                    className="w-56 h-56 block"
                                                />
                                            </div>
                                            <div className="text-[10px] text-gray-500 font-black uppercase tracking-wider text-center px-4">
                                                Open {connectingWallet === 'metamask' ? 'MetaMask' : connectingWallet === 'trust' ? 'Trust Wallet' : connectingWallet === 'safepal' ? 'SafePal' : connectingWallet === 'tokenpocket' ? 'TokenPocket' : connectingWallet === 'binance' ? 'Binance Web3' : connectingWallet === 'okx' ? 'OKX Wallet' : 'your wallet'} on your phone & scan
                                            </div>
                                        </div>
                                    ) : (
                                    <button
                                        onClick={() => {
                                             const encoded = encodeURIComponent(activeUri);
                                             const link = getWalletConnectionLink(connectingWallet, encoded);
                                             if (link) {
                                                 launchExternalLink(link);
                                             }
                                        }}
                                        className="mt-2 bg-[#FFD700] text-black px-8 py-4 rounded-[20px] flex items-center gap-3 transition-all active:scale-95 border-none font-black text-[11px] uppercase tracking-[2px] shadow-neon cursor-pointer"
                                    >
                                        <span className="material-icons-round text-lg">rocket_launch</span>
                                        Open {connectingWallet === 'metamask' ? 'MetaMask' : connectingWallet === 'trust' ? 'Trust Wallet' : connectingWallet === 'safepal' ? 'SafePal' : 'TokenPocket'}
                                    </button>
                                    )
                                ) : (
                                    // WC URI not ready yet — show loading state, NO DApp browser redirect
                                    <div className="flex flex-col items-center gap-3 mt-2">
                                        <div className="w-6 h-6 border-2 border-[#FFD700]/30 border-t-[#FFD700] rounded-full animate-spin"></div>
                                        <div className="text-[10px] text-gray-500 font-black uppercase tracking-wider">
                                            Generating secure connection link...
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {!connectingWallet && (
                            <>
                                <h3 className="text-xl font-black text-white uppercase tracking-widest text-center mb-8 font-display">Connect Your Wallet</h3>

                                <div className="space-y-2 mb-4">
                                    <button
                                        onClick={() => handleWalletClick('metamask')}
                                        className="w-full flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all active:scale-[0.98] cursor-pointer"
                                    >
                                        <img src={metamaskLogo} className="w-8 h-8 rounded-lg" alt="MetaMask" />
                                        <span className="font-bold text-white flex-1 text-left text-sm">MetaMask</span>
                                        <span className="material-icons-round text-gray-600 text-lg">chevron_right</span>
                                    </button>

                                    <button
                                        onClick={() => handleWalletClick('trust')}
                                        className="w-full flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all active:scale-[0.98] cursor-pointer"
                                    >
                                        <img src={trustLogo} className="w-8 h-8 rounded-lg" alt="Trust Wallet" />
                                        <span className="font-bold text-white flex-1 text-left text-sm">Trust Wallet</span>
                                        <span className="material-icons-round text-gray-600 text-lg">chevron_right</span>
                                    </button>

                                    <button
                                        onClick={() => handleWalletClick('safepal')}
                                        className="w-full flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all active:scale-[0.98] cursor-pointer"
                                    >
                                        <img src={safepalLogo} className="w-8 h-8 rounded-lg" alt="SafePal" />
                                        <span className="font-bold text-white flex-1 text-left text-sm">SafePal</span>
                                        <span className="material-icons-round text-gray-600 text-lg">chevron_right</span>
                                    </button>

                                    <button
                                        onClick={() => handleWalletClick('tokenpocket')}
                                        className="w-full flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all active:scale-[0.98] cursor-pointer"
                                    >
                                        <img src={tpLogo} className="w-8 h-8 rounded-lg" alt="TokenPocket" />
                                        <span className="font-bold text-white flex-1 text-left text-sm">TokenPocket</span>
                                        <span className="material-icons-round text-gray-600 text-lg">chevron_right</span>
                                    </button>

                                    <button
                                        onClick={() => handleWalletClick('binance')}
                                        className="w-full flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all active:scale-[0.98] cursor-pointer"
                                    >
                                        <img src={binanceLogo} className="w-8 h-8 rounded-lg" alt="Binance" />
                                        <span className="font-bold text-white flex-1 text-left text-sm">Binance Web3</span>
                                        <span className="material-icons-round text-gray-600 text-lg">chevron_right</span>
                                    </button>

                                    <button
                                        onClick={() => handleWalletClick('okx')}
                                        className="w-full flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all active:scale-[0.98] cursor-pointer"
                                    >
                                        <img src={okxLogo} className="w-8 h-8 rounded-lg" alt="OKX" />
                                        <span className="font-bold text-white flex-1 text-left text-sm">OKX Wallet</span>
                                        <span className="material-icons-round text-gray-600 text-lg">chevron_right</span>
                                    </button>
                                </div>

                                {/* Hide 'More Wallets' in TMA — AppKit/WC relay doesn't work in Telegram WebView */}
                                {!(window as any).Telegram?.WebApp && (
                                    <>
                                        <div className="relative flex items-center gap-3 my-4">
                                            <div className="flex-1 h-px bg-white/10"></div>
                                            <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">or</span>
                                            <div className="flex-1 h-px bg-white/10"></div>
                                        </div>

                                        <div className="mb-6">
                                            <button
                                                onClick={handleDirectConnect}
                                                className="w-full flex items-center justify-center gap-3 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all active:scale-[0.98] cursor-pointer"
                                            >
                                                <span className="material-icons-round text-xl text-gray-400">account_balance_wallet</span>
                                                <span className="font-bold text-gray-300 text-sm">More Wallets</span>
                                            </button>
                                            <p className="text-center text-[10px] text-gray-600 mt-3">Rainbow, Coinbase & 100+ wallets via WalletConnect</p>
                                        </div>
                                    </>
                                )}
                                {(window as any).Telegram?.WebApp && (
                                    <div className="mt-2 mb-4 px-2">
                                        <button
                                            onClick={() => {
                                                const url = window.location.origin;
                                                navigator.clipboard.writeText(url).then(() => {
                                                    alert('Link copied! Open your wallet app → paste this link in the dApp browser.');
                                                }).catch(() => {
                                                    prompt('Copy this link and open in your wallet\'s dApp browser:', url);
                                                });
                                            }}
                                            className="w-full flex items-center justify-center gap-3 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all active:scale-[0.98] cursor-pointer"
                                        >
                                            <span className="material-icons-round text-xl text-gray-400">content_copy</span>
                                            <div className="flex-1 text-left">
                                                <span className="font-bold text-gray-300 text-sm block">Other Wallets</span>
                                                <span className="text-[10px] text-gray-600">Copy link → open in your wallet's dApp browser</span>
                                            </div>
                                        </button>
                                    </div>
                                )}
                            </>
                        )}

                        <button
                            onClick={() => {
                                setIsConnectModalOpen(false);
                                setConnectingWallet(null);
                                setShowTpFallback(false);
                            }}
                            className="w-full text-gray-600 font-bold uppercase text-[10px] tracking-[4px] border-none bg-transparent cursor-pointer mt-4"
                        >
                            CANCEL
                        </button>
                    </div>
                </div>
            )}

            {_isDisconnectModalOpen && (
                <div className="fixed inset-0 z-[2000] flex items-end justify-center">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => _setIsDisconnectModalOpen(false)}></div>
                    <div className="relative w-full max-w-lg bg-[#0a0a0a] border-t border-white/10 rounded-t-[40px] p-8 pb-14 animate-slide-up shadow-2xl transition-all">
                        <div className="w-16 h-1.5 bg-white/10 rounded-full mx-auto mb-8 sticky top-0"></div>

                        <h3 className="text-xl font-black text-white uppercase tracking-widest text-center mb-6 font-display">Wallet Details</h3>

                        <div className="bg-white/5 rounded-3xl p-6 mb-8 border border-white/10">
                            <div className="flex flex-col items-center gap-2 mb-6">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Active Address</span>
                                <span className="text-sm font-mono text-primary break-all text-center px-4 font-bold uppercase">{finalAddress}</span>
                            </div>

                            <button
                                onClick={() => disconnect()}
                                className="w-full bg-red-600/20 hover:bg-red-600/30 text-red-500 p-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 cursor-pointer border border-red-500/20 font-black text-[12px] uppercase tracking-[3px]"
                            >
                                <span className="material-icons-round text-lg">logout</span>
                                DISCONNECT WALLET
                            </button>
                        </div>

                        <button
                            onClick={() => _setIsDisconnectModalOpen(false)}
                            className="w-full text-gray-600 font-bold uppercase text-[10px] tracking-[4px] border-none bg-transparent cursor-pointer"
                        >
                            CLOSE
                        </button>
                    </div>
                </div>
            )}
        </WalletContext.Provider>
    );
}

export function Web3Provider({ children }: { children: React.ReactNode }) {
    return <WalletProvider>{children}</WalletProvider>;
}

