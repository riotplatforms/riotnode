import React from 'react';

interface WalletOption {
    id: 'metamask' | 'trust' | 'safepal' | 'tp';
    name: string;
    icon: string;
    color: string;
}

interface WalletSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (id: 'metamask' | 'trust' | 'safepal' | 'tp') => void;
}

const WALLETS: WalletOption[] = [
    { id: 'metamask', name: 'MetaMask', icon: 'https://raw.githubusercontent.com/MetaMask/brand-resources/master/SVG/metamask-fox.svg', color: '#E2761B' },
    { id: 'trust', name: 'Trust Wallet', icon: 'https://trustwallet.com/assets/images/media/assets/trust_wallet_logo.svg', color: '#3375BB' },
    { id: 'safepal', name: 'SafePal', icon: 'https://www.safepal.com/static/images/logo.png', color: '#6A4CF4' },
    { id: 'tp', name: 'TokenPocket', icon: 'https://www.tokenpocket.pro/static/images/logo.png', color: '#2980b9' }
];

const WalletSelectionModal: React.FC<WalletSelectionModalProps> = ({ isOpen, onClose, onSelect }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md transition-all duration-300">
            <div 
                className="absolute inset-0 cursor-pointer" 
                onClick={onClose}
            />
            
            <div className="relative w-full max-w-md bg-[#121212] border-t sm:border border-white/10 rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300">
                {/* Drag Indicator (Mobile) */}
                <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-3 mb-1 sm:hidden" />
                
                <div className="p-6">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-tight">Connect Wallet</h2>
                            <p className="text-gray-400 text-xs mt-1">Select your preferred wallet to continue</p>
                        </div>
                        <button 
                            onClick={onClose}
                            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all border-none cursor-pointer"
                        >
                            <span className="material-icons-round">close</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        {WALLETS.map((wallet) => (
                            <button
                                key={wallet.id}
                                onClick={() => {
                                    onSelect(wallet.id);
                                    onClose();
                                }}
                                className="group relative w-full p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-primary/50 hover:bg-white/10 active:scale-[0.98] transition-all flex items-center gap-4 text-left border-none cursor-pointer"
                            >
                                <div 
                                    className="w-12 h-12 rounded-xl flex items-center justify-center bg-black/20 group-hover:scale-110 transition-transform p-2.5"
                                    style={{ border: `1px solid ${wallet.color}22` }}
                                >
                                    <img 
                                        src={wallet.icon} 
                                        alt={wallet.name} 
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                                
                                <div className="flex-1">
                                    <span className="text-lg font-bold text-white group-hover:text-primary transition-colors">
                                        {wallet.name}
                                    </span>
                                    <p className="text-gray-500 text-[10px] uppercase font-black tracking-widest mt-0.5">
                                        Connect via app
                                    </p>
                                </div>

                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary group-hover:text-black transition-all">
                                    <span className="material-icons-round text-sm">chevron_right</span>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="mt-8 pt-6 border-t border-white/5 text-center">
                        <p className="text-gray-500 text-[11px] leading-relaxed">
                            By connecting a wallet, you agree to the <span className="text-gray-300">Terms of Service</span> and acknowledge that you have read and understand our <span className="text-gray-300">Privacy Policy</span>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WalletSelectionModal;
