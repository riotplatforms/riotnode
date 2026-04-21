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
    const syncCount = useRef(0);

    // Sync signer whenever provider changes
    const syncSigner = useCallback(async () => {
        if (isConnected && walletProvider) {
            try {
                const provider = walletProvider as any;
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
                
                console.log("[Wallet] Sync attempt:", syncCount.current, "Address:", address);
            } catch (err) {
                console.error("[Wallet] Signer sync failed:", err);
                setSigner(null);
            }
        } else {
            setSigner(null);
            // We don't clear walletName here to allow "poking" the last used wallet during reconnections
        }
    }, [isConnected, walletProvider, address]);

    useEffect(() => {
        syncSigner();
    }, [syncSigner]);

    // SMART SYNC: Fast-Retry logic when user returns to Telegram
    const fastRetrySync = useCallback(() => {
        syncCount.current = 0;
        const retries = [100, 300, 600, 1200, 2500];
        retries.forEach(delay => {
            setTimeout(() => {
                syncCount.current++;
                syncSigner();
            }, delay);
        });
    }, [syncSigner]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log("[Wallet] Focus detected - triggering fast-retry sync");
                fastRetrySync();
            }
        };
        window.addEventListener('focus', handleVisibilityChange);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            window.removeEventListener('focus', handleVisibilityChange);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [fastRetrySync]);

    // Global listener for deep link bridging in TMA
    useEffect(() => {
        if (!walletProvider) return;
        const provider = walletProvider as any;
        
        if (provider && typeof provider.on === 'function') {
            provider.on("display_uri", (uri: string) => {
                const tg = (window as any).Telegram?.WebApp;
                if (tg && tg.openLink) {
                    const universalUri = `https://link.walletconnect.com/wc?uri=${encodeURIComponent(uri)}`;
                    tg.openLink(universalUri, { try_instant_view: false });
                }
            });
        }
    }, [walletProvider]);

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
            setWalletName(null);
            await walletDisconnect();
        } catch (err) {
            console.error("[Wallet] Disconnect failed:", err);
        }
    };

    return (
        <WalletContext.Provider value={{ 
            address, 
            isConnected: !!isConnected, 
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
