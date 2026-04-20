import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { EthereumProvider } from '@walletconnect/ethereum-provider';
import { BrowserProvider, JsonRpcSigner } from 'ethers';

// 1. Configuration
const projectId = 'ec457184730a7f1e24bbe58a393f442b';
const bscChainId = 56;

interface WalletContextType {
    address: string | undefined;
    isConnected: boolean;
    signer: JsonRpcSigner | null;
    connect: (walletType?: 'metamask' | 'trust' | 'safepal' | 'tp') => Promise<void>;
    disconnect: () => Promise<void>;
    isConnecting: boolean;
    walletType: 'metamask' | 'trust' | 'safepal' | 'tp' | null;
    openSelectionModal: () => void;
    closeSelectionModal: () => void;
    isModalOpen: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
    const context = useContext(WalletContext);
    if (!context) throw new Error('useWallet must be used within a WalletProvider');
    return context;
};

export function WalletProvider({ children }: { children: React.ReactNode }) {
    const [address, setAddress] = useState<string | undefined>(undefined);
    const [isConnected, setIsConnected] = useState(false);
    const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [walletType, setWalletType] = useState<'metamask' | 'trust' | 'safepal' | 'tp' | null>(
        (localStorage.getItem('last_wallet_type') as any) || null
    );
    const [provider, setProvider] = useState<any>(null);

    const openSelectionModal = () => setIsModalOpen(true);
    const closeSelectionModal = () => setIsModalOpen(false);

    // Persist session logic
    useEffect(() => {
        const checkConnection = async () => {
            const saved = localStorage.getItem('wallet_connected');
            if (saved === 'true' && !address) {
               // Optional: Auto-reconnect could be implemented here
            }
        };
        checkConnection();
    }, [address]);

    const connect = useCallback(async (selectedType: 'metamask' | 'trust' | 'safepal' | 'tp' = 'metamask') => {
        if (isConnecting) return;
        setIsConnecting(true);
        setWalletType(selectedType);
        localStorage.setItem('last_wallet_type', selectedType);

        try {
            console.log(`[Wallet] Initializing connection for ${selectedType}...`);
            
            const ethereumProvider = await EthereumProvider.init({
                projectId,
                chains: [bscChainId],
                showQrModal: true, // Fallback for desktop
                methods: ["eth_sendTransaction", "personal_sign", "eth_accounts"],
                events: ["chainChanged", "accountsChanged"],
                metadata: {
                   name: 'AI MINING BTC',
                   description: 'Secure AI-powered Bitcoin Staking Platform.',
                   url: 'https://riotnode.riotplatfroms.workers.dev/',
                   icons: ['https://riotnode.riotplatfroms.workers.dev/logo.png'],
                   redirect: {
                     native: 'https://t.me/aiminingbtc_bot',
                     universal: 'https://t.me/aiminingbtc_bot'
                   }
                }
            });

            // --- TMA BRIDGE LOGIC ---
            ethereumProvider.on("display_uri", (uri: string) => {
                console.log("[TMA Bridge] Handing over URI to Telegram:", uri);
                
                const bridges = {
                    metamask: `https://metamask.app.link/wc?uri=${encodeURIComponent(uri)}`,
                    trust: `https://link.trustwallet.com/wc?uri=${encodeURIComponent(uri)}`,
                    safepal: `https://link.safepal.io/wc?uri=${encodeURIComponent(uri)}`,
                    tp: `https://tokenpocket.pro/tp/link/walletConnect?uri=${encodeURIComponent(uri)}`
                };

                const finalUrl = bridges[selectedType] || bridges.metamask;
                
                const tg = (window as any).Telegram?.WebApp;
                if (tg && tg.openLink) {
                    tg.openLink(finalUrl, { try_instant_view: false });
                } else {
                    window.open(finalUrl, '_blank');
                }
            });

            await ethereumProvider.connect();
            
            const browserProvider = new BrowserProvider(ethereumProvider);
            const web3Signer = await browserProvider.getSigner();
            const userAddress = await web3Signer.getAddress();

            setProvider(ethereumProvider);
            setSigner(web3Signer);
            setAddress(userAddress);
            setIsConnected(true);
            localStorage.setItem('wallet_connected', 'true');

            // --- Event Listeners ---
            ethereumProvider.on("accountsChanged", (accounts: string[]) => {
                if (accounts.length === 0) disconnect();
                else setAddress(accounts[0]);
            });

            ethereumProvider.on("disconnect", () => {
                disconnect();
            });

        } catch (err) {
            console.error("[Wallet] Connection failed:", err);
            setWalletType(null);
            localStorage.removeItem('last_wallet_type');
        } finally {
            setIsConnecting(false);
        }
    }, [isConnecting]);

    const disconnect = useCallback(async () => {
        if (provider) {
            try {
                await provider.disconnect();
            } catch (e) {
                console.error("Disconnect error", e);
            }
        }
        setAddress(undefined);
        setIsConnected(false);
        setSigner(null);
        setProvider(null);
        setWalletType(null);
        localStorage.removeItem('wallet_connected');
        localStorage.removeItem('last_wallet_type');
    }, [provider]);

    return (
        <WalletContext.Provider value={{ 
            address, 
            isConnected, 
            signer, 
            connect, 
            disconnect, 
            isConnecting, 
            walletType,
            openSelectionModal,
            closeSelectionModal,
            isModalOpen
        }}>
            {children}
        </WalletContext.Provider>
    );
}

// Keep the old export names for compatibility where possible but mark as deprecated if needed
export function initWeb3() {
    // This is now handled by the WalletProvider
}

export function Web3Provider({ children }: { children: React.ReactNode }) {
    return <WalletProvider>{children}</WalletProvider>;
}
