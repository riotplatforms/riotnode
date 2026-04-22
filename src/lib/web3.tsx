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


    // 1. Handshake Capture: Detects URI and displays it in our direct bridge
    useEffect(() => {
        if (!walletProvider) return;
        const provider = walletProvider as any;
        
        if (provider && typeof provider.on === 'function') {
            provider.on("display_uri", (uri: string) => {
                console.log("[Bridge] New URI Generated:", uri.slice(0, 20) + "...");
                setHandshakeUri(uri);
            });
        }
    }, [walletProvider]);

    // 2. FORCE SYNC: The "Finalize Connection" manual pulse
    const syncSigner = useCallback(async (isManual = false) => {
        if (walletProvider) {
            try {
                const provider = walletProvider as any;
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
                    else if (name.includes('binance')) detected = 'binance';
                    else if (name.includes('okx')) detected = 'okx';
                    
                    if (detected) {
                        setWalletName(detected);
                        localStorage.setItem('aimining_last_wallet', detected);
                    }
                    if (isManual) console.log("[Watchdog] Signer Recovered:", accounts[0]);

                    // Instantly close the Loading state
                    setHandshakeUri(null);
                    setIsConnecting(false);
                    return true;
                }
            } catch (err) {
                if (isManual) console.warn("[Watchdog] Sync error:", err);
            }
        }
        return false;
    }, [walletProvider]);

    const forceSync = async () => {
        setIsPulsing(true);
        const success = await syncSigner(true);
        setTimeout(() => setIsPulsing(false), 1500);
        if (success) {
            setHandshakeUri(null);
        }
    };

    const hardReset = () => {
        console.log("[Bridge] Performing Hard Reset...");
        localStorage.clear();
        sessionStorage.clear();
        setHandshakeUri(null);
        setSigner(null);
        walletDisconnect().catch(() => {});
        window.location.reload();
    };

    useEffect(() => {
        syncSigner();
    }, [syncSigner, address]);

    // 3. STORAGE WATCHDOG: Periodic session check
    useEffect(() => {
        const interval = setInterval(() => {
           if (!isConnected || !signer) {
               syncSigner(true);
           }
        }, 3000);
        return () => clearInterval(interval);
    }, [isConnected, signer, syncSigner]);

    const connect = async () => {
        try {
            setIsConnecting(true);
            await open();
        } catch (err) {
            console.error("[Wallet] Connection failed:", err);
        } finally {
            setIsConnecting(false);
        }
    };

    const disconnect = async () => {
        try {
            localStorage.removeItem('aimining_last_wallet');
            Object.keys(localStorage).forEach(key => {
                if (key.includes('wc@2') || key.includes('WALLETCONNECT')) {
                    localStorage.removeItem(key);
                }
            });
            setWalletName(null);
            setSigner(null);
            walletDisconnect().catch(() => {});
            window.location.reload(); 
        } catch (err) {
            console.error("[Wallet] Disconnect failed:", err);
        }
    };

    const launchWallet = (scheme: string, mode: 'universal'|'native' = 'native') => {
        if (!handshakeUri) return;
        const tg = (window as any).Telegram?.WebApp;
        if (tg && tg.openLink) {
            const cleanUri = handshakeUri.includes('%') ? decodeURIComponent(handshakeUri) : handshakeUri;
            
            // SPECIAL HANDLING FOR SAFEPAL
            if (scheme.includes('safepal')) {
                if (mode === 'universal') {
                    // Universal Bridge (link.safepal.io)
                    tg.openLink(`https://link.safepal.io/wc?uri=${encodeURIComponent(cleanUri)}`, { try_instant_view: false });
                } else {
                    // Native protocol (safepalwallet://wc?uri=...)
                    const target = `safepalwallet://wc?uri=${encodeURIComponent(cleanUri)}`;
                    tg.openLink(target, { try_instant_view: false });
                }
                return;
            }

            // DEFAULT: NATIVE PROTOCOL
            const encoded = encodeURIComponent(cleanUri);
            const target = `${scheme}wc?uri=${encoded}`;
            tg.openLink(target, { try_instant_view: false });
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

            {/* DIRECT HANDSHAKE BRIDGE UI */}
            {handshakeUri && (
                <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-300">
                    <div className="bg-[#0f0f0f] border border-primary/30 rounded-[40px] p-8 w-full max-w-sm shadow-glow relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-80"></div>
                        
                        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 mx-auto border border-primary/30 relative">
                             <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping opacity-20"></div>
                            <span className="material-icons-round text-primary text-4xl animate-pulse">link</span>
                        </div>

                        <h2 className="text-xl font-black text-white uppercase tracking-tight mb-2">Bridge Securely</h2>
                        
                        <div className="flex flex-col gap-2 mb-6">
                            <button 
                                onClick={() => launchWallet('safepalwallet://', 'native')}
                                className="w-full bg-[#111] hover:bg-primary hover:text-black py-4 rounded-2xl flex items-center justify-between px-6 transition-all group border border-white/5 active:scale-95 cursor-pointer"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="material-icons-round text-primary group-hover:text-black text-lg">bolt</span>
                                    <span className="font-black text-xs uppercase tracking-wider">Direct SafePal (Recommended)</span>
                                </div>
                                <span className="material-icons-round text-primary group-hover:text-black text-sm">arrow_forward</span>
                            </button>

                            <button 
                                onClick={() => launchWallet('tpoutside://')}
                                className="w-full bg-[#111] hover:bg-primary hover:text-black py-4 rounded-2xl flex items-center justify-between px-6 transition-all group border border-white/5 active:scale-95 cursor-pointer"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="material-icons-round text-primary group-hover:text-black text-lg">token</span>
                                    <span className="font-black text-xs uppercase tracking-wider">TokenPocket Native</span>
                                </div>
                                <span className="material-icons-round text-primary group-hover:text-black text-sm">arrow_forward</span>
                            </button>

                            <div className="h-px bg-white/5 my-2"></div>

                            <button 
                                onClick={forceSync}
                                className={`w-full ${isPulsing ? 'bg-primary text-black' : 'bg-primary/10 text-primary'} py-4 rounded-2xl flex items-center justify-center gap-3 border border-primary/20 transition-all font-black uppercase text-[11px] tracking-widest active:scale-95 cursor-pointer group`}
                            >
                                <span className={`material-icons-round text-sm font-black ${isPulsing ? 'animate-spin' : 'group-hover:animate-bounce'}`}>
                                    {isPulsing ? 'sync' : 'verified_user'}
                                </span>
                                {isPulsing ? 'Pulsing...' : 'Confirm Link (Step 2)'}
                            </button>
                        </div>

                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-6 opacity-40">
                             Handshake Active: {handshakeUri.slice(0, 12)}...
                        </p>

                        <div className="flex items-center justify-center gap-6">
                            <button 
                                onClick={hardReset}
                                className="text-[9px] font-black text-red-500/50 uppercase tracking-widest hover:text-red-500 transition-colors border-none bg-transparent cursor-pointer"
                            >
                                Hard Reset
                            </button>
                            <button 
                                onClick={() => setHandshakeUri(null)}
                                className="text-[9px] font-black text-gray-700 uppercase tracking-widest hover:text-white transition-colors border-none bg-transparent cursor-pointer"
                            >
                                Close Bridge
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
