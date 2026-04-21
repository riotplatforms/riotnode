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
    
    const pulseTimer = useRef<any>(null);

    // 1. STORAGE WATCHDOG: Monitors raw session keys to bypass SDK event lag
    const checkHandshakeSync = useCallback(() => {
        try {
            const sessions = localStorage.getItem('wc@2:client:0.3:session');
            if (sessions) {
                const parsed = JSON.parse(sessions);
                const hasActive = Array.isArray(parsed) && parsed.length > 0;
                if (hasActive && !isConnected) {
                    // Force a probe if storage says we are connected but SDK hasn't caught up
                    syncSigner(true);
                }
            }
        } catch (e) {}
    }, [isConnected]);

    // 2. BRUTE-FORCE SYNC: Manually probe the provider for a hot signer
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
                }
            } catch (err) {
                if (isManual) console.warn("[Watchdog] Probe error:", err);
            }
        }
    }, [walletProvider]);

    useEffect(() => {
        syncSigner();
    }, [syncSigner, address]);

    // 3. CONNECTION WATCHDOG: High-speed polling (300ms) for first 45 seconds
    const startPolling = useCallback(() => {
        if (pulseTimer.current) clearInterval(pulseTimer.current);
        pulseTimer.current = setInterval(() => {
            checkHandshakeSync();
            syncSigner(true);
        }, 300);

        setTimeout(() => {
            if (pulseTimer.current) {
                clearInterval(pulseTimer.current);
                pulseTimer.current = null;
            }
        }, 45000);
    }, [checkHandshakeSync, syncSigner]);

    // 4. CLEAN HANDSHAKE BRIDGE: Fixes URI mangling for TP and SafePal
    useEffect(() => {
        if (!walletProvider) return;
        const provider = walletProvider as any;
        
        if (provider && typeof provider.on === 'function') {
            provider.on("display_uri", (uri: string) => {
                const tg = (window as any).Telegram?.WebApp;
                if (tg && tg.openLink) {
                    console.log("[Bridge] Repairing URI Handshake...");
                    // Repair: Remove double encoding and avoid problematic WC universal bridge
                    let cleanUri = uri;
                    if (uri.includes('%')) {
                        try { cleanUri = decodeURIComponent(uri); } catch(e) {}
                    }
                    
                    // Native Handshake Redirects: Force specificLanding to bypass universal bridge hangs
                    const encodedClean = encodeURIComponent(cleanUri);
                    const targetUrl = `https://link.walletconnect.com/wc?uri=${encodedClean}`;
                    
                    tg.openLink(targetUrl, { try_instant_view: false });
                }
            });
        }
    }, [walletProvider]);

    const connect = async () => {
        try {
            setIsConnecting(true);
            await open();
            startPolling();
        } catch (err) {
            console.error("[Wallet] Fatal Error:", err);
        } finally {
            setIsConnecting(false);
        }
    };

    // 5. LOCAL BURN: Instant UI reset avoids "Oops... Failed to load" errors
    const disconnect = async () => {
        try {
            console.log("[Wallet] Burning local session...");
            // Force clear storage before SDK disconnect
            localStorage.removeItem('aimining_last_wallet');
            
            // Wipe WalletConnect keys to prevent "Pairing session failed" on next try
            Object.keys(localStorage).forEach(key => {
                if (key.includes('wc@2') || key.includes('WALLETCONNECT')) {
                    localStorage.removeItem(key);
                }
            });

            setWalletName(null);
            setSigner(null);
            
            // background SDK cleanup
            walletDisconnect().catch(() => {});
            
            // Instant UI Reset
            window.location.reload(); 
        } catch (err) {
            console.error("[Wallet] Burn failed:", err);
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
            walletProvider
        }}>
            {children}
        </WalletContext.Provider>
    );
}

export function Web3Provider({ children }: { children: React.ReactNode }) {
    return <WalletProvider>{children}</WalletProvider>;
}
