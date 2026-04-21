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
  // Feature the most reliable mobile wallets
  featuredWalletIds: [
    'c56bbc40a89474a2d85830541457197b', // MetaMask
    '4622a2b2d6ad1323bca51c019187f621', // Trust
    '762c1d97118241a457494441af10665b', // SafePal
    'd681b9730e0e35fd2aeb053416ca9797'  // TokenPocket
  ],
  allWallets: 'HIDE', // Only show our featured and tested mobile wallets
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
    
    const pollingInterval = useRef<any>(null);

    // BRUTE-FORCE SYNC: Manually check provider for addresses and sessions
    const syncSigner = useCallback(async (isManual = false) => {
        if (walletProvider) {
            try {
                const provider = walletProvider as any;
                
                // Direct Storage Handshake: Fastest way to detect WC session
                const sessions = localStorage.getItem('wc@2:client:0.3:session');
                const hasActiveSession = sessions && sessions !== '[]';

                // Only proceed if SDK says connected OR storage has a session
                if (isConnected || hasActiveSession) {
                    // Force accounts request to wake up SDK
                    const accounts = await provider.request({ method: 'eth_accounts' });
                    
                    if (accounts && accounts.length > 0) {
                        const browserProvider = new BrowserProvider(provider);
                        const web3Signer = await browserProvider.getSigner();
                        setSigner(web3Signer);

                        // Robust Wallet Identification
                        const peer = provider?.session?.peer || JSON.parse(sessions || '[]')[0]?.peer;
                        const sessionName = peer?.metadata?.name?.toLowerCase() || '';
                        
                        let detected: string | null = null;
                        if (sessionName.includes('metamask')) detected = 'metamask';
                        else if (sessionName.includes('trust')) detected = 'trust';
                        else if (sessionName.includes('safepal')) detected = 'safepal';
                        else if (sessionName.includes('tokenpocket')) detected = 'tp';
                        
                        if (detected) {
                            setWalletName(detected);
                            localStorage.setItem('aimining_last_wallet', detected);
                        }
                        
                        if (isManual) console.log("[Wallet] Brute-Force Sync SUCCESS:", accounts[0]);
                        
                        // If we found accounts, we can stop the aggressive polling
                        if (pollingInterval.current) {
                            clearInterval(pollingInterval.current);
                            pollingInterval.current = null;
                        }
                    }
                }
            } catch (err) {
                if (isManual) console.warn("[Wallet] Manual sync probe:", err);
            }
        }
    }, [isConnected, walletProvider]);

    useEffect(() => {
        syncSigner();
    }, [syncSigner, address]);

    // START BRUTE-FORCE POLLING
    const startAggressivePolling = useCallback(() => {
        if (pollingInterval.current) clearInterval(pollingInterval.current);
        
        console.log("[Wallet] Starting Brute-Force Poll Engine (60s)...");
        let attempts = 0;
        pollingInterval.current = setInterval(() => {
            attempts++;
            syncSigner(true);
            if (attempts > 120) { // Stop after 60 seconds (120 * 500ms)
                clearInterval(pollingInterval.current);
                pollingInterval.current = null;
            }
        }, 500);
    }, [syncSigner]);

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

    // Global listener for deep link bridging in TMA
    useEffect(() => {
        if (!walletProvider) return;
        const provider = walletProvider as any;
        
        if (provider && typeof provider.on === 'function') {
            provider.on("display_uri", (uri: string) => {
                const tg = (window as any).Telegram?.WebApp;
                if (tg && tg.openLink) {
                    // Try the universal bridge first, but ensure clean encoding for SafePal/TP
                    const universalUri = `https://link.walletconnect.com/wc?uri=${encodeURIComponent(uri)}`;
                    console.log("[Bridge] Opening Wallet Handshake...");
                    tg.openLink(universalUri, { try_instant_view: false });
                }
            });
        }
    }, [walletProvider]);

    const connect = async () => {
        try {
            setIsConnecting(true);
            await open();
            // Start aggressive polling immediately after opening the modal
            startAggressivePolling();
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
