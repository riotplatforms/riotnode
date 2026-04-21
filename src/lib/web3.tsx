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
  // Feature the most reliable mobile wallets for TMA
  featuredWalletIds: [
    'c56bbc40a89474a2d85830541457197b', // MetaMask
    '4622a2b2d6ad1323bca51c019187f621', // Trust
    '762c1d97118241a457494441af10665b', // SafePal
    'd681b9730e0e35fd2aeb053416ca9797', // TokenPocket
    '8a0ee10452995142101c030d7042502c', // Binance
    '971e689d0ad3b533db5817bc2d449622'  // OKX
  ],
  allWallets: 'SHOW', // Restore full wallet explorer as requested
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#FFD700', // Gold accent
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

    // STORAGE PULSE: High-speed observer to bypass SDK lag
    const checkStorageSync = useCallback(() => {
        try {
            const sessions = localStorage.getItem('wc@2:client:0.3:session');
            const hasSession = sessions && sessions !== '[]';
            
            if (hasSession && !isConnected) {
                console.log("[StoragePulse] Session detected in storage - forcing sync probe");
                // The moment we see a session, we should try to refresh the connection
                // But we don't want to reload the page. We'll rely on the provider sync logic below.
            }
        } catch (e) {}
    }, [isConnected]);

    // BRUTE-FORCE SYNC: Manually check provider for addresses and sessions
    const syncSigner = useCallback(async (isManual = false) => {
        if (walletProvider) {
            try {
                const provider = walletProvider as any;
                
                // Direct Pulse: Ensure accounts are visible
                const accounts = await provider.request({ method: 'eth_accounts' });
                
                if (accounts && accounts.length > 0) {
                    const browserProvider = new BrowserProvider(provider);
                    const web3Signer = await browserProvider.getSigner();
                    setSigner(web3Signer);

                    // Robust Wallet Identification
                    const sessionName = provider?.session?.peer?.metadata?.name?.toLowerCase() || '';
                    let detected: string | null = null;
                    if (sessionName.includes('metamask')) detected = 'metamask';
                    else if (sessionName.includes('trust')) detected = 'trust';
                    else if (sessionName.includes('safepal')) detected = 'safepal';
                    else if (sessionName.includes('tokenpocket')) detected = 'tp';
                    
                    if (detected) {
                        setWalletName(detected);
                        localStorage.setItem('aimining_last_wallet', detected);
                    }
                }
            } catch (err) {
                if (isManual) console.warn("[Wallet] Manual sync probe:", err);
            }
        }
    }, [walletProvider]);

    useEffect(() => {
        syncSigner();
    }, [syncSigner, address]);

    // START STORAGE PULSE ENGINE
    const startPulse = useCallback(() => {
        if (pulseTimer.current) clearInterval(pulseTimer.current);
        
        console.log("[StoragePulse] Starting high-speed observer (300ms)...");
        pulseTimer.current = setInterval(() => {
            checkStorageSync();
            syncSigner(true);
        }, 300);

        // Auto-stop after 45 seconds to save battery
        setTimeout(() => {
            if (pulseTimer.current) {
                clearInterval(pulseTimer.current);
                pulseTimer.current = null;
            }
        }, 45000);
    }, [checkStorageSync, syncSigner]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                syncSigner(true);
            }
        };
        window.addEventListener('focus', handleVisibilityChange);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            window.removeEventListener('focus', handleVisibilityChange);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [syncSigner]);

    // NATIVE BRIDGE: Direct links for SafePal and Trust to fix "Missing Button"
    useEffect(() => {
        if (!walletProvider) return;
        const provider = walletProvider as any;
        
        if (provider && typeof provider.on === 'function') {
            provider.on("display_uri", (uri: string) => {
                const tg = (window as any).Telegram?.WebApp;
                if (tg && tg.openLink) {
                    // Try to use native bridges for popular wallets
                    const encodedUri = encodeURIComponent(uri);
                    
                    // Standard universal link
                    const universalUri = `https://link.walletconnect.com/wc?uri=${encodedUri}`;

                    console.log("[Bridge] Opening Native Handshake...");
                    tg.openLink(universalUri, { try_instant_view: false });
                }
            });
        }
    }, [walletProvider]);

    const connect = async () => {
        try {
            setIsConnecting(true);
            await open();
            // Start the pulse engine immediately
            startPulse();
        } catch (err) {
            console.error("[Wallet] Connection failed:", err);
        } finally {
            setIsConnecting(false);
        }
    };

    const disconnect = async () => {
        try {
            localStorage.removeItem('aimining_last_wallet');
            setWalletName(null);
            setSigner(null);
            await walletDisconnect();
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
            walletType: walletName
        }}>
            {children}
        </WalletContext.Provider>
    );
}

export function Web3Provider({ children }: { children: React.ReactNode }) {
    return <WalletProvider>{children}</WalletProvider>;
}
