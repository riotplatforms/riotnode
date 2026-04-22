import React, { createContext, useContext, useState, useEffect } from 'react';


import { BrowserProvider, JsonRpcSigner } from 'ethers';
import { EthereumProvider } from '@walletconnect/ethereum-provider';

// 1. Connection Config
const projectId = 'ec457184730a7f1e24bbe58a393f442b';
const metadata = {
    name: 'AI MINING BTC',
    description: 'AI-powered Staking Platform (RiotNode)',
    url: 'https://riotnode.riotplatfroms.workers.dev',
    icons: ['https://riotnode.riotplatfroms.workers.dev/logo.png']
};

interface WalletContextType {
    address: string | undefined;
    isConnected: boolean;
    signer: JsonRpcSigner | null;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    isConnecting: boolean;
    walletType: string | null;
    walletProvider: any;
    forceSync: () => Promise<void>;
    hardReset: () => void;
    setIsDisconnectModalOpen: (open: boolean) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
    const context = useContext(WalletContext);
    if (!context) throw new Error('useWallet must be used within a WalletProvider');
    return context;
};

export function WalletProvider({ children }: { children: React.ReactNode }) {
    const [address, setAddress] = useState<string | undefined>(() => localStorage.getItem('aimining_address') || undefined);
    const [isConnected, setIsConnected] = useState(() => !!localStorage.getItem('aimining_address'));
    const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
    const [walletProvider, setWalletProvider] = useState<any>(null);
    const [isConnecting] = useState(false);
    const [walletName, setWalletName] = useState<string | null>(() => localStorage.getItem('aimining_last_wallet'));
    const [handshakeUri, setHandshakeUri] = useState<string | null>(null);
    const [isPulsing, setIsPulsing] = useState(false);
    const [showSelectionHub, setShowSelectionHub] = useState(false);
    const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
    const [pendingSelection, setPendingSelection] = useState<string | null>(null);

    // Initialize Provider
    useEffect(() => {
        const init = async () => {
            try {
                const provider = await EthereumProvider.init({
                    projectId,
                    showQrModal: false,
                    optionalNamespaces: {
                        eip155: {
                            methods: ["eth_sendTransaction", "personal_sign"],
                            chains: ["eip155:56"],
                            events: ["chainChanged", "accountsChanged"]
                        }
                    },
                    metadata
                });

                setWalletProvider(provider);

                // Reconnect if session exists
                if (provider.session) {
                    const accounts = provider.accounts;
                    if (accounts.length > 0) {
                        const addr = accounts[0];
                        setAddress(addr);
                        setIsConnected(true);
                        localStorage.setItem('aimining_address', addr);

                        const browserProvider = new BrowserProvider(provider);
                        setSigner(await browserProvider.getSigner());
                    }
                }

                provider.on("display_uri", (uri: string) => {
                    setHandshakeUri(uri);
                });

                provider.on("accountsChanged", async (accounts: string[]) => {
                    if (accounts.length > 0) {
                        const addr = accounts[0];
                        setAddress(addr);
                        setIsConnected(true);
                        localStorage.setItem('aimining_address', addr);
                        const browserProvider = new BrowserProvider(provider);
                        setSigner(await browserProvider.getSigner());
                        setShowSelectionHub(false);
                        setHandshakeUri(null);
                    } else {
                        setAddress(undefined);
                        setIsConnected(false);
                        setSigner(null);
                        localStorage.removeItem('aimining_address');
                    }
                });

                provider.on("connect", () => {
                    console.log("[Web3] Session Connected!");
                    forceSync(true);
                });

                provider.on("disconnect", () => {
                    setAddress(undefined);
                    setIsConnected(false);
                    setSigner(null);
                    localStorage.removeItem('aimining_address');
                    localStorage.removeItem('aimining_last_wallet');
                });

            } catch (err) {
                console.error("[Web3] Init failed:", err);
            }
        };
        init();
    }, []);

    // INSTANT SYNC: When user returns from wallet app
    useEffect(() => {
        const handleSync = () => {
            if (document.visibilityState === 'visible') {
                console.log("[Web3] Visibility wake-up -> Syncing...");
                forceSync();
            }
        };
        document.addEventListener('visibilitychange', handleSync);
        window.addEventListener('focus', handleSync);
        return () => {
            document.removeEventListener('visibilitychange', handleSync);
            window.removeEventListener('focus', handleSync);
        };
    }, [walletProvider]);

    const forceSync = async (silent = false) => {
        if (!silent) setIsPulsing(true);
        if (walletProvider) {
            try {
                const accounts = await walletProvider.request({ method: 'eth_accounts' });
                if (accounts && accounts.length > 0) {
                    const addr = accounts[0];
                    setAddress(addr);
                    setIsConnected(true);
                    localStorage.setItem('aimining_address', addr);
                    const browserProvider = new BrowserProvider(walletProvider);
                    setSigner(await browserProvider.getSigner());
                    setShowSelectionHub(false);
                    setHandshakeUri(null);
                }
            } catch (e) {
                console.warn("[Sync] Fail:", e);
            }
        }
        if (!silent) setTimeout(() => setIsPulsing(false), 800);
    };

    // HIGH-SPEED HEARTBEAT: Pulse every 600ms when waiting
    useEffect(() => {
        if (!handshakeUri && !showSelectionHub) return;
        const interval = setInterval(() => forceSync(true), 600);
        return () => clearInterval(interval);
    }, [handshakeUri, showSelectionHub, walletProvider]);

    // AUTO-LAUNCHER: When a selection is made and URI arrives, FIRE it immediately
    useEffect(() => {
        if (pendingSelection && handshakeUri) {
            console.log(`[Hub] Auto-launching (Universal): ${pendingSelection}`);
            const encodedUri = encodeURIComponent(handshakeUri);

            const schemes: Record<string, string> = {
                'metamask': `https://metamask.app.link/wc?uri=${encodedUri}`,
                'trust': `https://link.trustwallet.com/wc?uri=${encodedUri}`,
                'binance': `https://app.binance.com/wc?uri=${encodedUri}`,
                'safepal': `https://link.safepal.io/wc?uri=${encodedUri}`,
                'tp': `https://link.tokenpocket.pro/wc?uri=${encodedUri}`,
                'okx': `https://www.okx.com/wc?uri=${encodedUri}`
            };

            const tg = (window as any).Telegram?.WebApp;
            if (tg && tg.openLink) {
                tg.openLink(schemes[pendingSelection] || schemes.metamask, { try_instant_view: false });
            }

            // Clear URI but keep selection for visual pulse
            setHandshakeUri(null);
        }
    }, [pendingSelection, handshakeUri]);

    const hardReset = () => {
        localStorage.clear();
        setHandshakeUri(null);
        setSigner(null);
        setAddress(undefined);
        setIsConnected(false);
        window.location.reload();
    };

    const handleHubSelect = async (walletKey: string) => {
        if (!walletProvider) return;
        setPendingSelection(walletKey);
        setIsPulsing(true);
        localStorage.setItem('aimining_last_wallet', walletKey);
        setWalletName(walletKey);

        try {
            await walletProvider.connect();
        } catch (err) {
            console.error("[Hub] Handshake failed:", err);
            setPendingSelection(null);
            setIsPulsing(false);
        }
    };

    const connect = async () => {
        if (isConnected) return;
        setShowSelectionHub(true);
    };

    const disconnect = async () => {
        if (walletProvider) {
            try { await walletProvider.disconnect(); } catch (e) { }
        }
        localStorage.removeItem('aimining_address');
        localStorage.removeItem('aimining_last_wallet');
        setAddress(undefined);
        setIsConnected(false);
        setSigner(null);
        window.location.reload();
    };

    return (
        <WalletContext.Provider value={{
            address: address || signer?.address,
            isConnected: isConnected || !!signer,
            signer,
            connect,
            disconnect,
            isConnecting,
            walletType: walletName,
            walletProvider,
            forceSync,
            hardReset,
            setIsDisconnectModalOpen
        }}>
            {children}

            {/* DISCONNECT MODAL (Global) */}
            {isDisconnectModalOpen && isConnected && (
                <div className="fixed inset-0 z-[10000] flex items-end justify-center sm:items-center p-4 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsDisconnectModalOpen(false)}></div>
                    <div className="glass-panel w-full max-w-sm rounded-[32px] p-6 shadow-2xl relative translate-y-0 animate-in slide-in-from-bottom duration-500 neon-border">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-sm font-black text-white uppercase tracking-widest">Active Wallet</h3>
                            <button onClick={() => setIsDisconnectModalOpen(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border-none cursor-pointer">
                                <span className="material-icons-round text-sm text-gray-500">close</span>
                            </button>
                        </div>

                        <div className="bg-black/40 rounded-2xl p-4 border border-white/5 mb-6 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                                <span className="material-icons-round text-2xl text-primary">account_balance_wallet</span>
                            </div>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Network: Binance Smart Chain</p>
                            <p className="text-xs font-mono text-white break-all">{address}</p>
                        </div>

                        <button 
                            onClick={() => { setIsDisconnectModalOpen(false); disconnect(); }}
                            className="w-full py-4 bg-red-500/10 text-red-500 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-red-500/20 transition-all active:scale-95 border-none cursor-pointer"
                        >
                            Disconnect Wallet
                        </button>
                        
                        <p className="text-[8px] text-gray-700 text-center mt-6 uppercase font-bold tracking-[4px]">RiotNode Secure Protocol</p>
                    </div>
                </div>
            )}

            {/* GOD-MODE CONNECTION BRIDGE */}
            {/* DIRECT-CONNECT PREMIUM HUB */}
            {showSelectionHub && (
                <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
                    <div className="glass-panel rounded-[40px] p-8 w-full max-w-sm shadow-2xl relative overflow-hidden neon-border">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-30"></div>

                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-xl font-bold text-white uppercase tracking-tighter metallic-text">Connection Hub</h2>
                            <button
                                onClick={() => { setShowSelectionHub(false); setPendingSelection(null); }}
                                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border-none cursor-pointer hover:bg-white/10 transition-colors"
                            >
                                <span className="material-icons-round text-sm text-gray-500">close</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-8">
                            {[
                                { id: 'metamask', name: 'MetaMask', icon: 'fox', color: '#F6851B' },
                                { id: 'trust', name: 'Trust Wallet', icon: 'shield', color: '#3375BB' },
                                { id: 'binance', name: 'Binance', icon: 'grid_view', color: '#F3BA2F' },
                                { id: 'safepal', name: 'SafePal', icon: 'security', color: '#E9E9E9' },
                                { id: 'tp', name: 'TokenPocket', icon: 'account_balance_wallet', color: '#2980B9' },
                                { id: 'okx', name: 'OKX Wallet', icon: 'toll', color: '#000000' }
                            ].map(w => (
                                <button
                                    key={w.id}
                                    onClick={() => handleHubSelect(w.id)}
                                    disabled={!!pendingSelection}
                                    className={`
                                        relative group glass-card p-4 rounded-3xl flex flex-col items-center gap-3 transition-all active:scale-95 cursor-pointer border-none
                                        ${pendingSelection === w.id ? 'bg-primary/10 border-primary shadow-neon' : ''}
                                    `}
                                >
                                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center relative overflow-hidden group-hover:bg-white/10 transition-colors">
                                        <span className="material-icons-round text-3xl" style={{ color: w.color }}>{w.icon}</span>
                                        {pendingSelection === w.id && (
                                            <div className="absolute inset-0 bg-primary/20 animate-pulse"></div>
                                        )}
                                    </div>
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-white transition-colors">{w.name}</span>
                                </button>
                            ))}
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => forceSync()}
                                className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 border-none transition-all active:scale-95 cursor-pointer 
                                    ${isPulsing ? 'btn-premium' : 'bg-white/5 text-gray-400 font-black uppercase text-[10px] tracking-widest'}`}
                            >
                                <span className={`material-icons-round text-sm ${isPulsing ? 'animate-spin' : ''}`}>sync</span>
                                {isPulsing ? 'Syncing Session...' : 'I HAVE CONNECTED IN WALLET'}
                            </button>
                            <p className="text-[8px] text-gray-600 font-bold uppercase tracking-[4px] text-center mt-2">Protocol V2.5 • RiotNode Alpha</p>
                        </div>
                    </div>
                </div>
            )}

            {/* HANDSHAKE OVERLAY (Hidden until URI generated) */}
            {handshakeUri && !showSelectionHub && (
                <div className="fixed bottom-10 left-6 right-6 z-[10000] animate-in slide-in-from-bottom duration-500">
                    <div className="bg-primary p-4 rounded-[32px] flex items-center justify-between shadow-neon border-none relative overflow-hidden">
                        <div className="absolute inset-0 bg-white/10 animate-pulse"></div>
                        <div className="flex items-center gap-3 relative z-10">
                            <div className="w-10 h-10 bg-black/10 rounded-2xl flex items-center justify-center">
                                <span className="material-icons-round text-black animate-spin">refresh</span>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-black uppercase tracking-tight leading-none">Awaiting Approval</p>
                                <p className="text-[10px] text-black/60 font-bold uppercase tracking-widest">Connect to finish...</p>
                            </div>
                        </div>
                        <button
                            onClick={() => forceSync()}
                            className="bg-black text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase border-none cursor-pointer active:scale-95 transition-all relative z-10 shadow-lg"
                        >
                            Sync Now
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
