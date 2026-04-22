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
            setIsConnecting(false);
        }
    };

    const hardReset = () => {
        localStorage.clear();
        sessionStorage.clear();
        setHandshakeUri(null);
        setSigner(null);
        walletDisconnect().catch(() => {});
        window.location.reload();
    };

    const connect = async () => {
        try {
            setIsConnecting(true);
            await open();
        } catch (err) {
            console.error("[Wallet] Connection error:", err);
        } finally {
            setIsConnecting(false);
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

    const launchWallet = (scheme: string) => {
        if (!handshakeUri) return;
        const tg = (window as any).Telegram?.WebApp;
        if (tg && tg.openLink) {
            const cleanUri = handshakeUri.includes('%') ? decodeURIComponent(handshakeUri) : handshakeUri;
            
            // SPECIAL HANDLING: SafePal and TokenPocket direct protocols
            if (scheme.includes('safepal')) {
                // Try Universal first, then fallback to Native deep-link
                tg.openLink(`https://link.safepal.io/wc?uri=${encodeURIComponent(cleanUri)}`, { try_instant_view: false });
                return;
            }

            const encoded = encodeURIComponent(cleanUri);
            const target = `${scheme}wc?uri=${encoded}`;
            tg.openLink(target, { try_instant_view: false });
        }
    };

    const copyUri = () => {
        if (!handshakeUri) return;
        navigator.clipboard.writeText(handshakeUri);
        const tg = (window as any).Telegram?.WebApp;
        if (tg && tg.showAlert) tg.showAlert("Connection Link copied! Paste it in your wallet settings.");
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
            {handshakeUri && (
                <div className="fixed inset-0 z-[9999] bg-black/98 backdrop-blur-3xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-300">
                    <div className="bg-[#0a0a0a] border border-primary/20 rounded-[48px] p-10 w-full max-w-sm shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>
                        
                        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-8 mx-auto border border-primary/20 relative">
                             <div className="absolute inset-0 bg-primary/10 rounded-full animate-ping opacity-20"></div>
                            <span className="material-icons-round text-primary text-5xl animate-pulse">sensors</span>
                        </div>

                        <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Bridge Protocol</h2>
                        <p className="text-gray-500 text-[10px] font-black uppercase tracking-[3px] mb-8">Direct Handshake Active</p>

                        <div className="grid grid-cols-1 gap-4">
                            <button 
                                onClick={() => launchWallet('safepalwallet://')}
                                className="w-full bg-primary/5 hover:bg-primary hover:text-black py-4.5 rounded-2xl flex items-center justify-between px-6 transition-all group border border-white/5 active:scale-95 cursor-pointer shadow-sm"
                            >
                                <div className="flex items-center gap-4">
                                    <span className="material-icons-round text-primary group-hover:text-black text-xl">bolt</span>
                                    <span className="font-black text-xs uppercase tracking-widest">Connect SafePal</span>
                                </div>
                                <span className="material-icons-round text-primary group-hover:text-black text-sm">arrow_forward</span>
                            </button>

                            <button 
                                onClick={() => launchWallet('tpoutside://')}
                                className="w-full bg-primary/5 hover:bg-primary hover:text-black py-4.5 rounded-2xl flex items-center justify-between px-6 transition-all group border border-white/5 active:scale-95 cursor-pointer"
                            >
                                <div className="flex items-center gap-4">
                                    <span className="material-icons-round text-primary group-hover:text-black text-xl">token</span>
                                    <span className="font-black text-xs uppercase tracking-widest">TokenPocket</span>
                                </div>
                                <span className="material-icons-round text-primary group-hover:text-black text-sm">arrow_forward</span>
                            </button>

                            <div className="flex gap-2">
                                <button 
                                    onClick={forceSync}
                                    className={`flex-1 ${isPulsing ? 'bg-primary text-black' : 'bg-white/5 text-gray-400'} py-4 rounded-2xl flex items-center justify-center gap-3 border border-white/5 transition-all font-black uppercase text-[10px] tracking-widest active:scale-95 cursor-pointer`}
                                >
                                    <span className={`material-icons-round text-sm ${isPulsing ? 'animate-spin' : ''}`}>sync</span>
                                    {isPulsing ? 'Syncing...' : 'Sync Now'}
                                </button>
                                <button 
                                    onClick={copyUri}
                                    className="p-4 bg-white/5 text-primary rounded-2xl border border-white/5 active:scale-95 cursor-pointer"
                                    title="Copy Connection URI"
                                >
                                    <span className="material-icons-round text-sm">content_copy</span>
                                </button>
                            </div>
                        </div>

                        <div className="mt-10 flex flex-col gap-4">
                            <button 
                                onClick={hardReset}
                                className="text-[10px] font-black text-red-500/40 uppercase tracking-widest hover:text-red-500 transition-colors border-none bg-transparent cursor-pointer"
                            >
                                Reset Sessions
                            </button>
                            <button 
                                onClick={() => setHandshakeUri(null)}
                                className="text-[10px] font-black text-gray-700 uppercase tracking-widest hover:text-white transition-colors border-none bg-transparent cursor-pointer"
                            >
                                Cancel Connection
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </WalletContext.Provider>
    );
}

export function Web3Provider({ children }: { children: React.ReactNode }) {
    return <WalletProvider>{children}</WalletProvider>;
}
