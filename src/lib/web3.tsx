import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserProvider, JsonRpcSigner } from 'ethers';
import { createAppKit, useAppKit, useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { bsc, mainnet } from '@reown/appkit/networks';
import metamaskLogo from '../assets/metamask.png';
import trustLogo from '../assets/trust.png';
import binanceLogo from '../assets/binance.png';
import safepalLogo from '../assets/safepal.png';
import tpLogo from '../assets/tp.png';
import { createSession, initWC } from './walletconnect';

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

    // Sync Signer when connection changes (High-Performance Mode for TMA)
    useEffect(() => {
        const syncSigner = async (isManual = false) => {
            if (isConnected && walletProvider && address && (!hasSynced || isManual)) {
                try {
                    const browserProvider = new BrowserProvider(walletProvider as any);
                    
                    // PERFORMANCE: Directly get signer using the address we already have from AppKit
                    // This avoids the 'eth_requestAccounts' hang in Telegram Mini Apps
                    const s = await browserProvider.getSigner(address);
                    
                    if (s) {
                        setSigner(s);
                        setHasSynced(true);
                        localStorage.setItem('aimining_address', address);
                    }
                } catch (e) {
                    console.error("[Web3] High-speed signer sync failed:", e);
                }
            } else if (!isConnected) {
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

        return () => {
            clearTimeout(timeout);
            window.removeEventListener("focus", handleFocus);
        };
    }, [isConnected, walletProvider, address, hasSynced]);

    const connect = async () => {
        setIsConnectModalOpen(true);
    };

    const handleWalletClick = async (wallet: string) => {
        try {
            await initWC();
            const { uri, approval } = await createSession();

            const encoded = encodeURIComponent(uri);
            const links: any = {
                trust: `https://link.trustwallet.com/wc?uri=${encoded}`,
                metamask: `https://metamask.app.link/wc?uri=${encoded}`,
                binance: `https://app.binance.com/cedefi/wc?uri=${encoded}`,
                safepal: `https://link.safepal.io/wc?uri=${encoded}`,
                tokenpocket: `tpoutside://pull.activity?param=${encoded}`,
                okx: `https://www.okx.com/download`,
                bitget: `https://web3.bitget.com/en`
            };

            const tg = (window as any).Telegram?.WebApp;
            if (tg && links[wallet]) {
                tg.openLink(links[wallet]);
            } else if (links[wallet]) {
                window.location.href = links[wallet];
            }

            // WalletConnect Modal Fallback if needed or just wait for approval
            setIsConnectModalOpen(false);
            
            // This will trigger the appkit session if the wallet supports universal links well
            // Or we can manually handle the session here
            const session = await approval();
            if (session) {
                const accs = session.namespaces.eip155.accounts;
                if (accs && accs.length > 0) {
                    const addr = accs[0].split(":")[2];
                    localStorage.setItem('aimining_address', addr);
                    // Force reload to let AppKit pick up the existing session from storage
                    window.location.reload();
                }
            }

        } catch (e) {
            console.error("Connection failed", e);
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
            {isConnectModalOpen && (
                <div className="fixed inset-0 z-[2000] flex items-end justify-center">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsConnectModalOpen(false)}></div>
                    <div className="relative w-full max-w-lg bg-[#0a0a0a] border-t border-white/10 rounded-t-[40px] p-8 pb-14 animate-slide-up shadow-2xl transition-all">
                        <div className="w-16 h-1.5 bg-white/10 rounded-full mx-auto mb-8"></div>
                        
                        <h3 className="text-xl font-black text-white uppercase tracking-widest text-center mb-10 font-display">Connect Your Miner</h3>
                        
                        {/* Direct Wallet Icons (Optimized for TMA with Raw Deep Links) */}
                        <div className="grid grid-cols-2 gap-x-6 gap-y-8 mb-12">
                            <button onClick={() => handleWalletClick("metamask")} className="flex flex-col items-center gap-3 bg-transparent border-none cursor-pointer group">
                                <div className="w-16 h-16 bg-white/5 rounded-[22px] flex items-center justify-center border border-white/10 group-active:scale-90 transition-all shadow-lg">
                                    <img src={metamaskLogo} className="w-10 h-10 object-contain" alt="MetaMask" />
                                </div>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">MetaMask</span>
                            </button>
                            <button onClick={() => handleWalletClick("trust")} className="flex flex-col items-center gap-3 bg-transparent border-none cursor-pointer group">
                                <div className="w-16 h-16 bg-white/5 rounded-[22px] flex items-center justify-center border border-white/10 group-active:scale-90 transition-all shadow-lg">
                                    <img src={trustLogo} className="w-10 h-10 object-contain" alt="Trust" />
                                </div>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Trust Wallet</span>
                            </button>
                            <button onClick={() => handleWalletClick("binance")} className="flex flex-col items-center gap-3 bg-transparent border-none cursor-pointer group">
                                <div className="w-16 h-16 bg-white/5 rounded-[22px] flex items-center justify-center border border-white/10 group-active:scale-90 transition-all shadow-lg">
                                    <img src={binanceLogo} className="w-10 h-10 object-contain" alt="Binance" />
                                </div>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Binance</span>
                            </button>
                            <button onClick={() => handleWalletClick("safepal")} className="flex flex-col items-center gap-3 bg-transparent border-none cursor-pointer group">
                                <div className="w-16 h-16 bg-white/5 rounded-[22px] flex items-center justify-center border border-white/10 group-active:scale-90 transition-all shadow-lg">
                                    <img src={safepalLogo} className="w-10 h-10 object-contain" alt="SafePal" />
                                </div>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">SafePal</span>
                            </button>
                            <button onClick={() => handleWalletClick("tokenpocket")} className="flex flex-col items-center gap-3 bg-transparent border-none cursor-pointer group">
                                <div className="w-16 h-16 bg-white/5 rounded-[22px] flex items-center justify-center border border-white/10 group-active:scale-90 transition-all shadow-lg">
                                    <img src={tpLogo} className="w-10 h-10 object-contain rounded-xl" alt="TP Wallet" />
                                </div>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">TP Wallet</span>
                            </button>
                            <button onClick={handleDirectConnect} className="flex flex-col items-center gap-3 bg-transparent border-none cursor-pointer group">
                                <div className="w-16 h-16 bg-white/5 rounded-[22px] flex items-center justify-center border border-white/10 group-active:scale-90 transition-all shadow-lg">
                                    <span className="material-icons-round text-3xl text-gray-500">grid_view</span>
                                </div>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Others</span>
                            </button>
                        </div>

                        <button 
                            onClick={handleDirectConnect}
                            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 p-5 rounded-3xl flex items-center justify-between group transition-all mb-10 cursor-pointer text-white font-bold"
                        >
                            <span className="flex items-center gap-3 font-black uppercase tracking-widest text-[11px]">
                                <span className="material-icons-round text-primary">account_balance_wallet</span>
                                Other Wallets
                            </span>
                            <span className="material-icons-round text-gray-600">chevron_right</span>
                        </button>
                        
                        {/* Copy Link Helper (Inside Popup as requested) */}
                        <div className="bg-primary/5 border border-primary/10 rounded-3xl p-6 mb-8 text-center">
                            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-tight mb-4">
                                Connection slow? Paste the link in your Wallet's dApp browser.
                            </p>
                            <button 
                                onClick={() => {
                                    navigator.clipboard.writeText(window.location.origin);
                                    const tg = (window as any).Telegram?.WebApp;
                                    if (tg?.showAlert) tg.showAlert("Link Copied! Now open your Wallet App and paste it.");
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
                            className="w-full text-gray-600 font-bold uppercase text-[10px] tracking-[4px] border-none bg-transparent cursor-pointer mt-2"
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
