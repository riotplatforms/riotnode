import React, { createContext, useContext, useState, useEffect } from 'react';
import { createAppKit, useAppKitProvider, useAppKitAccount, useAppKit } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { bsc } from '@reown/appkit/networks';
import { BrowserProvider, JsonRpcSigner } from 'ethers';

// 1. Get ProjectId
const projectId = 'ec457184730a7f1e24bbe58a393f442b';

// 2. Set networks
const networks: [any, ...any[]] = [bsc];

// 3. Create a metadata object - optional
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
    const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);

    // Sync signer whenever provider changes
    useEffect(() => {
        const syncSigner = async () => {
            if (isConnected && walletProvider) {
                try {
                    const provider = walletProvider as any;
                    const browserProvider = new BrowserProvider(provider);
                    const web3Signer = await browserProvider.getSigner();
                    setSigner(web3Signer);
                } catch (err) {
                    console.error("[Wallet] Signer sync failed:", err);
                    setSigner(null);
                }
            } else {
                setSigner(null);
            }
        };
        syncSigner();
    }, [isConnected, walletProvider]);

    // Global listener for deep link bridging in TMA
    useEffect(() => {
        if (!walletProvider) return;

        const provider = walletProvider as any;
        
        // Listen for display_uri to bridge to Telegram
        if (provider && typeof provider.on === 'function') {
            provider.on("display_uri", (uri: string) => {
                console.log("[AppKit TMA Bridge] Intercepted URI:", uri);
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
            // AppKit handles internal disconnect, but we can trigger it
            await open({ view: 'Account' }); // Shows account view where disconnect is available
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
            walletType: (walletProvider as any)?.session?.peer?.metadata?.name?.toLowerCase() || null
        }}>
            {children}
        </WalletContext.Provider>
    );
}

export function Web3Provider({ children }: { children: React.ReactNode }) {
    return <WalletProvider>{children}</WalletProvider>;
}
