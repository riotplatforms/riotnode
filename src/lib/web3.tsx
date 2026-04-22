import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
    
    const pulseTimer = useRef<any>(null);

    // 1. Instant Detection: Probes the provider the moment the app is focused
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
                    if (isManual) console.log("[Auto-Refresh] Connection Detected:", accounts[0]);

                    // Instantly close the bridge/loading UI
                    setHandshakeUri(null);
                    setIsConnecting(false);
                }
            } catch (err) {
                if (isManual) console.warn("[Auto-Refresh] Probe idle:", err);
            }
        }
    }, [walletProvider]);

    // 2. Focus Heartbeat: Force a refresh when user returns from wallet app
    useEffect(() => {
        const triggerSync = () => {
            console.log("[Auto-Refresh] App focused, pulsing provider...");
            syncSigner(true);
        };
        window.addEventListener('focus', triggerSync);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') triggerSync();
        });
        return () => {
            window.removeEventListener('focus', triggerSync);
            document.removeEventListener('visibilitychange', triggerSync);
        };
    }, [syncSigner]);

    useEffect(() => {
        syncSigner();
    }, [syncSigner, address]);

    // 3. STORAGE WATCHDOG: High-speed sync logic
    useEffect(() => {
        if (pulseTimer.current) clearInterval(pulseTimer.current);
        pulseTimer.current = setInterval(() => {
            syncSigner(true);
        }, 1000); // Pulse every second as a background stabilizer

        return () => {
            if (pulseTimer.current) clearInterval(pulseTimer.current);
        };
    }, [syncSigner]);

    // 4. Handshake Handler: Captures URI and displays it in our direct bridge
    useEffect(() => {
        if (!walletProvider) return;
        const provider = walletProvider as any;
        
        if (provider && typeof provider.on === 'function') {
            provider.on("display_uri", (uri: string) => {
                console.log("[Bridge] Pulse: New Handshake URI Generated");
                setHandshakeUri(uri);
            });
        }
    }, [walletProvider]);

    const connect = async () => {
        try {
            setIsConnecting(true);
            await open();
            // Start aggressive sync during connection process
            const t = setInterval(() => syncSigner(true), 500);
            setTimeout(() => clearInterval(t), 30000);
        } catch (err) {
            console.error("[Wallet] Connection failed:", err);
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

    // Helper: Launch Native Link with "God Mode" formatting
    const launchWallet = (scheme: string) => {
        if (!handshakeUri) return;
        const tg = (window as any).Telegram?.WebApp;
        if (tg && tg.openLink) {
            // Repair: decode and carefully re-encode to prevent "Invalid URI" or "Mangled Params"
            const cleanUri = handshakeUri.includes('%') ? decodeURIComponent(handshakeUri) : handshakeUri;
            const encoded = encodeURIComponent(cleanUri);
            
            // Native schemes are passed directly to Telegram's link handler
            const target = `${scheme}wc?uri=${encoded}`;
            tg.openLink(target, { try_instant_view: false });
        }
    };

    const copyUri = () => {
        if (!handshakeUri) return;
        const clean = handshakeUri.includes('%') ? decodeURIComponent(handshakeUri) : handshakeUri;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(clean);
        }
        const tg = (window as any).Telegram?.WebApp;
        if (tg) tg.showAlert("Connection details copied. If the app doesn't open automatically, paste this into your wallet's WalletConnect section.");
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
            walletProvider
        }}>
            {children}

            {/* DIRECT HANDSHAKE BRIDGE UI */}
            {handshakeUri && (
                <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-300">
                    <div className="bg-[#0f0f0f] border border-primary/30 rounded-[40px] p-8 w-full max-w-sm shadow-glow relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-80"></div>
                        
                        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6 mx-auto border border-primary/30 relative">
                             <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping opacity-20"></div>
                            <span className="material-icons-round text-primary text-5xl animate-pulse">link</span>
                        </div>

                        <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Bridge Connection</h2>
                        <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-8 flex items-center justify-center gap-2">
                             <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                             Securing Handshake...
                        </p>

                        <div className="grid grid-cols-1 gap-3">
                            <button 
                                onClick={() => launchWallet('safepalwallet://')}
                                className="w-full bg-[#111] hover:bg-primary hover:text-black py-4 rounded-2xl flex items-center justify-between px-6 transition-all group border border-white/5 cursor-pointer shadow-sm active:scale-95"
                            >
                                <div className="flex items-center gap-3">
                                    <img src="https://riotnode.riotplatfroms.workers.dev/safepal.png" alt="SafePal" className="w-7 h-7 grayscale group-hover:grayscale-0" onError={(e) => (e.currentTarget.src = "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/31/35/9c/31359c40-0814-25e9-798b-7f15997f6426/AppIcon-0-0-1x_U007emarketing-0-5-0-85-220.png/512x512bb.jpg")} />
                                    <span className="font-black text-[13px] uppercase tracking-wider">SafePal Wallet</span>
                                </div>
                                <span className="material-icons-round text-primary group-hover:text-black text-sm">arrow_forward</span>
                            </button>

                            <button 
                                onClick={() => launchWallet('tpoutside://')}
                                className="w-full bg-[#111] hover:bg-primary hover:text-black py-4 rounded-2xl flex items-center justify-between px-6 transition-all group border border-white/5 cursor-pointer active:scale-95"
                            >
                                <div className="flex items-center gap-3">
                                    <img src="https://riotnode.riotplatfroms.workers.dev/tp.png" alt="TokenPocket" className="w-7 h-7 grayscale group-hover:grayscale-0" onError={(e) => (e.currentTarget.src = "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/44/14/3f/44143f2d-8f35-4421-4786-098522003c26/AppIcon-0-0-1x_U007emarketing-0-5-0-85-220.png/512x512bb.jpg")} />
                                    <span className="font-black text-xs uppercase tracking-wider">TokenPocket</span>
                                </div>
                                <span className="material-icons-round text-primary group-hover:text-black text-sm">arrow_forward</span>
                            </button>

                            <div className="h-px bg-white/5 my-2"></div>

                            <button 
                                onClick={copyUri}
                                className="w-full bg-primary/5 hover:bg-primary/10 text-primary py-4 rounded-2xl flex items-center justify-center gap-3 border border-primary/20 transition-all font-black uppercase text-[10px] tracking-widest cursor-pointer group active:scale-95"
                            >
                                <span className="material-icons-round text-sm font-black group-hover:animate-bounce">content_copy</span>
                                Copy Connection URI
                            </button>
                        </div>

                        <button 
                            onClick={() => setHandshakeUri(null)}
                            className="mt-8 text-[9px] font-black text-gray-700 uppercase tracking-widest hover:text-red-500 transition-colors border-none bg-transparent cursor-pointer"
                        >
                            Cancel Bridge
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
