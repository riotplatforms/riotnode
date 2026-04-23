import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserProvider, JsonRpcSigner } from 'ethers';
import { createAppKit, useAppKit, useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { bsc, mainnet } from '@reown/appkit/networks';

// 1. Connection Config (REOWN / WALLETCONNECT)
const projectId = 'ec457184730a7f1e24bbe58a393f442b';

const metadata = {
    name: 'AI MINING BTC',
    description: 'AI-powered Staking Platform (RiotNode)',
    url: 'https://riotnode.riotplatforms.workers.dev/', 
    icons: ['https://riotnode.riotplatforms.workers.dev/logo.png'],
    redirect: {
        native: 'tg://resolve?domain=AiMiningBTC_bot',
        universal: 'https://t.me/AiMiningBTC_bot/app'
    }
};

// Initialize AppKit
createAppKit({
    adapters: [new EthersAdapter()],
    networks: [bsc, mainnet],
    metadata,
    projectId,
    features: {
        analytics: true,
        email: false,
        socials: false,
        allWallets: true // Support 600+ wallets
    },
    themeMode: 'dark',
    themeVariables: {
        '--w3m-accent': '#FFD700',
        '--w3m-border-radius-master': '1px'
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
    // Compatibility properties
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
    const { open } = useAppKit();
    const { address, isConnected, status } = useAppKitAccount();
    const { walletProvider } = useAppKitProvider('eip155');
    const [signer, setSigner] = useState<JsonRpcSigner | null>(null);

    const isConnecting = status === 'connecting';

    useEffect(() => {
        const syncSigner = async () => {
            if (isConnected && walletProvider) {
                try {
                    const browserProvider = new BrowserProvider(walletProvider as any);
                    const s = await browserProvider.getSigner();
                    setSigner(s);
                    if (address) localStorage.setItem('aimining_address', address);
                } catch (e) {
                    console.error("[Web3] Signer sync failed:", e);
                }
            } else {
                setSigner(null);
                if (!isConnected) localStorage.removeItem('aimining_address');
            }
        };
        syncSigner();
    }, [isConnected, walletProvider, address]);

    const connect = async () => {
        try {
            await open();
        } catch (err) {
            console.error("[Web3] Open modal failed:", err);
        }
    };

    const disconnect = async () => {
        await open({ view: 'Account' });
    };

    const forceSync = async () => {
        // Handled by AppKit
    };

    const hardReset = () => {
        localStorage.clear();
        window.location.reload();
    };

    const setIsDisconnectModalOpen = (isOpen: boolean) => {
        if (isOpen) {
            open({ view: 'Account' });
        }
    };

    return (
        <WalletContext.Provider value={{
            address,
            isConnected,
            signer,
            connect,
            disconnect,
            isConnecting,
            walletType: 'AppKit',
            walletProvider,
            forceSync,
            hardReset,
            setIsDisconnectModalOpen
        }}>
            {children}
        </WalletContext.Provider>
    );
}

export function Web3Provider({ children }: { children: React.ReactNode }) {
    return <WalletProvider>{children}</WalletProvider>;
}
