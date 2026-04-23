import React, { createContext, useContext, useState, useEffect } from 'react';
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

// Internal Assets for the Hub
const LOGO_METAMASK = 'https://raw.githubusercontent.com/MetaMask/brand-resources/master/SVG/metamask-fox.svg';
const LOGO_TRUST = 'https://trustwallet.com/assets/images/media/assets/TWT.png';
const LOGO_BINANCE = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png';
const LOGO_SAFEPAL = 'https://link.safepal.io/asset/logo.png';
const LOGO_OKX = 'https://static.okx.com/cdn/assets/imgs/247/C67E2941BC70E904.png';
const LOGO_TP = 'https://www.tokenpocket.pro/assets/images/tokenpocket_logo.png';

export function WalletProvider({ children }: { children: React.ReactNode }) {
    const [walletProvider, setWalletProvider] = useState<any>(null);
    const [address, setAddress] = useState<string | undefined>(undefined);
    const [isConnected, setIsConnected] = useState(false);
    const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
    const [isConnecting, setIsConnecting] = useState(false); // Used in Type interface, keeping state for now
    const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
    const [showSelectionHub, setShowSelectionHub] = useState(false);
    const [handshakeUri, setHandshakeUri] = useState<string | null>(null);
    const [pendingSelection, setPendingSelection] = useState<string | null>(null);

    // Initialization
    useEffect(() => {
        const init = async () => {
            try {
                const provider = await EthereumProvider.init({
                    projectId,
                    showQrModal: false, // We use our Premium Hub
                    chains: [56],
                    optionalChains: [1, 56],
                    methods: ["eth_sendTransaction", "personal_sign", "eth_accounts"],
                    events: ["chainChanged", "accountsChanged"],
                    metadata
                });

                setWalletProvider(provider);

                provider.on("display_uri", (uri) => {
                    console.log("[Hub] New pairing URI:", uri);
                    setHandshakeUri(uri);
                });

                provider.on("connect", () => {
                    setIsConnected(true);
                    setAddress(provider.accounts[0]);
                    setShowSelectionHub(false);
                    setHandshakeUri(null);
                    setPendingSelection(null);
                });

                provider.on("disconnect", () => {
                    setIsConnected(false);
                    setAddress(undefined);
                    localStorage.removeItem('aimining_address');
                });

                if (provider.session) {
                    setIsConnected(true);
                    setAddress(provider.accounts[0]);
                }
            } catch (err) {
                console.error("WC Init failed", err);
            }
        };
        init();
    }, []);

    // Sync Signer
    useEffect(() => {
        if (isConnected && walletProvider) {
            const sync = async () => {
                try {
                    const browserProvider = new BrowserProvider(walletProvider);
                    const s = await browserProvider.getSigner();
                    setSigner(s);
                } catch (e) {}
            };
            sync();
        } else {
            setSigner(null);
        }
    }, [isConnected, walletProvider]);

    // Deep Link Logic
    useEffect(() => {
        if (pendingSelection && handshakeUri) {
            const encodedUri = encodeURIComponent(handshakeUri);
            const tg = (window as any).Telegram?.WebApp;
            
            const links: Record<string, string> = {
                'metamask': `https://metamask.app.link/wc?uri=${encodedUri}`,
                'trust': `https://link.trustwallet.com/wc?uri=${encodedUri}`,
                'binance': `https://app.binance.com/wc?uri=${encodedUri}`,
                'safepal': `https://link.safepal.io/wc?uri=${encodedUri}`,
                'tp': `https://tp-lab.tokenpocket.pro/wc?uri=${encodedUri}`,
                'okx': `https://www.okx.com/download?uri=${encodedUri}`
            };

            const target = links[pendingSelection] || `wc:${handshakeUri}`;
            
            // LAUNCH: 500ms delay to ensure app is ready
            const timer = setTimeout(() => {
                if (tg && tg.openLink) {
                    tg.openLink(target, { try_instant_view: false });
                } else {
                    window.location.href = target;
                }
            }, 600);

            return () => clearTimeout(timer);
        }
    }, [pendingSelection, handshakeUri]);

    const connect = async () => {
        if (isConnected) return;
        setHandshakeUri(null);
        setPendingSelection(null);
        setShowSelectionHub(true);
        if (walletProvider) {
            await walletProvider.connect().catch(() => {});
        }
    };

    const handleSelect = (key: string) => {
        setIsConnecting(true);
        setPendingSelection(key);
    };

    const disconnect = async () => {
        if (walletProvider) {
            await walletProvider.disconnect();
            setIsConnected(false);
            setAddress(undefined);
            setIsDisconnectModalOpen(false);
        }
    };

    const forceSync = async () => {};
    const hardReset = () => { localStorage.clear(); window.location.reload(); };

    return (
        <WalletContext.Provider value={{
            address, isConnected, signer, connect, disconnect, isConnecting,
            walletType: pendingSelection, walletProvider, forceSync, hardReset, setIsDisconnectModalOpen
        }}>
            {children}

            {/* Premium Hub Overlay */}
            {showSelectionHub && !isConnected && (
                <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-end md:justify-center bg-black/90 backdrop-blur-md transition-all duration-500 p-4">
                    <div className="w-full max-w-md bg-[#161616] border border-white/10 rounded-[40px] p-8 shadow-2xl relative overflow-hidden">
                        {/* Title Section */}
                        <div className="text-center mb-8">
                            <h2 className="text-xl font-black text-white uppercase tracking-wider">Connect Wallet</h2>
                            <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">Select your preferred SECURE vault</p>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-8">
                            {[
                                { id: 'metamask', name: 'MetaMask', icon: LOGO_METAMASK },
                                { id: 'trust', name: 'Trust', icon: LOGO_TRUST },
                                { id: 'safepal', name: 'SafePal', icon: LOGO_SAFEPAL },
                                { id: 'okx', name: 'OKX', icon: LOGO_OKX },
                                { id: 'binance', name: 'Binance', icon: LOGO_BINANCE },
                                { id: 'tp', name: 'Pocket', icon: LOGO_TP }
                            ].map(w => (
                                <button
                                    key={w.id}
                                    onClick={() => handleSelect(w.id)}
                                    className={`flex flex-col items-center gap-2 p-4 rounded-3xl transition-all duration-300 border-none bg-transparent ${pendingSelection === w.id ? 'bg-primary/10 ring-2 ring-primary/40' : 'hover:bg-white/5'}`}
                                >
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center p-2.5 bg-gradient-to-br from-white/10 to-transparent shadow-lg ${pendingSelection === w.id ? 'animate-pulse' : ''}`}>
                                        <img src={w.icon} alt={w.name} className="w-full h-full object-contain" />
                                    </div>
                                    <span className="text-[9px] font-black uppercase text-gray-400">{w.name}</span>
                                </button>
                            ))}
                        </div>

                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={() => setShowSelectionHub(false)}
                                className="w-full py-4 text-gray-500 font-bold text-xs uppercase border-none bg-transparent"
                            >
                                Cancel Connection
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Account Info Modal */}
            {isDisconnectModalOpen && isConnected && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setIsDisconnectModalOpen(false)}>
                    <div className="bg-[#1a1a1a] border border-white/10 rounded-[32px] p-8 w-full max-w-xs text-center" onClick={e => e.stopPropagation()}>
                        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="material-icons-round text-primary text-3xl">account_balance_wallet</span>
                        </div>
                        <h3 className="text-white font-bold mb-2">Connected</h3>
                        <p className="text-gray-500 text-[10px] break-all mb-8 bg-black/40 p-3 rounded-xl border border-white/5">{address}</p>
                        <button 
                            onClick={disconnect}
                            className="w-full bg-red-500 text-white py-4 rounded-2xl font-black text-xs uppercase border-none hover:bg-red-600 transition-colors shadow-lg"
                        >
                            Disconnect Wallet
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
