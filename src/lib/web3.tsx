import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserProvider, JsonRpcSigner } from 'ethers';
import { createAppKit, useAppKit, useAppKitAccount, useAppKitProvider, useDisconnect } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { bsc } from '@reown/appkit/networks';
import metamaskLogo from '../assets/metamask.png';
import safepalLogo from '../assets/safepal.png';
import tpLogo from '../assets/tp.png';
import { createSession, initWC } from './walletconnect';


// 1. Connection Config (REOWN / WALLETCONNECT)
const projectId = 'ec457184730a7f1e24bbe58a393f442b';
let currentSessionPromise: any = null;

const metadata = {
    name: 'AI MINING BTC',
    description: 'AI-powered Staking Platform',
    url: window.location.origin,
    icons: [`${window.location.origin}/logo.png`]
};

const BSC_CHAIN_ID_HEX = '0x38';

const getDappUrl = (autoConnectTokenPocket = false) => {
    const url = new URL(window.location.href);
    if (autoConnectTokenPocket) {
        url.searchParams.set('tpconnect', '1');
    }
    return url.toString();
};

const getTokenPocketDappLink = (autoConnect = true) => {
    const params = {
        url: getDappUrl(autoConnect),
        chain: 'BSC',
        source: 'AI MINING BTC'
    };
    return `tpdapp://open?params=${encodeURIComponent(JSON.stringify(params))}`;
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
    currentSessionPromise = null;
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
    const [referral, setReferral] = useState<string | null>(null);
    const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
    const [_isDisconnectModalOpen, _setIsDisconnectModalOpen] = useState(false);
    const [tpLoading, setTpLoading] = useState(false);
    const [showTpFallback, setShowTpFallback] = useState(false);
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
                    const s = await browserProvider.getSigner(currentAddress);

                    if (s) {
                        setSigner(s);
                        setHasSynced(true);
                        localStorage.setItem('aimining_address', currentAddress);

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
        const ref = urlParams.get('ref');
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
                if (!prev.isLoaded || prev.rewardPerSecond <= 0) return prev;
                return {
                    ...prev,
                    balance: (parseFloat(prev.balance) + prev.rewardPerSecond).toFixed(14)
                };
            });
        }, 1000);

        return () => {
            clearTimeout(timeout);
            clearInterval(interval);
            clearInterval(ticker);
            window.removeEventListener("focus", handleFocus);
        };
    }, [isConnected, walletProvider, address, hasSynced]);

    const connect = async () => {
        setIsConnectModalOpen(true);
    };

    const connectInjectedWallet = async (preferredWallet?: string) => {
        const ethereum = (window as any).ethereum;
        const injectedProvider =
            preferredWallet === 'tokenpocket'
                ? ((window as any).tokenpocket?.ethereum || ethereum)
                : preferredWallet === 'metamask'
                    ? (ethereum?.isMetaMask ? ethereum : null)
                    : ((window as any).tokenpocket?.ethereum || ethereum);

        if (!injectedProvider?.request) {
            return false;
        }

        try {
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
                            rpcUrls: ['https://bsc-dataseed.binance.org/'],
                            blockExplorerUrls: ['https://bscscan.com']
                        }]
                    });
                }
            }

            const accounts = await injectedProvider.request({ method: 'eth_requestAccounts' });
            const connectedAddress = accounts?.[0] || injectedProvider.selectedAddress;
            if (!connectedAddress) return false;

            const browserProvider = new BrowserProvider(injectedProvider);
            const injectedSigner = await browserProvider.getSigner(connectedAddress);

            setManualAddress(connectedAddress);
            setManualWalletProvider(injectedProvider);
            setSigner(injectedSigner);
            setHasSynced(true);
            setFinalAddress(connectedAddress);
            setFinalIsConnected(true);
            localStorage.setItem('aimining_manual_address', connectedAddress);
            localStorage.setItem('aimining_address', connectedAddress);
            setIsConnectModalOpen(false);
            setTpLoading(false);
            setShowTpFallback(false);
            return true;
        } catch (err) {
            console.warn("[Web3] Injected wallet connect failed:", err);
            return false;
        }
    };

    const handleWalletClick = async (wallet: string) => {
        // OPTIMIZATION: Delay closing the modal for 2 seconds to ensure deep links trigger and user sees the interaction
        const isDeepLink = ["metamask", "safepal", "tokenpocket", "trust", "binance", "okx", "bitget"].includes(wallet);
        if (!isDeepLink) {
            setIsConnectModalOpen(false);
        } else {
            // Keep modal open for 2s as requested by user
            setTimeout(() => setIsConnectModalOpen(false), 2000);
        }

        // IMMEDIATE FAST-TRACK: TokenPocket (Direct App to DApp Browser)
        if (wallet === "tokenpocket") {
            setTpLoading(true);
            setShowTpFallback(false);

            if (await connectInjectedWallet('tokenpocket')) {
                return;
            }

            clearWalletConnectPairingCache();
            openInWalletBrowser('tokenpocket');
            setTimeout(() => {
                setShowTpFallback(true);
                setTpLoading(false);
            }, 1500);

            return;
        }

        try {
            if (wallet === "metamask" && await connectInjectedWallet('metamask')) {
                return;
            }

            await initWC();

            let session;
            if (wallet === "metamask") {
                // MetaMask -> always fresh session to avoid loading hangs
                session = await createSession();
            } else {
                // Caching for other wallets
                if (!currentSessionPromise) {
                    currentSessionPromise = createSession();
                }
                session = await currentSessionPromise;
            }

            const { uri, approval } = session;
            const encoded = encodeURIComponent(uri);

            const links: any = {
                metamask: `https://metamask.app.link/wc?uri=${encoded}`,
                safepal: `https://link.safepal.io/wc?uri=${encoded}`,
                trust: `https://link.trustwallet.com/wc?uri=${encoded}`,
                binance: `https://app.binance.com/cedefi/wc?uri=${encoded}`,
                okx: `https://www.okx.com/download`,
                bitget: `https://web3.bitget.com/en`
            };

            const tg = (window as any).Telegram?.WebApp;
            const link = links[wallet];

            if (tg && link) {
                if (wallet === "metamask") {
                    tg.openLink(link); // Immediate trigger for MetaMask
                } else {
                    setTimeout(() => tg.openLink(link), 300);
                }
            } else if (link) {
                window.location.href = link;
            }

            // NON-BLOCKING APPROVAL HANDLING
            approval().then(async (session: any) => {

                if (session) {
                    const accs = session.namespaces.eip155.accounts;
                    if (accs && accs.length > 0) {
                        const addr = accs[0].split(":")[2];

                        // Bridge state to triggers UI update
                        setManualAddress(addr);
                        localStorage.setItem('aimining_manual_address', addr);

                        try {
                            const { EthereumProvider } = await import('@walletconnect/ethereum-provider');
                            const provider = await EthereumProvider.init({
                                projectId,
                                showQrModal: false,
                                chains: [56],
                                methods: ["eth_sendTransaction", "personal_sign"],
                                events: ["accountsChanged", "chainChanged"],
                                rpcMap: { 56: 'https://bsc-dataseed.binance.org/' }
                            });
                            await provider.connect();
                            setManualWalletProvider(provider);
                        } catch (err) {
                            console.warn("Manual provider sync skipped in handleWalletClick:", err);
                        }

                        if (wallet === "metamask") {
                            currentSessionPromise = null;
                        }
                        setIsConnectModalOpen(false);
                    }
                }
            }).catch((err: any) => {
                console.error("Session approval error:", err);
                currentSessionPromise = null;
            });

        } catch (e) {
            console.error("RAW WC failed, fallback to AppKit", e);
            currentSessionPromise = null;
            await open({ view: 'Connect' });
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
        const tg = (window as any).Telegram?.WebApp;
        const dappUrl = getDappUrl(type === 'tokenpocket');
        let url = "";

        if (type === 'safepal') {
            url = `https://link.safepal.io/open_url?url=${encodeURIComponent(dappUrl)}`;
        } else if (type === 'tokenpocket') {
            url = getTokenPocketDappLink(true);
        }

        if (tg) {
            tg.openLink(url);
        } else {
            window.location.href = url;
        }
    };

    // Auto-reconnect on boot & Init Raw Client
    useEffect(() => {
        const bootSync = async () => {
            const params = new URLSearchParams(window.location.search);
            if (params.get('tpconnect') === '1') {
                const connected = await connectInjectedWallet();
                if (connected) {
                    params.delete('tpconnect');
                    const cleanUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash}`;
                    window.history.replaceState({}, '', cleanUrl);
                    return;
                }
            }

            const wc = await initWC();
            const sessions = wc.session.getAll();

            if (sessions.length > 0) {
                const session = sessions[0];
                const accs = session.namespaces.eip155.accounts;
                if (accs && accs.length > 0) {
                    const addr = accs[0].split(":")[2];
                    setManualAddress(addr);

                    try {
                        const { EthereumProvider } = await import('@walletconnect/ethereum-provider');
                        const provider = await EthereumProvider.init({
                            projectId,
                            showQrModal: false,
                            chains: [56],
                            methods: ["eth_sendTransaction", "personal_sign"],
                            events: ["accountsChanged", "chainChanged"],
                            rpcMap: { 56: 'https://bsc-dataseed.binance.org/' }
                        });
                        await provider.connect();
                        setManualWalletProvider(provider);
                    } catch (err) {
                        console.warn("[Web3] Session Restore failed:", err);
                    }
                }
            } else {
                // Secondary check for injected providers on boot
                const saved = localStorage.getItem('aimining_manual_address') || localStorage.getItem('aimining_address');
                if (saved) setManualAddress(saved);
            }
        };

        bootSync();
    }, []);

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

            // 3. Raw WalletConnect (SignClient) Disconnect
            try {
                const wc = await initWC();
                const sessions = wc.session.getAll();
                for (const session of sessions) {
                    try {
                        await wc.disconnect({
                            topic: session.topic,
                            reason: { code: 6000, message: "User disconnected" }
                        });
                    } catch (err) {
                        console.warn("Session disconnect failed:", err);
                    }
                }
            } catch (e) {
                console.warn("WC disconnect failed:", e);
            }

            // 4. Wipe only connection markers
            const keysToRemove = Object.keys(localStorage).filter(key =>
                key.startsWith('wc@2') ||
                key === 'aimining_address' ||
                key === 'aimining_manual_address' ||
                key.includes('walletconnect') ||
                key.includes('appkit') ||
                key.includes('wcm@2')
            );

            keysToRemove.forEach(key => localStorage.removeItem(key));

            // 5. Reset State
            setManualAddress(null);
            setManualWalletProvider(null);
            setSigner(null);
            setHasSynced(false);
            setFinalAddress(undefined);
            setFinalIsConnected(false);

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
            walletType: 'Hybrid',
            walletProvider: walletProvider || manualWalletProvider,
            referral,
            forceSync,
            hardReset,
            setIsDisconnectModalOpen,
            setIsConnectModalOpen: (open: boolean) => {
                if (!open) {
                    setTpLoading(false);
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
                        setTpLoading(false);
                        setShowTpFallback(false);
                    }}></div>
                    <div className="relative w-full max-w-lg bg-[#0a0a0a] border-t border-white/10 rounded-t-[40px] p-8 pb-14 animate-slide-up shadow-2xl transition-all max-h-[90vh] overflow-y-auto no-scrollbar">
                        <div className="w-16 h-1.5 bg-white/10 rounded-full mx-auto mb-8 sticky top-0"></div>

                        {tpLoading && (
                            <div className="mb-10 flex flex-col items-center gap-6 animate-fade-in py-4 bg-primary/5 rounded-[32px] border border-primary/10 mx-2">
                                <div className="relative">
                                    <div className="w-16 h-16 border-4 border-primary/20 rounded-full"></div>
                                    <div className="absolute inset-0 w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <img src={tpLogo} className="w-8 h-8 rounded-lg animate-pulse" alt="TP" />
                                    </div>
                                </div>
                                <div className="text-center">
                                    <h4 className="text-primary font-black uppercase text-[14px] tracking-[4px] mb-2">Opening TokenPocket</h4>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Please Wait while we redirect you...</p>
                                </div>

                                {showTpFallback && (
                                    <button
                                        onClick={async () => {
                                            clearWalletConnectPairingCache();
                                            setIsConnectModalOpen(false);
                                            await open({ view: 'AllWallets' });
                                        }}
                                        className="mt-2 bg-primary text-black px-8 py-4 rounded-[20px] flex items-center gap-3 transition-all active:scale-95 border-none font-black text-[11px] uppercase tracking-[2px] shadow-neon"
                                    >
                                        <span className="material-icons-round text-lg">rocket_launch</span>
                                        Open WalletConnect
                                    </button>
                                )}
                            </div>
                        )}

                        <h3 className="text-xl font-black text-white uppercase tracking-widest text-center mb-10 font-display">Connect Your Wallet</h3>

                        {/* Unified Wallet Grid */}
                        <div className="grid grid-cols-2 gap-x-6 gap-y-8 mb-12">
                            {[
                                { id: 'metamask', name: 'MetaMask', icon: metamaskLogo },
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

                            <button onClick={handleDirectConnect} className="flex flex-col items-center gap-3 bg-transparent border-none cursor-pointer group">
                                <div className="w-16 h-16 bg-white/5 rounded-[22px] flex items-center justify-center border border-white/10 group-active:scale-90 transition-all shadow-lg">
                                    <span className="material-icons-round text-3xl text-gray-500">grid_view</span>
                                </div>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">More</span>
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

                        <button
                            onClick={() => {
                                setIsConnectModalOpen(false);
                                setTpLoading(false);
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
