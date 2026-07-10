import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../lib/web3';
import { useStaking, getTierRate } from '../hooks/useStaking';
import { formatUnits } from 'ethers';
import { usePrice } from '../hooks/usePrice';
import { useTelegram } from '../hooks/useTelegram';
import { parseEthersError } from '../utils/errors';

const Wallet: React.FC = () => {
    const navigate = useNavigate();
    const { address, isConnected, connect, signer, setIsDisconnectModalOpen, miningStats, setMiningStats } = useWallet();

    const { getStakedInfo, getStakeDetails, getWalletBalance, getTeamTree, getTeamMiningStats, withdraw, getStakeLastFlushedTime, recordPermanentStakeFlush, isStakePermanentlyFlushed } = useStaking();
    const { btcPrice } = usePrice();
    const { showAlert } = useTelegram();

    const [loading, setLoading] = useState(false);

    const [stats, setStats] = useState({
        referralRewards: '0.00',
        totalEarned: miningStats.balance || '0.00000000000000',
        totalStaked: miningStats.totalStaked || '0.00',
        walletBalance: miningStats.walletBalance || '0.00',
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

    const fetchWalletData = useCallback(async () => {
        if (!address) {
            setStats({
                referralRewards: '0.00',
                totalEarned: '0.00',
                totalStaked: '0.00',
                walletBalance: '0.00',
                invitationBonus: '0',
                teamDividend: '0.00000000000000',
                isEligible: false
            });
            return;
        }
        const info = await getStakedInfo(address);
        const wBalance = await getWalletBalance(address);
        if (wBalance === null) return;
        const wBalanceNum = parseFloat(wBalance);

        if (info) {
            const count = info.stakeCount;
            const fetchedStakes = [];
            let failed = false;
            for (let i = 0; i < count; i++) {
                const detail = await getStakeDetails(address, i);
                if (detail === null) {
                    failed = true;
                    break;
                }
                fetchedStakes.push(detail);
            }
            if (failed) return; // Keep previous state!

            let totalContractAmount = 0;
            let totalAccruedBtc = 0;
            let minMaturity = Infinity;
            let activeStakedForPower = 0;
            let totalActiveStaked = 0;
            let runningStakedSum = 0;
            let dailyProfitBtc = 0;

            for (let i = 0; i < count; i++) {
                const detail = fetchedStakes[i];
                if (detail && !detail.withdrawn) {
                    const stakeAmount = parseFloat(formatUnits(detail.amount, 18));
                    const finished = (Date.now() / 1000) > detail.startTime + (37 * 86400);
                    const wasFlushed = isStakePermanentlyFlushed(address, i);
                    
                    // Check violation for this individual active (non-finished) stake using running sum
                    const isViolated = wasFlushed || (!finished && wBalanceNum < runningStakedSum + stakeAmount);
                    
                    totalContractAmount += stakeAmount;

                    if (isViolated) {
                        recordPermanentStakeFlush(address, i);
                    } else {
                        const safeBtcPrice = btcPrice && btcPrice > 0 && !isNaN(btcPrice) ? btcPrice : 65000;
                        // Only active (non-finished) stakes require wallet balance and count towards active staked sum
                        if (!finished) {
                            runningStakedSum += stakeAmount;
                            totalActiveStaked += stakeAmount;
                            activeStakedForPower += stakeAmount;
                            const rate = getTierRate(stakeAmount);
                            const profit = (stakeAmount * rate) / (37 * safeBtcPrice);
                            if (!isNaN(profit) && isFinite(profit)) {
                                dailyProfitBtc += profit;
                            }
                        }

                        // Rewards continue to accrue up to the maturity cap
                        const lastFlushedTime = getStakeLastFlushedTime(address, i, detail.startTime);
                        const timePassed = Math.max(0, Math.min(37 * 86400, (Date.now() / 1000) - lastFlushedTime));
                        const rate = getTierRate(stakeAmount);
                        const accrued = ((stakeAmount * rate) / 37 / 86400 * timePassed) / safeBtcPrice;
                        if (!isNaN(accrued) && isFinite(accrued)) {
                            totalAccruedBtc += accrued;
                        }

                        const maturity = detail.startTime + (37 * 86400);
                        if (!finished && maturity < minMaturity) {
                            minMaturity = maturity;
                        }
                    }
                }
            }
            setNextMaturity(minMaturity === Infinity ? null : minMaturity);

            const currentTotalBtc = totalAccruedBtc;

            // Networking Logic (Bypassing violation checks on level eligibility)
            const isEligible = totalContractAmount >= 200;

            // Detailed Team Update
            const tree = await getTeamTree(address);
            const safeBtcPrice = btcPrice && btcPrice > 0 && !isNaN(btcPrice) ? btcPrice : 65000;
            const teamStats = await getTeamMiningStats(tree, safeBtcPrice);
            const l1Count = tree[1]?.length || 0;
            
            const newStats = {
                referralRewards: formatUnits(info.referralRewards, 18),
                totalEarned: currentTotalBtc.toFixed(14),
                totalStaked: totalActiveStaked.toFixed(2),
                walletBalance: wBalanceNum.toFixed(2),
                invitationBonus: isEligible ? (l1Count * 20).toString() : '0',
                teamDividend: teamStats.totalDailyDividend.toFixed(14),
                isEligible
            };

            setStats(newStats);
            
            // Update global context for other pages (Merging to prevent deleting fields like rewardPerSecond)
            setMiningStats((prev: any) => ({
                ...prev,
                balance: newStats.totalEarned,
                miningPower: (activeStakedForPower * 2.5).toFixed(1),
                dailyProfit: dailyProfitBtc.toFixed(14),
                totalStaked: newStats.totalStaked,
                walletBalance: newStats.walletBalance,
                isLoaded: true
            }));
        }
    }, [address, getStakedInfo, getStakeDetails, getWalletBalance, getStakeLastFlushedTime, recordPermanentStakeFlush, isStakePermanentlyFlushed, btcPrice, getTeamTree, getTeamMiningStats, setMiningStats]);

    useEffect(() => {
        fetchWalletData();
        const interval = setInterval(fetchWalletData, 60000); // 1m Stable Sync
        return () => clearInterval(interval);
    }, [fetchWalletData]);

    // Effect 2: Global High-Fidelity Ticker Subscription
    useEffect(() => {
        if (miningStats.isLoaded) {
            setStats(prev => ({
                ...prev,
                totalEarned: miningStats.balance,
                totalStaked: miningStats.totalStaked,
                walletBalance: miningStats.walletBalance
            }));
        }
    }, [miningStats]);

    const handleWithdraw = async () => {
        if (!signer) {
            connect();
            return;
        }

        if (!address) {
            showAlert('Wallet not connected. Please reconnect.');
            return;
        }

        if (loading) return;

        setLoading(true);
        try {
            const info = await getStakedInfo(address);
            if (!info || info.stakeCount === 0) {
                showAlert('No active mining cycle found.');
                return;
            }

            // Get current wallet balance for violation check
            const wBalance = await getWalletBalance(address);
            if (wBalance === null) {
                showAlert('Could not read wallet balance. Try again.');
                return;
            }
            const wBalanceNum = parseFloat(wBalance);

            let matureStakeIndex: number | null = null;
            let runningStakedSum = 0;

            for (let i = 0; i < info.stakeCount; i++) {
                const detail = await getStakeDetails(address, i);
                if (detail === null) {
                    throw new Error("RPC error: Failed to fetch stake details. Please try again.");
                }
                if (detail.withdrawn) continue;

                const stakeAmount = parseFloat(formatUnits(detail.amount, 18));
                const finished = (Date.now() / 1000) > detail.startTime + (37 * 86400);
                const wasFlushed = isStakePermanentlyFlushed(address, i);
                const isViolated = wasFlushed || (!finished && wBalanceNum < runningStakedSum + stakeAmount);

                if (!isViolated) {
                    if (!finished) {
                        runningStakedSum += stakeAmount;
                    } else {
                        // It is mature and not violated
                        matureStakeIndex = i;
                        break;
                    }
                }
            }

            if (matureStakeIndex === null) {
                showAlert('Withdrawal unlocks after the 37-day staking cycle is completed.');
                return;
            }

            await withdraw(matureStakeIndex);
            await fetchWalletData();
            showAlert('Success: Withdrawal completed!');
            navigate('/stake');
        } catch (err: any) {
            showAlert(parseEthersError(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col pb-10 bg-background-dark min-h-screen text-white font-display">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-5 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-30 border-b border-gray-800">
                <button onClick={() => navigate(-1)} className="cursor-pointer hover:text-primary transition-colors border-none bg-transparent flex items-center">
                    <span className="material-icons-round text-gray-400 hover:text-primary">arrow_back</span>
                </button>
                <div className="flex items-center gap-2">
                    <h1 className="font-display font-black text-lg text-white tracking-[0.1em] uppercase">My Assets</h1>
                </div>
                <div className="flex items-center">
                    {isConnected && (
                        <button
                            onClick={() => setIsDisconnectModalOpen(true)} 
                            className="bg-primary text-black px-3 py-1.5 rounded-full border border-primary flex items-center gap-1 shadow-neon transition-all text-[9px] font-black active:scale-95 cursor-pointer"
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                            {address?.slice(0, 4)}...{address?.slice(-4)}
                        </button>
                    )}
                </div>
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
                            {!isConnected && (
                                <button onClick={() => connect()} className="w-full bg-primary text-black py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow-neon hover:scale-105 transition-transform flex items-center justify-center gap-2 border-none cursor-pointer">
                                    <span className="material-icons-round text-lg font-black">account_balance_wallet</span> Connect Wallet
                                </button>
                            )}

                            {isConnected && (
                                <button 
                                    onClick={handleWithdraw} 
                                    disabled={loading || (!!nextMaturity && nextMaturity > currentTime)}
                                    className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border-none shadow-neon-soft ${
                                        loading || (nextMaturity && (nextMaturity > currentTime))
                                        ? 'bg-white/5 text-gray-500 border border-white/10 cursor-not-allowed' 
                                        : 'bg-primary text-black shadow-neon'
                                    }`}
                                >
                                    <span className="material-icons-round text-lg font-black">{nextMaturity && (nextMaturity > currentTime) ? 'lock' : 'arrow_upward'}</span> 
                                    {loading
                                        ? 'Processing...'
                                        : nextMaturity && (nextMaturity > currentTime) 
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

                        {/* Referral Rewards - Only show if user has 200+ USDT staked */}
                        {parseFloat(stats.totalStaked) >= 200 && (
                            <div className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors shadow-neon-soft">
                                        <span className="material-icons-round text-purple-500 font-black">group_add</span>
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm">Referral Rewards</p>
                                        <p className="text-xs text-gray-500 font-mono">Network Commissions</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-sm text-purple-500">{stats.referralRewards} USDT</p>
                                    <p className="text-[10px] text-purple-500 font-black uppercase">Claimable</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Claim Section - Show if user has referral rewards */}
                {parseFloat(stats.totalStaked) >= 200 && parseFloat(stats.referralRewards) > 0 && (
                    <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-3xl p-6 border border-purple-500/20 shadow-glow">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-black text-white uppercase tracking-tight">Claim Referral Rewards</h3>
                                <p className="text-sm text-gray-400">Paid automatically with your completed mining cycle withdrawal</p>
                            </div>
                            <span className="material-icons-round text-purple-500 text-3xl font-black">stars</span>
                        </div>

                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-sm text-gray-300">Available to Claim</p>
                                <p className="text-2xl font-black text-purple-500">{stats.referralRewards} USDT</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-gray-500">Status</p>
                                <p className="text-sm font-bold text-green-500 uppercase">Ready to Claim</p>
                            </div>
                        </div>

                        <button
                            onClick={handleWithdraw}
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white py-4 rounded-xl font-black text-sm uppercase tracking-wider shadow-neon hover:scale-105 transition-all flex items-center justify-center gap-2 border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="material-icons-round text-lg font-black">send</span>
                            {loading ? 'Processing...' : 'Claim with Completed Cycle'}
                        </button>

                        <p className="text-[10px] text-gray-500 text-center mt-3">
                            * Claim unlocks after at least one 37-day staking cycle is completed
                        </p>
                    </div>
                )}

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
                            * Note: Stake minimum $200 USDT to activate invitation bonuses and Mine dividends.
                        </p>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Wallet;
