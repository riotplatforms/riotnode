import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../lib/web3';
import { isAdmin } from '../lib/admin';

const Settings: React.FC = () => {
    const navigate = useNavigate();
    const { address, disconnect, setIsDisconnectModalOpen } = useWallet();
    const [notifications, setNotifications] = useState(true);

    // Theme specific colors for Settings page (Yellow/Brown)
    // Primary: #f4c025, Bg-Dark: #221e10

    return (
        <div className="flex-1 flex flex-col pb-8 min-h-screen bg-[#221e10] text-white font-display">
            {/* Header */}
            <header className="flex items-center px-4 py-4 justify-between sticky top-0 z-10 bg-[#221e10]/95 backdrop-blur-sm border-b border-white/5">
                <button onClick={() => navigate(-1)} className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-white/10 cursor-pointer transition-colors text-white">
                    <span className="material-icons-round">arrow_back</span>
                </button>
                <h2 className="text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-10">Settings</h2>
            </header>

            <main className="flex-1 flex flex-col px-4 pb-8">
                {/* Profile Header */}
                <div className="py-6">
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 shadow-sm border border-white/5">
                        <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-16 w-16 shrink-0 border-2 border-[#f4c025]" style={{ backgroundImage: 'url("https://api.dicebear.com/7.x/avataaars/svg?seed=miner")' }}>
                        </div>
                        <div className="flex flex-col justify-center flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <p className="text-lg font-bold leading-tight tracking-tight truncate">{address ? `Miner_${address.slice(-4)}` : 'CryptoMiner_99'}</p>
                                <span className="material-icons-round text-[#f4c025] text-[16px]">verified</span>
                            </div>
                            <p className="text-[#bab29c] text-sm font-medium">Level 5 • Pro Miner</p>
                        </div>
                        <div className="shrink-0">
                            <span className="material-icons-round text-white/30">qr_code_2</span>
                        </div>
                    </div>
                </div>

                {/* Group: Account */}
                <div className="flex flex-col gap-2 mb-6">
                    <h3 className="text-[#bab29c] text-xs font-bold uppercase tracking-wider px-2 pb-1">Account</h3>
                    <div className="flex flex-col bg-white/5 rounded-xl overflow-hidden shadow-sm border border-white/5">
                        {/* Profile Settings */}
                        <div className="flex items-center gap-4 px-4 py-3.5 justify-between hover:bg-white/5 transition-colors cursor-pointer group">
                            <div className="flex items-center gap-4 overflow-hidden">
                                <div className="flex items-center justify-center rounded-lg bg-[#f4c025]/10 shrink-0 size-10 group-hover:bg-[#f4c025]/20 transition-colors">
                                    <span className="material-icons-round text-[#f4c025]">person</span>
                                </div>
                                <p className="text-base font-medium leading-normal flex-1 truncate">Profile Settings</p>
                            </div>
                            <span className="material-icons-round text-white/30">chevron_right</span>
                        </div>
                        <div className="h-px bg-white/5 mx-4"></div>
                        {/* Security */}
                        <div className="flex items-center gap-4 px-4 py-3.5 justify-between hover:bg-white/5 transition-colors cursor-pointer group">
                            <div className="flex items-center gap-4 overflow-hidden">
                                <div className="flex items-center justify-center rounded-lg bg-[#f4c025]/10 shrink-0 size-10 group-hover:bg-[#f4c025]/20 transition-colors">
                                    <span className="material-icons-round text-[#f4c025]">encrypted</span>
                                </div>
                                <p className="text-base font-medium leading-normal flex-1 truncate">Security / 2FA</p>
                            </div>
                            <span className="material-icons-round text-white/30">chevron_right</span>
                        </div>
                    </div>
                </div>

                {/* Group: Finance */}
                <div className="flex flex-col gap-2 mb-6">
                    <h3 className="text-[#bab29c] text-xs font-bold uppercase tracking-wider px-2 pb-1">Finance</h3>
                    <div className="flex flex-col bg-white/5 rounded-xl overflow-hidden shadow-sm border border-white/5">
                        {/* Wallet Address */}
                        <div 
                            onClick={() => setIsDisconnectModalOpen(true)}
                            className="flex items-center gap-4 px-4 py-3.5 justify-between hover:bg-white/5 transition-colors cursor-pointer group"
                        >
                            <div className="flex items-center gap-4 overflow-hidden">
                                <div className="flex items-center justify-center rounded-lg bg-[#f4c025]/10 shrink-0 size-10 group-hover:bg-[#f4c025]/20 transition-colors">
                                    <span className="material-icons-round text-[#f4c025]">account_balance_wallet</span>
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                    <p className="text-base font-medium leading-normal truncate">Wallet Connection</p>
                                    <p className="text-[10px] text-[#bab29c] font-black uppercase">Click to Manage</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs text-white/40 font-mono hidden min-[350px]:block">{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Disconnected'}</span>
                                <span className="material-icons-round text-white/30">chevron_right</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Group: App Preferences */}
                <div className="flex flex-col gap-2 mb-8">
                    <h3 className="text-[#bab29c] text-xs font-bold uppercase tracking-wider px-2 pb-1">App Preferences</h3>
                    <div className="flex flex-col bg-white/5 rounded-xl overflow-hidden shadow-sm border border-white/5">
                        {/* Notifications */}
                        <div onClick={() => setNotifications(!notifications)} className="flex items-center gap-4 px-4 py-3.5 justify-between hover:bg-white/5 transition-colors cursor-pointer group">
                            <div className="flex items-center gap-4 overflow-hidden">
                                <div className="flex items-center justify-center rounded-lg bg-[#f4c025]/10 shrink-0 size-10 group-hover:bg-[#f4c025]/20 transition-colors">
                                    <span className="material-icons-round text-[#f4c025]">notifications</span>
                                </div>
                                <p className="text-base font-medium leading-normal flex-1 truncate">Notification Preferences</p>
                            </div>
                            <div className={`w-11 h-6 rounded-full relative transition-colors ${notifications ? 'bg-[#f4c025]' : 'bg-gray-600'}`}>
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${notifications ? 'right-1' : 'left-1'}`}></div>
                            </div>
                        </div>
                        <div className="h-px bg-white/5 mx-4"></div>
                        {/* Language */}
                        <div className="flex items-center gap-4 px-4 py-3.5 justify-between hover:bg-white/5 transition-colors cursor-pointer group">
                            <div className="flex items-center gap-4 overflow-hidden">
                                <div className="flex items-center justify-center rounded-lg bg-[#f4c025]/10 shrink-0 size-10 group-hover:bg-[#f4c025]/20 transition-colors">
                                    <span className="material-icons-round text-[#f4c025]">language</span>
                                </div>
                                <p className="text-base font-medium leading-normal flex-1 truncate">Language</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-white/50">English</span>
                                <span className="material-icons-round text-white/30">chevron_right</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Group: Admin (Only visible for admins) */}
                {isAdmin(address) && (
                    <div className="flex flex-col gap-2 mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <h3 className="text-[#f4c025] text-xs font-bold uppercase tracking-wider px-2 pb-1 flex items-center gap-1">
                            <span className="material-icons-round text-xs">admin_panel_settings</span> Admin
                        </h3>
                        <div className="flex flex-col bg-[#f4c025]/10 rounded-xl overflow-hidden border border-[#f4c025]/30 shadow-[0_0_15px_rgba(244,192,37,0.1)]">
                            <div 
                                onClick={() => navigate('/admincontrol')}
                                className="flex items-center gap-4 px-4 py-4 justify-between hover:bg-[#f4c025]/10 transition-colors cursor-pointer group"
                            >
                                <div className="flex items-center gap-4 overflow-hidden">
                                    <div className="flex items-center justify-center rounded-lg bg-[#f4c025]/20 shrink-0 size-10 group-hover:scale-110 transition-transform">
                                        <span className="material-icons-round text-[#f4c025]">security</span>
                                    </div>
                                    <div>
                                        <p className="text-base font-bold text-[#f4c025] leading-none">Admin Control Panel</p>
                                        <p className="text-[10px] text-[#f4c025]/60 mt-1 uppercase font-black">Authorized Access Only</p>
                                    </div>
                                </div>
                                <span className="material-icons-round text-[#f4c025]">chevron_right</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Version */}
                <p className="text-center text-xs text-white/20 font-medium mt-auto">
                    Ai Mining BTC v1.0.4
                </p>
            </main>
        </div>
    );
};

export default Settings;
