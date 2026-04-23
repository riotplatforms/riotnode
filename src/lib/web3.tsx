import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserProvider, JsonRpcSigner } from 'ethers';
import { createAppKit, useAppKit, useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { bsc, mainnet } from '@reown/appkit/networks';

// 1. Connection Config (REOWN / WALLETCONNECT)
const projectId = 'ec457184730a7f1e24bbe58a393f442b';

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
        networks: [mainnet, bsc], // BSC primary, but mainnet added for wallet compatibility
        defaultNetwork: bsc,
        metadata,
        projectId,
        features: {
            analytics: true,
            email: false,
            socials: false,
            allWallets: true // Support 600+ wallets
        },
        themeMode: 'dark',
        themeVariables: {
            '--w3m-accent': '#FFD700',
            '--w3m-border-radius-master': '1px'
        },
        featuredWalletIds: [
            'c53b2160100a74836696b4ef61012a67', // MetaMask
            '4622a2b2d6ad1297d0d0ed7963d330c6', // Trust Wallet
            '971e689d0a5955a868f3b13fdb2742e4', // Binance Wallet
            '225affb17671854898148b0d46d2f3d2', // SafePal
            'd681b9790ca427f9103c8091da93f0b4'  // TokenPocket
        ]
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
    const [referral, setReferral] = useState<string | null>(null);
    const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

    const isConnecting = status === 'connecting';

    // Sync Signer when connection changes (Optimized to prevent redundant popups)
    useEffect(() => {
        const syncSigner = async (isManual = false) => {
            if (isConnected && walletProvider && (!hasSynced || isManual)) {
                try {
                    const browserProvider = new BrowserProvider(walletProvider as any);
                    
                    // PERFORMANCE: Use eth_accounts for resume, eth_requestAccounts for initial
                    const method = isManual ? "eth_accounts" : "eth_requestAccounts";
                    const accounts = await browserProvider.send(method, []);
                    
                    if (accounts.length > 0) {
                        const s = await browserProvider.getSigner(accounts[0]);
                        setSigner(s);
                        setHasSynced(true);
                        if (address) localStorage.setItem('aimining_address', address);
                    }
                } catch (e) {
                    console.error("[Web3] Signer sync failed:", e);
                }
            } else if (!isConnected) {
                setSigner(null);
                setHasSynced(false);
                localStorage.removeItem('aimining_address');
            }
        };
        
        // Slightly delayed sync to avoid hangs during TMA transition
        const timeout = setTimeout(() => syncSigner(), 800);

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

        return () => {
            window.removeEventListener("focus", handleFocus);
        };
    }, [isConnected, walletProvider, address, hasSynced]);

    const connect = async () => {
        setIsConnectModalOpen(true);
    };

    const openReownModal = async () => {
        setIsConnectModalOpen(false);
        try {
            await open({ view: 'Connect' });
        } catch (err) {
            console.error("[Web3] Connect failed:", err);
        }
    };

    const openInWalletBrowser = (type: 'safepal' | 'tokenpocket') => {
        const tg = (window as any).Telegram?.WebApp;
        const dappUrl = window.location.origin;
        let url = "";

        if (type === 'safepal') {
            url = `https://link.safepal.io/open_url?url=${encodeURIComponent(dappUrl)}`;
        } else if (type === 'tokenpocket') {
            url = `https://tokenpocket.github.io/applink?dappUrl=${encodeURIComponent(dappUrl)}`;
        }

        if (tg) {
            tg.openLink(url);
        } else {
            window.location.href = url;
        }
    };

    // Auto-reconnect on boot
    useEffect(() => {
        const saved = localStorage.getItem('aimining_address');
        if (saved && !isConnected) {
            connect();
        }
    }, []);

    const disconnect = async () => {
        localStorage.clear();
        window.location.reload();
    };

    const forceSync = async () => {
        // Handled by AppKit
    };

    const hardReset = () => {
        localStorage.clear();
        window.location.reload();
    };

    const setIsDisconnectModalOpen = (isOpen: boolean) => {
        if (isOpen) {
            open({ view: 'Account' });
        }
    };

    const stakeNow = async (_amount: string) => {
        if (!isConnected || !address) {
            await connect();
            return;
        }
        // This will be implemented using useStaking in components, 
        // but can be routed here for generalized 'One Click' logic if needed.
    };

    return (
        <WalletContext.Provider value={{
            address,
            isConnected,
            signer,
            connect,
            disconnect,
            isConnecting: isConnecting && !address, // Refined spinner state
            walletType: 'AppKit',
            walletProvider,
            referral,
            forceSync,
            hardReset,
            setIsDisconnectModalOpen,
            setIsConnectModalOpen,
            stakeNow,
            openInWalletBrowser: openInWalletBrowser as any
        }}>
            {children}

            {/* CUSTOM CONNECT MODAL (TMA STYLE) */}
            {isConnectModalOpen && (
                <div className="fixed inset-0 z-[2000] flex items-end justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsConnectModalOpen(false)}></div>
                    <div className="relative w-full max-w-md bg-[#0f0f0f] border-t border-white/10 rounded-t-[32px] p-6 pb-12 animate-slide-up shadow-2xl transition-all">
                        <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6"></div>
                        
                        <h3 className="text-lg font-black text-white uppercase tracking-widest text-center mb-6">Select Connection</h3>
                        
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <button 
                                onClick={openReownModal}
                                className="bg-primary/10 border border-primary/20 p-4 rounded-3xl flex flex-col items-center gap-2 group hover:bg-primary/20 transition-all cursor-pointer"
                            >
                                <span className="material-icons-round text-primary text-3xl">account_balance_wallet</span>
                                <span className="text-[10px] font-black text-white uppercase">Standard</span>
                            </button>
                            <button 
                                onClick={() => { setIsConnectModalOpen(false); openInWalletBrowser('safepal'); }}
                                className="bg-white/5 border border-white/10 p-4 rounded-3xl flex flex-col items-center gap-2 group hover:bg-white/10 transition-all cursor-pointer"
                            >
                                <span className="material-icons-round text-gray-400 text-3xl">shield</span>
                                <span className="text-[10px] font-black text-white uppercase">SafePal Browser</span>
                            </button>
                        </div>

                        <button 
                            onClick={() => { setIsConnectModalOpen(false); openInWalletBrowser('tokenpocket'); }}
                            className="w-full bg-white/5 border border-white/10 p-4 rounded-3xl flex items-center justify-center gap-3 group hover:bg-white/10 transition-all mb-6 cursor-pointer"
                        >
                             <span className="material-icons-round text-gray-400 text-2xl">bolt</span>
                             <span className="text-[10px] font-black text-white uppercase">Open in TokenPocket Wallet</span>
                        </button>

                        <button 
                            onClick={() => setIsConnectModalOpen(false)}
                            className="w-full text-gray-500 font-bold uppercase text-[10px] tracking-widest border-none bg-transparent cursor-pointer"
                        >
                            Cancel
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
