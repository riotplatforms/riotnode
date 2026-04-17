import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWeb3ModalAccount } from '@web3modal/ethers/react';
import { useStaking } from '../hooks/useStaking';
import { useTelegram } from '../hooks/useTelegram';
import { formatUnits } from 'ethers';
import { usePrice } from '../hooks/usePrice';

const Team: React.FC = () => {
    const navigate = useNavigate();
    const { address, isConnected } = useWeb3ModalAccount();
    const { getStakedInfo, getTeamTree, getTeamMiningStats } = useStaking();
    const { showAlert, copyToClipboard } = useTelegram();
    const { btcPrice } = usePrice();

    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        myStake: 0,
        directEarnings: 0,
        teamDailyYield: 0,
        totalTeamMembers: 0,
        unlockedLevels: 0,
        isEligible: false
    });

    const [liveTeamBalance, setLiveTeamBalance] = useState('0.00000000000000');

    const fetchTeamData = useCallback(async () => {
        if (!isConnected || !address) return;
        setLoading(true);

        try {
            const info = await getStakedInfo(address);
            if (!info) return;

            const myStake = parseFloat(formatUnits(info.totalStaked, 18));
            const isEligible = myStake >= 200;
            
            let unlocked = 0;
            if (myStake >= 2000) unlocked = 10;
            else if (myStake >= 1000) unlocked = 6;
            else if (myStake >= 300) unlocked = 3;

            // Fetch team tree from events
            const tree = await getTeamTree(address);
            const teamStats = await getTeamMiningStats(tree, btcPrice);

            // Direct Invitations ($20 each) - based on Level 1 count
            const directCount = tree[1]?.length || 0;
            const directEarnings = isEligible ? directCount * 20 : 0;

            const totalCount = Object.values(tree).reduce((acc, current) => acc + current.length, 0);

            setStats({
                myStake,
                directEarnings,
                teamDailyYield: teamStats.totalDailyDividend,
                totalTeamMembers: totalCount,
                unlockedLevels: unlocked,
                isEligible
            });
            
            setLiveTeamBalance("0.00000000000000");

        } catch (err) {
            console.error("Referral fetch error:", err);
            if ((window as any).tmaLog) (window as any).tmaLog("Referral Error: " + err, "#ef4444");
        } finally {
            setLoading(false);
        }
    }, [isConnected, address, getStakedInfo, getTeamTree, getTeamMiningStats, btcPrice]);

    useEffect(() => {
        fetchTeamData();
    }, [fetchTeamData]);

    // Ticker logic for Team Dividends (ROI-on-ROI)
    useEffect(() => {
        if (stats.teamDailyYield <= 0) return;

        const rewardPerSec = stats.teamDailyYield / 86400;
        const interval = setInterval(() => {
            setLiveTeamBalance(prev => (parseFloat(prev) + rewardPerSec).toFixed(14));
        }, 1000);

        return () => clearInterval(interval);
    }, [stats.teamDailyYield]);

    const handleCopyLink = () => {
        if (!address) return;
        const link = `🤑 Earn USDT for free! 🚀\nJoin AI MINING BTC now and start your node: https://t.me/AiMiningBTC_bot?start=${address}`;
        copyToClipboard(link);
        showAlert("Referral link with invite copied!");
    };

    if (!isConnected) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-background-dark text-white text-center min-h-screen">
                <span className="material-icons-round text-6xl text-gray-700 mb-4 animate-bounce font-black">group_add</span>
                <h2 className="text-2xl font-black mb-2 uppercase tracking-tight">Referral Network</h2>
                <p className="text-gray-400 text-sm mb-6 max-w-xs">Connect your wallet to view your team building progress and daily commissions.</p>
                <button 
                    onClick={() => navigate('/')}
                    className="bg-primary text-black px-8 py-3 rounded-xl font-black uppercase text-sm border-none cursor-pointer shadow-neon"
                >
                    Connect Wallet
                </button>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col pb-10 bg-background-dark min-h-screen text-white font-display">
            {/* Header */}
            <header className="px-6 py-5 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/5 flex justify-between items-center sticky top-0 z-30">
                <div className="flex items-center gap-2">
                    <span className="material-icons-round text-primary text-xl font-black">hub</span>
                    <h1 className="font-display font-black text-xl text-white tracking-[0.1em] uppercase">Team Engine</h1>
                </div>
                <div className="bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                    <span className="text-[10px] font-black text-primary uppercase">Lv.{stats.unlockedLevels} UNLOCKED</span>
                </div>
            </header>

            <main className="p-6 space-y-6">
                {/* Team Mining Card (Live Ticker) */}
                <div className="bg-gradient-to-br from-[#0c0c0c] to-black rounded-3xl p-6 border border-primary/10 shadow-glow relative overflow-hidden group">
                    {loading && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                            <span className="material-icons-round text-primary animate-spin text-3xl font-black">sync</span>
                            <p className="text-[10px] font-black text-primary uppercase mt-2 tracking-widest">Scanning Network...</p>
                        </div>
                    )}
                    
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <span className="material-icons-round text-7xl text-primary font-black">diversity_3</span>
                    </div>
                    
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <span className="w-2 h-0.5 bg-primary"></span>
                        Network-Wide Yield
                    </p>
                    
                    <div className="flex flex-col gap-1">
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-3xl font-display font-black text-white tracking-tight break-all border-none">
                                {liveTeamBalance}
                            </h2>
                            <span className="text-sm font-black text-primary italic uppercase tracking-tighter">BTC</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-green-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse border-none"></span>
                            <span className="uppercase tracking-widest text-[9px] font-black">Team Dividend Mining</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-white/5">
                        <div>
                            <p className="text-[10px] text-gray-500 font-black uppercase mb-1">Network Speed</p>
                            <p className="text-sm font-black text-white">{(stats.teamDailyYield / 86400).toFixed(14)} <span className="text-[#444] text-[10px]">p/s</span></p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-gray-500 font-black uppercase mb-1">Daily Cap</p>
                            <p className="text-sm font-black text-white">{stats.teamDailyYield.toFixed(10)} <span className="text-primary text-[10px]">BTC</span></p>
                        </div>
                    </div>
                </div>

                {/* Eligibility Indicators */}
                <div className="grid grid-cols-1 gap-4">
                    {!stats.isEligible ? (
                        <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-1 bg-red-500 text-[8px] font-black uppercase px-2 rounded-bl-lg text-white">Action Required</div>
                            <span className="material-icons-round text-red-500 text-3xl font-black">lock</span>
                            <div>
                                <p className="text-sm font-black text-white uppercase leading-none mb-1 tracking-tight">Referral Locked</p>
                                <p className="text-[10px] text-gray-400 font-medium">Stake <span className="text-red-400 font-black">$200</span> to unlock direct and team commissions.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-green-500/10 border border-green-500/20 p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden shadow-neon-soft">
                             <div className="absolute top-0 right-0 p-1 bg-green-600 text-[8px] font-black uppercase px-2 rounded-bl-lg text-white">Active Miner</div>
                            <span className="material-icons-round text-green-500 text-3xl font-black">verified_user</span>
                            <div>
                                <p className="text-sm font-black text-white uppercase leading-none mb-1 tracking-tight">Network Activated</p>
                                <p className="text-[10px] text-gray-400 font-medium">Earning <span className="text-green-400 font-black">$20/invite</span> + Multi-Level ROI.</p>
                            </div>
                        </div>
                    )}

                    <div className="bg-[#0e0e0e] rounded-2xl p-5 border border-white/5 grid grid-cols-2 gap-4 divide-x divide-white/5">
                        <div className="flex flex-col gap-1">
                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Invitation Bonus</p>
                            <p className="text-xl font-black text-white tracking-tighter">${stats.directEarnings} <span className="text-[10px] text-[#444] uppercase">USDT</span></p>
                        </div>
                        <div className="flex flex-col gap-1 text-right pl-4">
                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Direct Partners</p>
                            <p className="text-xl font-black text-white tracking-tighter">{stats.totalTeamMembers} <span className="text-[10px] text-[#444] uppercase">Active</span></p>
                        </div>
                    </div>
                </div>

                {/* Referral Link */}
                <div className="bg-[#0c0c0c] rounded-3xl p-6 border border-white/5">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                             <span className="material-icons-round text-primary text-sm font-black">share</span>
                        </div>
                        <h3 className="text-xs font-black text-white uppercase tracking-widest">Global Invite Link</h3>
                    </div>
                    <div className="flex flex-col gap-3">
                        <div className="bg-black/80 p-4 rounded-xl border border-white/5 font-mono text-[10px] text-primary break-all overflow-hidden select-all lowercase leading-relaxed">
                            https://t.me/AiMiningBTC_bot?start={address}
                        </div>
                        <button 
                            onClick={handleCopyLink}
                            className="w-full bg-[#111] hover:bg-primary hover:text-black border border-primary/20 text-primary py-4 rounded-xl font-black uppercase text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow-neon"
                        >
                            <span className="material-icons-round text-sm font-black">content_copy</span>
                            Copy Network Link
                        </button>
                    </div>
                </div>

                {/* Network Levels Hierarchy */}
                <div className="space-y-4 pb-10">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                             <span className="w-1 h-3 bg-primary"></span>
                             Network Hierarchy
                        </h3>
                        <span className="text-[10px] text-gray-600 font-black uppercase tracking-tighter">ROI Based Yield</span>
                    </div>
                    
                    {[
                        { lv: 1, rate: '5%', desc: 'Direct Level Explorer' },
                        { lv: 2, rate: '3%', desc: 'Secondary Network' },
                        { lv: 3, rate: '2%', desc: 'Tertiary Volume' },
                        { lv: 4, rate: '1%', desc: 'Intermediate Tier', min: 1000 },
                        { lv: 5, rate: '1%', desc: 'Intermediate Tier', min: 1000 },
                        { lv: 6, rate: '1%', desc: 'Intermediate Tier', min: 1000 },
                        { lv: 7, rate: '1%', desc: 'Global Executive', min: 2000 },
                        { lv: 8, rate: '1%', desc: 'Global Executive', min: 2000 },
                        { lv: 9, rate: '1%', desc: 'Global Executive', min: 2000 },
                        { lv: 10, rate: '1%', desc: 'Diamond Master', min: 2000 },
                    ].map((item) => (
                        <div 
                            key={item.lv}
                            className={`p-4 rounded-2xl border transition-all duration-300 ${
                                stats.unlockedLevels >= item.lv 
                                ? 'bg-[#0f0f0f] border-primary/20' 
                                : 'bg-black/40 border-white/5 grayscale opacity-30 shadow-none'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs transition-all ${
                                        stats.unlockedLevels >= item.lv ? 'bg-primary text-black shadow-neon rotate-2' : 'bg-gray-900 text-gray-700'
                                    }`}>
                                        {item.lv}
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-black text-white uppercase tracking-tight leading-none mb-1">{item.desc}</p>
                                        {item.min && stats.unlockedLevels < item.lv ? (
                                            <p className="text-[8px] text-primary/80 font-black uppercase tracking-widest flex items-center gap-1">
                                                <span className="material-icons-round text-[10px] font-black">lock</span>
                                                Requires ${item.min} Own Stake
                                            </p>
                                        ) : (
                                            <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest flex items-center gap-1">
                                                <span className="material-icons-round text-[10px] text-green-500 font-black">sync_alt</span>
                                                Level {item.lv} Active
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`text-base font-black leading-none tracking-tighter ${stats.unlockedLevels >= item.lv ? 'text-primary' : 'text-gray-700'}`}>
                                        {item.rate}
                                    </p>
                                    <p className="text-[9px] text-gray-600 uppercase font-black tracking-tighter">Dividend</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
};

export default Team;
