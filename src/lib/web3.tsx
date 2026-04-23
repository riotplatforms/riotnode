import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { BrowserProvider, JsonRpcSigner } from 'ethers';
import { EthereumProvider } from '@walletconnect/ethereum-provider';

// 1. Connection Config
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

interface WalletContextType {
    address: string | undefined;
    isConnected: boolean;
    signer: JsonRpcSigner | null;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    isConnecting: boolean;
    walletType: string | null;
    walletProvider: any;
    // TMA Specific & Stability
    forceSync: (silent?: boolean) => Promise<void>;
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
    const [walletProvider, setWalletProvider] = useState<any>(null);
    const [address, setAddress] = useState<string | undefined>(undefined);
    const [isConnected, setIsConnected] = useState(false);
    const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);

    // 2. Initialize Provider
    useEffect(() => {
        const init = async () => {
            try {
                const provider = await EthereumProvider.init({
                    projectId,
                    showQrModal: true, // This enables the 600+ wallet support (Legacy UI)
                    qrModalOptions: {
                        themeMode: 'dark',
                    },
                    chains: [56], // BSC
                    optionalChains: [56, 1],
                    methods: ["eth_sendTransaction", "personal_sign", "eth_accounts"],
                    events: ["chainChanged", "accountsChanged"],
                    metadata
                });

                setWalletProvider(provider);

                // Handle events
                provider.on("accountsChanged", (accounts) => {
                    if (accounts.length > 0) {
                        setAddress(accounts[0]);
                        localStorage.setItem('aimining_address', accounts[0]);
                        setIsConnected(true);
                    } else {
                        setAddress(undefined);
                        setIsConnected(false);
                    }
                });

                provider.on("chainChanged", () => window.location.reload());
                provider.on("disconnect", () => {
                    setIsConnected(false);
                    setAddress(undefined);
                    localStorage.removeItem('aimining_address');
                });

                // Auto-reconnect
                if (provider.session) {
                    setAddress(provider.accounts[0]);
                    setIsConnected(true);
                }
            } catch (err) {
                console.error("WC Init failed", err);
            }
        };
        init();
    }, []);

    // 3. Sync Signer
    useEffect(() => {
        if (isConnected && walletProvider) {
            const sync = async () => {
                const browserProvider = new BrowserProvider(walletProvider);
                const s = await browserProvider.getSigner();
                setSigner(s);
            };
            sync();
        } else {
            setSigner(null);
        }
    }, [isConnected, walletProvider]);

    const connect = async () => {
        if (!walletProvider) return;
        setIsConnecting(true);
        try {
            await walletProvider.connect();
        } catch (err) {
            console.error("Connect failed", err);
        } finally {
            setIsConnecting(false);
        }
    };

    const disconnect = async () => {
        if (walletProvider) {
            await walletProvider.disconnect();
            setIsConnected(false);
            setAddress(undefined);
            setSigner(null);
            localStorage.removeItem('aimining_address');
        }
    };

    const forceSync = useCallback(async (silent = false) => {
        if (!walletProvider || !isConnected) return;
        try {
            const accounts = await walletProvider.request({ method: 'eth_accounts' });
            if (accounts && accounts[0] !== address) {
                setAddress(accounts[0]);
            }
        } catch (err) {
            if (!silent) console.error("Sync failed", err);
        }
    }, [walletProvider, isConnected, address]);

    const hardReset = () => {
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
    };

    return (
        <WalletContext.Provider value={{
            address,
            isConnected,
            signer,
            connect,
            disconnect,
            isConnecting,
            walletType: 'Reown',
            walletProvider,
            forceSync,
            hardReset,
            setIsDisconnectModalOpen
        }}>
            {children}
            
            {/* Simple Account Info Modal (Replaced my Hub) */}
            {isDisconnectModalOpen && isConnected && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-6 w-full max-w-xs text-center">
                        <h3 className="text-white font-bold mb-4">Account Info</h3>
                        <p className="text-gray-400 text-xs break-all mb-6">{address}</p>
                        <div className="flex flex-col gap-2">
                            <button 
                                onClick={disconnect}
                                className="bg-red-500/20 text-red-500 py-3 rounded-xl font-bold border-none"
                            >
                                Disconnect
                            </button>
                            <button 
                                onClick={() => setIsDisconnectModalOpen(false)}
                                className="bg-white/5 text-white py-3 rounded-xl font-bold border-none"
                            >
                                Close
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
