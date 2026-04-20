import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../lib/web3';
import { useStaking, getTierRate } from '../hooks/useStaking';
import { formatUnits } from 'ethers';
import { usePrice } from '../hooks/usePrice';

const Wallet: React.FC = () => {
    const navigate = useNavigate();
    const { address, isConnected, connect, disconnect } = useWallet();
    const { getStakedInfo, getStakeDetails, getWalletBalance, getTeamTree, getTeamMiningStats } = useStaking();
    const { btcPrice } = usePrice();

    const [stats, setStats] = useState({
        referralRewards: '0.00',
        totalEarned: '0.00',
        totalStaked: '0.00',
        walletBalance: '0.00',
        invitationBonus: '0',
        teamDividend: '0.00000000000000',
        isEligible: false
    });

    const [nextMaturity, setNextMaturity] = useState<number | null>(null);
    const [currentTime, setCurrentTime] = useState(Date.now() / 1000);

    // Timer effect for live countdown
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(Date.now() / 1000), 1000);
        return () => clearInterval(timer);
    }, []);

    const formatCountdown = (maturityTime: number) => {
        const diff = maturityTime - currentTime;
        if (diff <= 0) return null;

        const days = Math.floor(diff / 86400);
        const hours = Math.floor((diff % 86400) / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = Math.floor(diff % 60);

        return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    };

    useEffect(() => {
        const fetchWalletData = async () => {
            if (!isConnected || !address) return;
            const info = await getStakedInfo(address);
            const wBalance = await getWalletBalance(address);
            if (wBalance === null) return;

            if (info) {
                // Calculate internal staking
                let totalAccruedBtc = 0;
                let activeStaked = 0;
                let minMaturity = Infinity;
                let totalExpectedStake = 0;
                const count = info.stakeCount;

                const lastViolationStr = localStorage.getItem(`violationTime_${address.toLowerCase()}`);
                let lastViolationTime = lastViolationStr ? parseInt(lastViolationStr, 10) : 0;

                // Calculate total expected stake first
                for (let i = 0; i < count; i++) {
                    const detail = await getStakeDetails(address, i);
                    const timePassed = (Date.now() / 1000) - (detail?.startTime || 0);
                    const isCompleted = timePassed >= (37 * 86400);
                    
                    if (detail && !detail.withdrawn && !isCompleted && detail.startTime >= lastViolationTime) {
                        totalExpectedStake += parseFloat(formatUnits(detail.amount, 18));
                    }
                }

                const wBalanceNum = parseFloat(wBalance);
                
                // Get most recent stake time
                let latestStakeTime = 0;
                for (let i = 0; i < count; i++) {
                    const detail = await getStakeDetails(address, i);
                    if (detail && detail.startTime > latestStakeTime) {
                        latestStakeTime = detail.startTime;
                    }
                }

                const secondsSinceLastStake = (Date.now() / 1000) - latestStakeTime;

                // Removed Auto-Recovery: IF violated, you must manually re-stake to get a new start-time.

                // Violation if wallet is COMPLETELY empty (< 0.001 USDT) AND user has active stakes
                // AND we are NOT in the 60s grace period after a stake
                if (totalExpectedStake > 0 && wBalanceNum < 0.001 && secondsSinceLastStake > 60) {
                    lastViolationTime = Math.floor(Date.now() / 1000);
                    localStorage.setItem(`violationTime_${address.toLowerCase()}`, lastViolationTime.toString());
                }

                totalAccruedBtc = 0;
                for (let i = 0; i < count; i++) {
                    const detail = await getStakeDetails(address, i);
                    if (detail && !detail.withdrawn) {
                        const stakeAmount = parseFloat(formatUnits(detail.amount, 18));
                        
                        // No fake recovery, use actual start time
                        const logicalStartTime = detail.startTime;
                        const timePassed = (Date.now() / 1000) - logicalStartTime;
                        
                        const isCompleted = timePassed >= (37 * 86400);
                        const isViolated = detail.startTime < lastViolationTime;

                        if (isViolated && !isCompleted) continue;

                        const rate = getTierRate(stakeAmount);
                        const accrued = ((stakeAmount * rate) / 37 / 86400 * timePassed) / btcPrice;
                        totalAccruedBtc += accrued;
                        activeStaked += stakeAmount;

                        const maturity = detail.startTime + (37 * 86400);
                        if (maturity < minMaturity) minMaturity = maturity;
                    }
                }
                setNextMaturity(minMaturity === Infinity ? null : minMaturity);

                const finalizedEarnedBtc = parseFloat(formatUnits(info.totalEarned, 18)) / btcPrice;
                const currentTotalBtc = finalizedEarnedBtc + totalAccruedBtc;

                // Networking Logic
                const isEligible = activeStaked >= 200;
                
                // Initial update
                setStats({
                    referralRewards: formatUnits(info.referralRewards, 18),
                    totalEarned: currentTotalBtc.toFixed(14),
                    totalStaked: activeStaked.toFixed(2),
                    walletBalance: parseFloat(wBalance).toFixed(2),
                    invitationBonus: '0',
                    teamDividend: '0.00000000000000',
                    isEligible
                });

                // Detailed Team Update
                const tree = await getTeamTree(address);
                const teamStats = await getTeamMiningStats(tree, btcPrice);
                const l1Count = tree[1]?.length || 0;

                setStats(prev => ({
                    ...prev,
                    invitationBonus: isEligible ? (l1Count * 20).toString() : '0',
                    teamDividend: teamStats.totalDailyDividend.toFixed(14)
                }));
            }
        };
        fetchWalletData();
        const interval = setInterval(fetchWalletData, 15000); // 15s refresh
        return () => clearInterval(interval);
    }, [isConnected, address, getStakedInfo, getStakeDetails, getWalletBalance, getTeamTree, getTeamMiningStats, btcPrice]);

    const handleWithdraw = () => {
        if (!isConnected) {
            connect();
            return;
        }
        alert('Minimum withdrawal is 1 USDT. Rewards are processed 24/7 upon completion of a 37-day staking cycle. Please visit the "Stakes" page to manage your active mining cycles.');
        navigate('/stake');
    };

    return (
        <div className="flex-1 flex flex-col pb-10 bg-background-dark min-h-screen text-white font-display">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-5 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-30 border-b border-gray-800">
                <button onClick={() => navigate(-1)} className="cursor-pointer hover:text-primary transition-colors border-none bg-transparent flex items-center">
                    <span className="material-icons-round text-gray-400 hover:text-primary underline">arrow_back</span>
                </button>
                <div className="flex items-center gap-2">
                    <h1 className="font-display font-black text-xl text-white tracking-[0.1em] uppercase">My Assets</h1>
                </div>
                <div className="w-6"></div>
            </header>

            <main className="flex-1 p-6 space-y-8 overflow-y-auto scrollbar-hide">
                {/* Balance Card */}
                <div className="bg-card-dark rounded-3xl p-6 relative overflow-hidden border border-gray-800 shadow-card">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <span className="material-icons-round text-9xl text-primary font-black">account_balance_wallet</span>
                    </div>
                    <div className="relative z-10">
                        <p className="text-gray-400 font-medium uppercase tracking-wider text-xs mb-2">Total Mined Balance</p>
                        <h2 className="text-xl font-black text-white mb-1 tracking-tighter">{stats.totalEarned} <span className="text-primary text-sm uppercase">BTC</span></h2>
                        <p className="text-gray-500 text-[10px] font-mono">≈ ${(parseFloat(stats.totalEarned) * btcPrice).toFixed(2)} USDT</p>

                        <div className="flex gap-3 mt-6">
                            {!isConnected ? (
                                <button onClick={() => connect()} className="w-full bg-primary text-black py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow-neon hover:scale-105 transition-transform flex items-center justify-center gap-2 border-none cursor-pointer">
                                    <span className="material-icons-round text-lg font-black">account_balance_wallet</span> Connect Wallet
                                </button>
                            ) : (
                                <button 
                                    onClick={() => disconnect()}
                                    className="w-full bg-red-500/10 text-red-500 py-3 rounded-xl font-black text-xs uppercase tracking-wider border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer mb-2"
                                >
                                    <span className="material-icons-round text-lg">logout</span> Disconnect {address?.slice(0, 4)}...{address?.slice(-4)}
                                </button>
                            )}
                            {isConnected && (
                                <button 
                                    onClick={handleWithdraw} 
                                    className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border-none shadow-neon-soft ${
                                        nextMaturity && (nextMaturity > currentTime) 
                                        ? 'bg-white/5 text-gray-500 border border-white/10' 
                                        : 'bg-primary text-black shadow-neon'
                                    }`}
                                >
                                    <span className="material-icons-round text-lg font-black">{nextMaturity && (nextMaturity > currentTime) ? 'lock' : 'arrow_upward'}</span> 
                                    {nextMaturity && (nextMaturity > currentTime) 
                                        ? `Locked (${formatCountdown(nextMaturity)})` 
                                        : 'Withdraw Rewards'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Assets Breakdown */}
                <div className="space-y-4">
                    <h3 className="text-gray-500 text-xs font-black uppercase tracking-widest px-2">Assets Breakdown</h3>
                    <div className="bg-card-dark rounded-2xl border border-gray-800 overflow-hidden divide-y divide-gray-800">
                        <div className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors shadow-neon-soft">
                                    <span className="material-icons-round text-green-500 font-black">account_balance_wallet</span>
                                </div>
                                <div>
                                    <p className="font-bold text-sm">Available USDT</p>
                                    <p className="text-xs text-gray-500 font-mono">Wallet Fund</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-sm text-green-500">{stats.walletBalance} USDT</p>
                                <p className="text-[10px] text-gray-500 uppercase font-black">Connected Wallet</p>
                            </div>
                        </div>

                        <div className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                    <span className="material-icons-round text-primary font-black">savings</span>
                                </div>
                                <div>
                                    <p className="font-bold text-sm">Staked Amount</p>
                                    <p className="text-xs text-gray-500 font-mono">Principal</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-sm">{stats.totalStaked} USDT</p>
                                <p className="text-xs text-green-500 font-bold uppercase tracking-tighter">Active Mining</p>
                            </div>
                        </div>

                        <div className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors shadow-neon-soft">
                                    <span className="material-icons-round text-blue-500 font-black">trending_up</span>
                                </div>
                                <div>
                                    <p className="font-bold text-sm">Mining Yield</p>
                                    <p className="text-xs text-gray-500 font-mono">Personal Earnings</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-xs">{stats.totalEarned} BTC</p>
                                <p className="text-[10px] text-green-500 font-black uppercase animate-pulse">Live</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Network Earnings Logic */}
                <div className="space-y-4 pb-20">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-gray-500 text-xs font-black uppercase tracking-widest leading-none">Network Earnings</h3>
                        <button onClick={() => navigate('/team')} className="text-primary text-[10px] font-black uppercase tracking-tighter hover:underline bg-transparent border-none cursor-pointer">Detailed Tree</button>
                    </div>
                    
                    <div 
                        onClick={() => navigate('/team')}
                        className="bg-gradient-to-br from-[#0c0c0c] to-black rounded-3xl p-6 border border-primary/20 shadow-glow relative overflow-hidden group cursor-pointer"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <span className="material-icons-round text-6xl text-primary font-black">hub</span>
                        </div>
                        
                        <div className="flex flex-col gap-1 relative z-10">
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.1em] mb-4 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
                                Live Network Daily Dividends
                            </p>
                            <div className="flex items-baseline gap-2 mb-2">
                                <h2 className="text-2xl font-black text-white tracking-tighter leading-none">{stats.teamDividend}</h2>
                                <span className="text-xs font-black text-primary uppercase">BTC/Day</span>
                            </div>
                            
                            <div className="h-px bg-white/5 my-4"></div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col">
                                    <p className="text-[9px] text-gray-600 font-black uppercase mb-1">Invitation Bonus</p>
                                    <p className="text-sm font-black text-white leading-none">${stats.invitationBonus} <span className="text-[8px] text-[#444]">USDT</span></p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] text-gray-600 font-black uppercase mb-1">Eligible Tier</p>
                                    <p className={`text-[10px] font-black uppercase leading-none ${stats.isEligible ? 'text-primary' : 'text-red-500'}`}>
                                        {stats.isEligible ? 'Active Networker' : 'Inactive'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {!stats.isEligible && (
                        <p className="text-[9px] text-gray-600 px-2 italic">
                            * Note: Stake minimum $200 USDT to activate invitation bonuses and ROI dividends.
                        </p>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Wallet;
