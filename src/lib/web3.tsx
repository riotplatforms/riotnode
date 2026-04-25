import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserProvider, JsonRpcSigner } from 'ethers';
import { createAppKit, useAppKit, useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
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

// Initialize AppKit with Instance Guard
let appKitInitialized = false;

if (!appKitInitialized) {
    createAppKit({
        adapters: [new EthersAdapter()],
        networks: [bsc],
        defaultNetwork: bsc,
        metadata,
        projectId,
        features: {
            analytics: true,
            email: false,
            socials: false,
            allWallets: false // Support 600+ wallets
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
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
    const context = useContext(WalletContext);
    if (!context) throw new Error('useWallet must be used within a WalletProvider');
    return context;
};

export function WalletProvider({ children }: { children: React.ReactNode }) {
    const { open } = useAppKit();
    const { address, isConnected, status } = useAppKitAccount();
    const { walletProvider } = useAppKitProvider('eip155');
    const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
    const [hasSynced, setHasSynced] = useState(false);
    const [manualAddress, setManualAddress] = useState<string | null>(localStorage.getItem('aimining_manual_address'));
    const [manualWalletProvider, setManualWalletProvider] = useState<any>(null);
    const [referral, setReferral] = useState<string | null>(null);
    const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
    const [_isDisconnectModalOpen, _setIsDisconnectModalOpen] = useState(false);

    const isConnecting = (status === 'connecting' || status === 'reconnecting') && !address && !manualAddress;
    const finalAddress = address || manualAddress;
    const finalIsConnected = isConnected || !!manualAddress;

    // Sync Signer when connection changes (High-Performance Mode for TMA)
    useEffect(() => {
        const syncSigner = async (isManual = false) => {
            const currentProvider = walletProvider || manualWalletProvider;
            const currentAddress = address || manualAddress;

            if (finalIsConnected && currentProvider && currentAddress && (!hasSynced || isManual)) {
                try {
                    const browserProvider = new BrowserProvider(currentProvider as any);
                    const s = await browserProvider.getSigner(currentAddress);

                    if (s) {
                        setSigner(s);
                        setHasSynced(true);
                        localStorage.setItem('aimining_address', currentAddress as string);
                    }
                } catch (e) {
                    console.error("[Web3] High-speed signer sync failed:", e);
                }
            } else if (!finalIsConnected) {
                setSigner(null);
                setHasSynced(false);
                localStorage.removeItem('aimining_address');
            }
        };

        // Slightly delayed sync to avoid hangs during TMA transition
        const timeout = setTimeout(() => syncSigner(), 1200);

        // FIX: Manual Re-sync on App Resume (Fixes Telegram background freeze)
        let lastSync = 0;
        const handleFocus = () => {
            const now = Date.now();
            if (now - lastSync < 3000) return; // 3s throttle for stability
            lastSync = now;
            syncSigner(true);
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
            }
        }, 1000);

        return () => {
            clearTimeout(timeout);
            clearInterval(interval);
            window.removeEventListener("focus", handleFocus);
        };
    }, [isConnected, walletProvider, address, hasSynced]);

    const connect = async () => {
        setIsConnectModalOpen(true);
    };

    const handleWalletClick = async (wallet: string) => {
        setIsConnectModalOpen(false);

        // IMMEDIATE FAST-TRACK: TokenPocket (Bypass all WC overhead)
        if (wallet === "tokenpocket") {
            const tg = (window as any).Telegram?.WebApp;
            const tpBrowserLink = `tpdive://openid?url=${encodeURIComponent(window.location.origin)}`;
            if (tg) {
                tg.openLink(tpBrowserLink);
            } else {
                window.location.href = tpBrowserLink;
            }
            return;
        }

        try {
            await initWC();

            // Session Caching to prevent pairing conflicts
            if (!currentSessionPromise) {
                currentSessionPromise = createSession();
            }

            const { uri, approval } = await currentSessionPromise;
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
                // MetaMask optimization: Immediate trigger
                if (wallet === 'metamask') {
                    tg.openLink(link);
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

                        currentSessionPromise = null;
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
            await open({ view: 'Connect' });
        } catch (err) {
            console.warn("[Web3] Reown Modal failed");
        }
    };

    const openInWalletBrowser = (type: 'safepal' | 'tokenpocket') => {
        const tg = (window as any).Telegram?.WebApp;
        const dappUrl = window.location.origin;
        let url = "";

        if (type === 'safepal') {
            url = `https://link.safepal.io/open_url?url=${encodeURIComponent(dappUrl)}`;
        } else if (type === 'tokenpocket') {
            url = `https://www.tokenpocket.pro/en/dapp/${window.location.host}`;
        }

        if (tg) {
            tg.openLink(url);
        } else {
            window.location.href = url;
        }
    };

    // Auto-reconnect on boot & Init Raw Client
    useEffect(() => {
        initWC();
        const saved = localStorage.getItem('aimining_address');
        if (saved && !isConnected) {
            connect();
        }
    }, []);

    const disconnect = async () => {
        localStorage.removeItem('aimining_address');
        localStorage.removeItem('aimining_manual_address');
        localStorage.removeItem('aimining_referrer');
        setManualAddress(null);
        setManualWalletProvider(null);
        setSigner(null);
        setHasSynced(false);
        window.location.reload();
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
            setIsConnectModalOpen,
            stakeNow,
            openInWalletBrowser: openInWalletBrowser as any
        }}>
            {children}
            {isConnectModalOpen && (
                <div className="fixed inset-0 z-[2000] flex items-end justify-center">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsConnectModalOpen(false)}></div>
                    <div className="relative w-full max-w-lg bg-[#0a0a0a] border-t border-white/10 rounded-t-[40px] p-8 pb-14 animate-slide-up shadow-2xl transition-all max-h-[90vh] overflow-y-auto no-scrollbar">
                        <div className="w-16 h-1.5 bg-white/10 rounded-full mx-auto mb-8 sticky top-0"></div>

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
                            onClick={() => setIsConnectModalOpen(false)}
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
