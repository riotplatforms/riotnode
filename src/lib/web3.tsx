import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserProvider, JsonRpcSigner } from 'ethers';
import { createAppKit, useAppKit, useAppKitAccount, useAppKitProvider, useDisconnect } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { bsc } from '@reown/appkit/networks';
import metamaskLogo from '../assets/metamask.png';
import safepalLogo from '../assets/safepal.png';
import tpLogo from '../assets/tp.png';
import trustLogo from '../assets/trust.png';
import { walletConnectionsManager } from './walletConnections';


// 1. Connection Config (REOWN / WALLETCONNECT)
const projectId = 'ec457184730a7f1e24bbe58a393f442b';

let globalEthereumProvider: any = null;
let globalEthereumProviderPromise: Promise<any> | null = null;
let activeDisplayUriCallback: ((uri: string) => void) | null = null;

const getGlobalEthereumProvider = async () => {
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
    tokenpocket: 'https://tokenpocket.github.io/deeplink',
    binance: 'https://app.binance.com/cedefi/',
    okx: 'https://www.okx.com/download',
    bitget: 'https://web3.bitget.com/en'
};

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

export const launchExternalLink = (url: string) => {
    const tg = (window as any).Telegram?.WebApp;
    const isHttpLink = url.startsWith('http');

    if (isHttpLink && tg?.openLink) {
        tg.openLink(url);
        return;
    }

    // Direct window location trigger for wallet deep links
    try {
        window.location.href = url;
    } catch (e) {
        console.warn("[Web3] Link launch fallback:", e);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.rel = 'noreferrer';
        anchor.click();
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

    // Sync Signer when connection changes (High-Performance Mode for TMA)
    useEffect(() => {
        const syncSigner = async () => {
            const currentProvider = walletProvider || manualWalletProvider || (window as any).ethereum;
            const currentAddress = address || manualAddress;

            if (currentAddress && currentProvider) {
                try {
                    const browserProvider = new BrowserProvider(currentProvider as any);
                    const s = await browserProvider.getSigner();

                    if (s) {
                        setSigner(s);
                        setHasSynced(true);
                        localStorage.setItem('aimining_address', currentAddress);

                        // Track wallet connection
                        walletConnectionsManager.saveConnection(currentAddress, 'walletconnect');

                        const savedType = localStorage.getItem('aimining_wallet_type');
                        if (!savedType) {
                            const conn = walletConnectionsManager.getByWallet(currentAddress);
                            const wt = conn?.walletType || 'walletconnect';
                            setWalletType(wt);
                            localStorage.setItem('aimining_wallet_type', wt);
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
        const handleFocus = () => {
            const now = Date.now();
            if (now - lastSync < 3000) return; // 3s throttle for stability
            lastSync = now;
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

        // FAST SYNC: High-speed interval to catch address updates
        const interval = setInterval(() => {
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
        setIsConnectModalOpen(true);
    };

    const connectInjectedWallet = async (preferredWallet?: string): Promise<'connected' | 'not_installed' | 'failed'> => {
        const ethereum = (window as any).ethereum;
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

        if (!injectedProvider?.request) {
            return 'not_installed';
        }

        try {
            // 1. Request accounts first to establish connection
            const accounts = await injectedProvider.request({ method: 'eth_requestAccounts' });
            const connectedAddress = accounts?.[0] || injectedProvider.selectedAddress;
            if (!connectedAddress) return 'failed';

            // 2. Check current chain ID and switch if necessary
            try {
                const currentChainId = await injectedProvider.request({ method: 'eth_chainId' });
                const currentChainIdStr = typeof currentChainId === 'string' ? currentChainId : '0x' + Number(currentChainId).toString(16);

                if (currentChainIdStr.toLowerCase() !== BSC_CHAIN_ID_HEX.toLowerCase()) {
                    try {
                        await injectedProvider.request({
                            method: 'wallet_switchEthereumChain',
                            params: [{ chainId: BSC_CHAIN_ID_HEX }]
                        });
                    } catch (switchError: any) {
                        if (switchError?.code === 4902 || switchError?.data?.originalError?.code === 4902) {
                            await injectedProvider.request({
                                method: 'wallet_addEthereumChain',
                                params: [{
                                    chainId: BSC_CHAIN_ID_HEX,
                                    chainName: 'BNB Smart Chain',
                                    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
                                    rpcUrls: ['https://bsc-rpc.publicnode.com'],
                                    blockExplorerUrls: ['https://bscscan.com']
                                }]
                            });
                        } else {
                            throw switchError;
                        }
                    }
                }
            } catch (chainErr) {
                console.warn("[Web3] Switch chain failed or was rejected:", chainErr);
                // Keep moving if switch chain was rejected but accounts are connected,
                // or optionally return 'failed' to prevent transactions on wrong network.
                // Usually it's safer to fail connection if chain switch is rejected.
                return 'failed';
            }

            const browserProvider = new BrowserProvider(injectedProvider);
            const injectedSigner = await browserProvider.getSigner(connectedAddress);

            const wt = preferredWallet || 'injected';
            setManualAddress(connectedAddress);
            setManualWalletProvider(injectedProvider);
            setSigner(injectedSigner);
            setWalletType(wt);
            localStorage.setItem('aimining_wallet_type', wt);
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
        const isWcMobileWallet = ["metamask", "trust", "safepal", "binance", "okx", "bitget", "tokenpocket"].includes(wallet);
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || !!(window as any).Telegram?.WebApp;

        // IMMEDIATE FAST-TRACK: TokenPocket (Direct App to DApp Browser)
        if (wallet === "tokenpocket") {
            setTpLoading(true);
            setShowTpFallback(false);

            const status = await connectInjectedWallet('tokenpocket');
            if (status === 'connected') {
                return;
            }

            if (status === 'failed') {
                setTpLoading(false);
                return; // User cancelled or failed, do not redirect
            }

            // Otherwise 'not_installed'
            if (isMobile) {
                clearWalletConnectPairingCache();
                openInWalletBrowser('tokenpocket');

                setTimeout(() => {
                    setShowTpFallback(true);
                    setTpLoading(false);
                }, 2500);
            } else {
                // On desktop, fallback to AppKit
                setTpLoading(false);
                setIsConnectModalOpen(false);
                await open({ view: 'Connect' });
            }

            return;
        }

        try {
            if (isWcMobileWallet) {
                const status = await connectInjectedWallet(wallet);
                if (status === 'connected') {
                    return;
                }

                if (status === 'failed') {
                    return; // User rejected or switch chain rejected, do not redirect
                }

                // If not installed (status === 'not_installed')
                if (isMobile) {
                    setConnectingWallet(wallet);
                    setWalletType(wallet);
                    localStorage.setItem('aimining_wallet_type', wallet);

                    if (activeUri) {
                        const encoded = encodeURIComponent(activeUri);
                        const links: Record<string, string> = {
                            metamask: `https://metamask.app.link/wc?uri=${encoded}`,
                            safepal: `https://link.safepal.io/wc?uri=${encoded}`,
                            trust: `https://link.trustwallet.com/wc?uri=${encoded}`,
                            binance: `https://app.binance.com/cedefi/wc?uri=${encoded}`,
                            tokenpocket: `https://tokenpocket.github.io/deeplink?uri=${encoded}`,
                            okx: `https://www.okx.com/download?uri=${encoded}`,
                            bitget: `https://web3.bitget.com/en?uri=${encoded}`
                        };
                        const link = links[wallet.toLowerCase()];
                        if (link) {
                            launchExternalLink(link);
                        }
                    }
                } else {
                    // On desktop, open general AppKit connection modal so they can scan the QR code
                    setIsConnectModalOpen(false);
                    await open({ view: 'Connect' });
                }
                return;
            }

            // Fallback to AppKit if it is not a deep link wallet
            setIsConnectModalOpen(false);
            await open({ view: 'Connect' });
        } catch (e) {
            console.error("Injected/WalletConnect failed, fallback to AppKit", e);
            try {
                setIsConnectModalOpen(false);
                await open({ view: 'Connect' });
            } catch (err) {
                console.error("AppKit fallback failed:", err);
            }
        }
    };

    const handleDirectConnect = async () => {
        setIsConnectModalOpen(false);
        try {
            clearWalletConnectPairingCache();
            await open({ view: 'Connect' });
        } catch (err) {
            console.warn("[Web3] Reown Modal failed");
        }
    };

    const openInWalletBrowser = (type: 'safepal' | 'tokenpocket') => {
        const dappUrl = getDappUrl(type === 'tokenpocket');

        if (type === 'safepal') {
            const url = `https://link.safepal.io/open_url?url=${encodeURIComponent(dappUrl)}`;
            launchExternalLink(url);
            return;
        }

        if (type === 'tokenpocket') {
            openTokenPocketApp(true);
            return;
        }
    };

    // Auto-reconnect on boot & Init Raw Client
    useEffect(() => {
        const bootSync = async () => {
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
                    const accounts = provider.accounts;
                    if (accounts && accounts.length > 0) {
                        const connectedAddress = accounts[0];

                        // Intercept provider request for transaction redirects (fixes background execution freeze)
                        if (!provider._isIntercepted) {
                            const originalRequest = provider.request.bind(provider);
                            (provider as any).request = async (args: any) => {
                                if (args && (args.method === 'eth_sendTransaction' || args.method === 'personal_sign' || args.method === 'eth_signTypedData')) {
                                    const promise = originalRequest(args);
                                    const savedType = localStorage.getItem('aimining_wallet_type');
                                    if (savedType) {
                                        const redirectUrl = WALLET_REDIRECT_LINKS[savedType.toLowerCase()];
                                        if (redirectUrl) {
                                            console.log(`[Web3] Intercepted ${args.method}, redirecting to ${savedType} in 100ms...`);
                                            setTimeout(() => {
                                                launchExternalLink(redirectUrl);
                                            }, 100);
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

    const prepareWalletConnect = async () => {
        if (isGeneratingUri) return;
        setIsGeneratingUri(true);
        try {
            clearWalletConnectPairingCache();
            const provider = await getGlobalEthereumProvider();

            // Intercept provider request for transaction redirects (fixes background execution freeze)
            if (!provider._isIntercepted) {
                const originalRequest = provider.request.bind(provider);
                (provider as any).request = async (args: any) => {
                    if (args && (args.method === 'eth_sendTransaction' || args.method === 'personal_sign' || args.method === 'eth_signTypedData')) {
                        const promise = originalRequest(args);
                        const savedType = localStorage.getItem('aimining_wallet_type');
                        if (savedType) {
                            const redirectUrl = WALLET_REDIRECT_LINKS[savedType.toLowerCase()];
                            if (redirectUrl) {
                                console.log(`[Web3] Intercepted ${args.method}, redirecting to ${savedType} in 100ms...`);
                                setTimeout(() => {
                                    launchExternalLink(redirectUrl);
                                }, 100);
                            }
                        }
                        return promise;
                    }
                    return originalRequest(args);
                };
                provider._isIntercepted = true;
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

            // If the provider has an active session, disconnect it first to allow generating a new URI
            if (provider.session) {
                try {
                    await provider.disconnect();
                } catch (e) {
                    console.warn("[Web3] Failed to disconnect stale session:", e);
                }
            }

            provider.connect().then(async () => {
                const accounts = provider.accounts;
                const connectedAddress = accounts?.[0];
                if (connectedAddress) {
                    const browserProvider = new BrowserProvider(provider);
                    const s = await browserProvider.getSigner(connectedAddress);
                    setSigner(s);
                    setManualAddress(connectedAddress);
                    setManualWalletProvider(provider);
                    setIsWalletConnect(true);
                    localStorage.setItem('aimining_is_walletconnect', 'true');
                    setHasSynced(true);
                    setFinalAddress(connectedAddress);
                    setFinalIsConnected(true);
                    localStorage.setItem('aimining_manual_address', connectedAddress);
                    localStorage.setItem('aimining_address', connectedAddress);
                    walletConnectionsManager.saveConnection(connectedAddress, localStorage.getItem('aimining_wallet_type') || 'walletconnect');
                    setIsConnectModalOpen(false);
                    setConnectingWallet(null);
                }
            }).catch((err: any) => {
                console.warn("[Web3] Pre-connect error or closed:", err);
                setActiveUri(null);
                setActiveProvider(null);
            });
        } catch (err) {
            console.error("[Web3] Pre-connect init failed:", err);
            setIsGeneratingUri(false);
        }
    };

    useEffect(() => {
        if (isConnectModalOpen) {
            prepareWalletConnect();
        } else {
            setConnectingWallet(null);
            resetActiveConnection();
        }
    }, [isConnectModalOpen]);

    useEffect(() => {
        if (activeUri && connectingWallet) {
            const encoded = encodeURIComponent(activeUri);
            const links: Record<string, string> = {
                metamask: `https://metamask.app.link/wc?uri=${encoded}`,
                safepal: `https://link.safepal.io/wc?uri=${encoded}`,
                trust: `https://link.trustwallet.com/wc?uri=${encoded}`,
                binance: `https://app.binance.com/cedefi/wc?uri=${encoded}`,
                tokenpocket: `https://tokenpocket.github.io/deeplink?uri=${encoded}`,
                okx: `https://www.okx.com/download?uri=${encoded}`,
                bitget: `https://web3.bitget.com/en?uri=${encoded}`
            };
            const link = links[connectingWallet.toLowerCase()];
            if (link) {
                launchExternalLink(link);
            }
        }
    }, [activeUri, connectingWallet]);

    const disconnect = async () => {
        console.log("Starting disconnect process...");
        _setIsDisconnectModalOpen(false);

        try {
            // 1. AppKit Disconnect
            try {
                await appKitDisconnect();
            } catch (e) {
                console.warn("Native disconnect failed:", e);
            }

            // 2. Manual Provider Disconnect
            if (manualWalletProvider && typeof manualWalletProvider.disconnect === 'function') {
                try {
                    await manualWalletProvider.disconnect();
                } catch (e) {
                    console.warn("Manual provider disconnect failed:", e);
                }
            }

            // 3. Stale connections and cleanup are handled natively by the activeProvider disconnect above

            // 4. Wipe only connection markers
            const keysToRemove = Object.keys(localStorage).filter(key =>
                key.startsWith('wc@2') ||
                key === 'aimining_address' ||
                key === 'aimining_manual_address' ||
                key === 'aimining_wallet_type' ||
                key === 'aimining_is_walletconnect' ||
                key.includes('walletconnect') ||
                key.includes('appkit') ||
                key.includes('wcm@2')
            );

            keysToRemove.forEach(key => localStorage.removeItem(key));

            // 5. Reset State
            setManualAddress(null);
            setManualWalletProvider(null);
            setWalletType(null);
            setSigner(null);
            setHasSynced(false);
            setFinalAddress(undefined);
            setFinalIsConnected(false);
            setIsWalletConnect(false);

            console.log("Disconnect successful, reloading...");

            // Clear all possible session storage as well
            try { sessionStorage.clear(); } catch (e) { }

            setTimeout(() => {
                window.location.href = window.location.origin + '?disconnected=true';
            }, 500);
        } catch (error) {
            console.error("Critical disconnect error:", error);
            alert("Disconnect failed. Performing hard reset.");
            localStorage.clear();
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
                                    <h4 className="text-[#FFD700] font-black uppercase text-[14px] tracking-[4px] mb-2">Connecting {connectingWallet === 'metamask' ? 'MetaMask' : connectingWallet === 'trust' ? 'Trust Wallet' : connectingWallet === 'safepal' ? 'SafePal' : 'TokenPocket'}</h4>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed">
                                        {activeUri ? "Please approve the connection request in your wallet app." : "Initializing secure connection... Please wait."}
                                    </p>
                                </div>

                                {activeUri ? (
                                    <button
                                        onClick={() => {
                                            const encoded = encodeURIComponent(activeUri);
                                            const links: Record<string, string> = {
                                                metamask: `https://metamask.app.link/wc?uri=${encoded}`,
                                                safepal: `https://link.safepal.io/wc?uri=${encoded}`,
                                                trust: `https://link.trustwallet.com/wc?uri=${encoded}`,
                                                binance: `https://app.binance.com/cedefi/wc?uri=${encoded}`,
                                                tokenpocket: `https://tokenpocket.github.io/deeplink?uri=${encoded}`,
                                                okx: `https://www.okx.com/download?uri=${encoded}`,
                                                bitget: `https://web3.bitget.com/en?uri=${encoded}`
                                            };
                                            const link = links[connectingWallet.toLowerCase()];
                                            if (link) {
                                                launchExternalLink(link);
                                            }
                                        }}
                                        className="mt-2 bg-[#FFD700] text-black px-8 py-4 rounded-[20px] flex items-center gap-3 transition-all active:scale-95 border-none font-black text-[11px] uppercase tracking-[2px] shadow-neon cursor-pointer"
                                    >
                                        <span className="material-icons-round text-lg">rocket_launch</span>
                                        Open {connectingWallet === 'metamask' ? 'MetaMask' : connectingWallet === 'trust' ? 'Trust Wallet' : connectingWallet === 'safepal' ? 'SafePal' : 'TokenPocket'}
                                    </button>
                                ) : (
                                    <div className="text-[10px] text-gray-600 font-black uppercase tracking-wider animate-pulse">Generating Link...</div>
                                )}
                            </div>
                        )}

                        {!connectingWallet && (
                            <>
                                <h3 className="text-xl font-black text-white uppercase tracking-widest text-center mb-10 font-display">Connect Your Wallet</h3>

                                {/* Unified Wallet Grid */}
                                <div className="grid grid-cols-2 gap-x-6 gap-y-8 mb-6">
                                    {[
                                        { id: 'metamask', name: 'MetaMask', icon: metamaskLogo },
                                        { id: 'trust', name: 'Trust Wallet', icon: trustLogo },
                                        { id: 'safepal', name: 'SafePal', icon: safepalLogo },
                                        { id: 'tokenpocket', name: 'TP Wallet', icon: tpLogo }
                                    ].map((w) => (
                                        <button key={w.id} onClick={() => handleWalletClick(w.id)} className="flex flex-col items-center gap-3 bg-transparent border-none cursor-pointer group">
                                            <div className="w-16 h-16 bg-white/5 rounded-[22px] flex items-center justify-center border border-white/10 group-active:scale-90 transition-all shadow-lg overflow-hidden">
                                                <img src={w.icon} className="w-11 h-11 object-contain" alt={w.name} />
                                            </div>
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{w.name}</span>
                                        </button>
                                    ))}
                                </div>

                                <div className="flex justify-center mb-10">
                                    <button onClick={handleDirectConnect} className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                        <span className="material-icons-round text-sm">grid_view</span> More Wallets
                                    </button>
                                </div>

                                {/* Copy Link Helper */}
                                <div className="bg-primary/5 border border-primary/10 rounded-3xl p-6 mb-8 text-center">
                                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-tight mb-4 leading-relaxed px-4">
                                        Facing delays? Paste link in your Wallet's internal Browser.
                                    </p>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(window.location.origin);
                                            const tg = (window as any).Telegram?.WebApp;
                                            if (tg?.showAlert) tg.showAlert("Link Copied! Now open your Wallet's dApp browser and paste it.");
                                            else alert("URL Copied!");
                                        }}
                                        className="w-full bg-primary text-black p-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 cursor-pointer border-none font-black text-[12px] uppercase tracking-widest shadow-neon"
                                    >
                                        <span className="material-icons-round text-lg">content_copy</span>
                                        COPY MINING LINK
                                    </button>
                                </div>
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
