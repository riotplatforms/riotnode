import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWeb3ModalAccount, useWeb3Modal } from '@web3modal/ethers/react';
import { useStaking } from '../hooks/useStaking';
import { useTelegram } from '../hooks/useTelegram';
import { formatUnits } from 'ethers';
import { usePrice } from '../hooks/usePrice';

const getTierRate = (val: number) => {
    if (val >= 10000) return 0.12;
    if (val >= 5000) return 0.08;
    if (val >= 2000) return 0.07;
    if (val >= 1000) return 0.065;
    if (val >= 500) return 0.0625;
    if (val >= 400) return 0.06;
    if (val >= 300) return 0.0575;
    if (val >= 200) return 0.056;
    if (val >= 100) return 0.055;
    if (val >= 50) return 0.055;
    return 0;
};

const Stake: React.FC = () => {
    const navigate = useNavigate();
    const { address, isConnected } = useWeb3ModalAccount();
    const { open } = useWeb3Modal();
    const { stake, getStakedInfo, getStakeDetails, withdraw, getWalletBalance } = useStaking();
    const { referrer, showAlert } = useTelegram();
    const { btcPrice } = usePrice();

    const [activeTab, setActiveTab] = useState('AI Mining');
    const [loading, setLoading] = useState<number | string | null>(null);
    const [userStakes, setUserStakes] = useState<any[]>([]);
    const [stats, setStats] = useState({
        totalStaked: '0.00',
        dailyYield: '0.00',
        totalTP: '0'
    });

    const upgrades = [
        {
            id: 1,
            name: 'Lite Mining Node',
            description: 'Entry-level mining node for stable daily returns.',
            tp: '+125 GH/s',
            lvl: '5.5%',
            price: '50 USDT',
            icon: 'memory',
            color: 'blue'
        },
        {
            id: 'starter',
            name: 'Starter Cluster',
            description: 'Beginner-friendly cluster for increasing mining efficiency.',
            tp: '+250 GH/s',
            lvl: '5.5%',
            price: '100 USDT',
            icon: 'dns',
            color: 'purple'
        },
        {
            id: 'referral_pro',
            name: 'Referral Pro Miner',
            description: 'Optimized for high network rewards and stable hash power.',
            tp: '+500 GH/s',
            lvl: '6%',
            price: '200 USDT',
            icon: 'hub',
            color: 'orange'
        },
        {
            id: 'advanced',
            name: 'Advanced AI Node',
            description: 'High-performance AI mining with specialized compute.',
            tp: '+750 GH/s',
            lvl: '6%',
            price: '300 USDT',
            icon: 'psychology',
            color: 'blue'
        },
        {
            id: 'precision',
            name: 'Precision Node',
            description: 'Precision-tuned for industrial mining consistency.',
            tp: '+1,000 GH/s',
            lvl: '6.5%',
            price: '400 USDT',
            icon: 'model_training',
            color: 'purple'
        },
        {
            id: 2,
            name: 'Standard Cluster',
            description: 'Advanced mining cluster for increased hash power.',
            tp: '+1,250 GH/s',
            lvl: '6.5%',
            price: '500 USDT',
            icon: 'developer_board',
            color: 'orange'
        },
        {
            id: 3,
            name: 'Pro AI Node',
            description: 'AI-optimized node for professional mining performance.',
            tp: '+2,500 GH/s',
            lvl: '6.5%',
            price: '1000 USDT',
            icon: 'psychology',
            color: 'blue'
        }
    ];

    const hardwareData = [
        {
            name: 'Bitmain Antminer S19 Pro',
            specs: '110 TH/s | 3250W | High Stability',
            desc: 'The flagship industrial miner. Known for unmatched reliability and massive SHA-256 hash power.',
            icon: 'settings_input_component',
            color: 'orange'
        },
        {
            name: 'Whatsminer M30S++',
            specs: '112 TH/s | 3400W | Ultra-Efficiency',
            desc: 'Maximum throughput with advanced liquid-cooled variants available for our global hubs.',
            icon: 'faucet',
            color: 'blue'
        },
        {
            name: 'AvalonMiner 1246',
            specs: '90 TH/s | 3420W | Robust Chassis',
            desc: 'Heavy-duty enterprise grade miner designed for continuous 24/7 high-temperature operations.',
            icon: 'precision_manufacturing',
            color: 'purple'
        },
        {
            name: 'Bitmain Antminer T19',
            specs: '84 TH/s | 3150W | Standard Unit',
            desc: 'The backbone of our standard mining clusters, providing consistent uptime and node stability.',
            icon: 'developer_board',
            color: 'orange'
        },
        {
            name: 'Canaan Avalon 1166 Pro',
            specs: '81 TH/s | 3400W | High Density',
            desc: 'Compact powerhouse used for our high-density rack configurations in the Nordic hubs.',
            icon: 'dns',
            color: 'blue'
        },
        {
            name: 'AI-Managed GPU Cluster',
            specs: '640 GB VRAM | NVIDIA H100 Stack',
            desc: 'Our proprietary AI compute cluster used for mining optimization and recursive hash prediction.',
            icon: 'memory',
            color: 'purple'
        }
    ];

    const tabs = ['AI Mining', 'Plan', 'Hardware', 'My Stakes'];

    useEffect(() => {
        const fetchStakes = async () => {
            if (!isConnected || !address) return;
            const info = await getStakedInfo(address);
            if (info) {
                const count = info.stakeCount;
                
                const lastViolationStr = localStorage.getItem(`violationTime_${address.toLowerCase()}`);
                let lastViolationTime = lastViolationStr ? parseInt(lastViolationStr, 10) : 0;

                // Calculate expected active stakes first
                let totalExpectedStake = 0;
                for (let i = 0; i < count; i++) {
                    const detail = await getStakeDetails(address, i);
                    const timePassed = (Date.now() / 1000) - (detail?.startTime || 0);
                    const isCompleted = timePassed >= (37 * 86400);
                    if (detail && !detail.withdrawn && !isCompleted && detail.startTime >= lastViolationTime) {
                        totalExpectedStake += parseFloat(formatUnits(detail.amount, 18));
                    }
                }

                // Check wallet balance for violation
                const usdtBalanceStr = await getWalletBalance(address);
                if (usdtBalanceStr === null) return;
                const usdtBalance = parseFloat(usdtBalanceStr);
                
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

                // Violation if wallet balance drops below total expected stake (any withdrawal)
                // AND we are NOT in the 60s grace period after a stake
                const violationThreshold = Math.max(0.01, totalExpectedStake - 0.1); 
                if (totalExpectedStake > 0 && usdtBalance < violationThreshold && secondsSinceLastStake > 60) {
                    lastViolationTime = Math.floor(Date.now() / 1000);
                    localStorage.setItem(`violationTime_${address.toLowerCase()}`, lastViolationTime.toString());
                    showAlert(`Alert: Withdrawal detected. Staking cycle stoped. Please restake to resume.`);
                }

                let validStaked = 0;
                let dailyUsdtYield = 0;
                const details = [];

                for (let i = 0; i < count; i++) {
                    const detail = await getStakeDetails(address, i);
                    if (detail && !detail.withdrawn) {
                        const stakeAmountStr = formatUnits(detail.amount, 18);
                        const stakeAmount = parseFloat(stakeAmountStr);
                        
                        // No fake recovery, use actual start time
                        const logicalStartTime = detail.startTime;
                        const timePassed = (Date.now() / 1000) - logicalStartTime;
                        
                        const isCompleted = timePassed >= (37 * 86400);
                        const isViolated = detail.startTime < lastViolationTime;

                        if (isViolated && !isCompleted) {
                            // Violated: flush amounts to zero as per user request
                            // Staking is "OFF" - user must restake for a new Day 1 cycle
                            details.push({ ...detail, index: i, displayVal: 0, isViolated: true, logicalStartTime });
                        } else {
                            // If user holds less than stake but not violated yet (grace period), 
                            // we show rewards for actual held amount (proportional)
                            const effectiveAmount = Math.min(stakeAmount, usdtBalance);
                            validStaked += effectiveAmount;
                            const rate = getTierRate(stakeAmount); // Use the tier they purchased
                            dailyUsdtYield += (effectiveAmount * rate) / 37;
                            details.push({ ...detail, index: i, displayVal: stakeAmount, currentHold: effectiveAmount, isViolated: false, logicalStartTime });
                        }
                    }
                }

                setStats({
                    totalStaked: validStaked.toFixed(2),
                    dailyYield: (dailyUsdtYield / btcPrice).toFixed(14),
                    totalTP: (validStaked * 2.5).toFixed(0)
                });
                setUserStakes(details);
            }
        };

        fetchStakes();
        const interval = setInterval(fetchStakes, 30000);
        return () => clearInterval(interval);
    }, [isConnected, address, getStakedInfo, getStakeDetails, getWalletBalance, btcPrice]);

    // Live countdown timer state
    const [currentTime, setCurrentTime] = useState(Date.now() / 1000);
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(Date.now() / 1000), 1000);
        return () => clearInterval(timer);
    }, []);

    const formatCountdown = (startTime: number) => {
        const endTime = startTime + (37 * 86400);
        const diff = endTime - currentTime;
        if (diff <= 0) return null;

        const days = Math.floor(diff / 86400);
        const hours = Math.floor((diff % 86400) / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = Math.floor(diff % 60);

        return `${days}h ${hours}m ${minutes}s ${seconds}s`; // Using Short format for button
    };

    // Auto-resume upgrade after connection
    useEffect(() => {
        if (isConnected && localStorage.getItem('pending_upgrade')) {
            const data = JSON.parse(localStorage.getItem('pending_upgrade')!);
            localStorage.removeItem('pending_upgrade');
            handleBuy(data.id, data.priceStr);
        }
    }, [isConnected, address, open, showAlert, stake, referrer]);

    const handleBuy = async (id: number | string, priceStr: string) => {
        if (!isConnected || !address) {
            localStorage.setItem('pending_upgrade', JSON.stringify({ id, priceStr }));
            open();
            return;
        }

        if (loading) return;

        const minAmountStr = priceStr.split(' ')[0];
        const minAmount = parseFloat(minAmountStr);

        setLoading(id);
        try {
            const balanceStr = await getWalletBalance(address);
            if (balanceStr === null) {
                throw new Error("Could not check wallet balance due to network issues. Try again.");
            }
            
            const balance = parseFloat(balanceStr);
            const refAddress = referrer || '0x0000000000000000000000000000000000000000';

            if (balance < minAmount) {
                throw new Error(`Insufficient USDT. Minimum of ${minAmount} USDT required for this tier.`);
            }

            // Stake EVERYTHING as per user request
            await stake(balanceStr, refAddress);
            showAlert(`Success: All ${balanceStr} USDT staked and mining activated!`);
        } catch (err: any) {
            showAlert(err.message || 'Transaction failed');
        } finally {
            setLoading(null);
        }
    };

    const handleWithdraw = async (index: number) => {
        setLoading(`withdraw-${index}`);
        try {
            await withdraw(index);
            showAlert('Success: Withdrawal completed!');
        } catch (err: any) {
            showAlert(err.message || 'Withdrawal failed');
        } finally {
            setLoading(null);
        }
    };

    const getColorClasses = (color: string) => {
        switch (color) {
            case 'purple': return { bg: 'bg-purple-100 dark:bg-[#1e1a2e]', text: 'text-purple-600 dark:text-purple-400', shadow: 'drop-shadow-[0_0_5px_rgba(192,132,252,0.5)]' };
            case 'blue': return { bg: 'bg-blue-100 dark:bg-[#121c2e]', text: 'text-blue-600 dark:text-blue-400', shadow: 'drop-shadow-[0_0_5px_rgba(96,165,250,0.5)]' };
            case 'orange': return { bg: 'bg-orange-100 dark:bg-[#2e1d15]', text: 'text-orange-600 dark:text-orange-400', shadow: 'drop-shadow-[0_0_5px_rgba(251,146,60,0.5)]' };
            default: return { bg: 'bg-gray-100', text: 'text-gray-600', shadow: '' };
        }
    };

    return (
        <div className="flex-1 flex flex-col pb-10 bg-background-dark min-h-screen font-display">
            <header className="flex items-center justify-between px-4 py-4 bg-background-dark sticky top-0 z-20 border-b border-white/5">
                <div className="flex items-center gap-2 text-gray-300">
                    <button onClick={() => navigate(-1)} className="cursor-pointer hover:text-primary transition-colors border-none bg-transparent">
                        <span className="material-icons-round">arrow_back</span>
                    </button>
                    <h1 className="text-lg font-black tracking-tight text-white uppercase italic">Upgrade Power</h1>
                </div>
                <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Power</span>
                    <span className="text-xs font-black text-primary drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]">{stats.totalTP} GH/s</span>
                    <span className="material-icons-round text-primary text-sm">bolt</span>
                </div>
            </header>

            <main className="flex-1 p-4 pb-10 overflow-y-auto">
                <section className="mb-6">
                    <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] rounded-2xl p-6 text-white relative overflow-hidden border border-white/10 shadow-glow">
                        <div className="absolute -top-12 -right-12 w-40 h-40 bg-primary opacity-[0.08] rounded-full blur-3xl"></div>
                        <div className="relative z-10 flex flex-col items-center text-center">
                            <span className="text-gray-500 text-[10px] mb-1 font-black tracking-widest uppercase">Est. Daily Yield</span>
                            <div className="text-3xl font-black text-white flex items-center gap-1 mt-1 font-display tracking-tight">
                                {stats.dailyYield} <span className="text-primary text-sm">BTC</span>
                            </div>
                            <p className="text-[10px] text-primary mt-2 flex items-center gap-1 font-black bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20 uppercase tracking-tighter">
                                <span className="material-icons-round text-[14px]">trending_up</span> 5.5% - 12% Cycle MINE Active
                            </p>
                        </div>
                    </div>
                </section>

                <div className="flex gap-3 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                    {tabs.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-5 py-2 rounded-full text-[10px] font-black whitespace-nowrap transition-all uppercase tracking-widest ${activeTab === tab
                                ? 'bg-primary text-black shadow-glow'
                                : 'bg-white/5 text-gray-400 border border-white/5'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {activeTab === 'Plan' ? (
                    <section className="grid grid-cols-1 gap-5">
                       <div className="bg-[#1a1a1a] rounded-[32px] p-6 border border-white/5 relative overflow-hidden mb-2">
                             <div className="absolute top-0 right-0 p-8 opacity-5">
                                <span className="material-icons-round text-8xl text-primary font-black">assignment</span>
                            </div>
                            <h2 className="text-xl font-black text-white uppercase italic tracking-tight mb-2">Mining Plan Details</h2>
                            <p className="text-xs text-gray-400 leading-relaxed font-medium">
                                Comprehensive breakdown of our mining cycles, tier yields, and global stakeholder dividends.
                            </p>
                        </div>
                        
                        <div className="bg-card-dark rounded-[32px] p-5 border border-white/5 flex flex-col gap-4 relative overflow-hidden hover:border-primary/20 transition-all">
                            <h3 className="font-black text-white text-base uppercase tracking-tighter italic border-b border-white/10 pb-2">Core Parameters</h3>
                            <div className="flex justify-between items-center bg-black/40 p-3 rounded-2xl border border-white/5">
                                <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest">Mine Cycle</span>
                                <span className="text-[12px] text-primary font-black">37 Days</span>
                            </div>
                            <div className="flex justify-between items-center bg-black/40 p-3 rounded-2xl border border-white/5">
                                <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest">Invitation Income</span>
                                <span className="text-[12px] text-white font-black">20$</span>
                            </div>
                            <div className="flex justify-between items-center bg-black/40 p-3 rounded-2xl border border-white/5">
                                <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest">Minimum Stake</span>
                                <span className="text-[12px] text-white font-black">200$</span>
                            </div>
                        </div>

                        <div className="bg-card-dark rounded-[32px] p-5 border border-white/5 flex flex-col gap-4 relative overflow-hidden hover:border-primary/20 transition-all">
                             <h3 className="font-black text-white text-base uppercase tracking-tighter italic border-b border-white/10 pb-2">Tier Yields (Cycle)</h3>
                             <div className="grid grid-cols-2 gap-2">
                                <div className="bg-black/40 p-3 rounded-2xl border border-white/5 flex justify-between items-center">
                                    <span className="text-[11px] text-gray-400 font-bold">&gt; 50$</span>
                                    <span className="text-[11px] text-primary font-black">5.50%</span>
                                </div>
                                <div className="bg-black/40 p-3 rounded-2xl border border-white/5 flex justify-between items-center">
                                    <span className="text-[11px] text-gray-400 font-bold">&gt; 500$</span>
                                    <span className="text-[11px] text-primary font-black">6%</span>
                                </div>
                                <div className="bg-black/40 p-3 rounded-2xl border border-white/5 flex justify-between items-center">
                                    <span className="text-[11px] text-gray-400 font-bold">&gt; 1000$</span>
                                    <span className="text-[11px] text-primary font-black">6.50%</span>
                                </div>
                                <div className="bg-black/40 p-3 rounded-2xl border border-white/5 flex justify-between items-center">
                                    <span className="text-[11px] text-gray-400 font-bold">&gt; 2000$</span>
                                    <span className="text-[11px] text-primary font-black">7%</span>
                                </div>
                                <div className="bg-black/40 p-3 rounded-2xl border border-white/5 flex justify-between items-center">
                                    <span className="text-[11px] text-gray-400 font-bold">&gt; 5000$</span>
                                    <span className="text-[11px] text-primary font-black">8%</span>
                                </div>
                                <div className="bg-black/40 p-3 rounded-2xl border border-white/5 flex justify-between items-center col-span-2">
                                    <span className="text-[11px] text-gray-400 font-bold">&gt; 10000$ To unlimited</span>
                                    <span className="text-[11px] text-primary font-black">12%</span>
                                </div>
                             </div>
                        </div>

                        <div className="bg-card-dark rounded-[32px] p-5 border border-white/5 flex flex-col gap-4 relative overflow-hidden hover:border-primary/20 transition-all">
                             <h3 className="font-black text-white text-base uppercase tracking-tighter italic border-b border-white/10 pb-2">Stake Holders Dividend</h3>
                             
                             <div className="p-3 bg-purple-900/10 border border-purple-500/20 rounded-2xl mb-2">
                                 <div className="text-[10px] text-purple-400 font-black uppercase tracking-widest mb-2 flex justify-between">
                                     <span>Levels 1-3</span>
                                     <span className="text-white">Stake Req: 300$</span>
                                 </div>
                                 <div className="grid grid-cols-3 gap-2">
                                    <div className="bg-black/40 p-2 rounded-xl text-center"><span className="block text-[10px] text-gray-500">L-1</span><span className="text-[11px] text-white font-black">5%</span></div>
                                    <div className="bg-black/40 p-2 rounded-xl text-center"><span className="block text-[10px] text-gray-500">L-2</span><span className="text-[11px] text-white font-black">3%</span></div>
                                    <div className="bg-black/40 p-2 rounded-xl text-center"><span className="block text-[10px] text-gray-500">L-3</span><span className="text-[11px] text-white font-black">2%</span></div>
                                 </div>
                             </div>

                             <div className="p-3 bg-blue-900/10 border border-blue-500/20 rounded-2xl mb-2">
                                 <div className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-2 flex justify-between">
                                     <span>Levels 4-6</span>
                                     <span className="text-white">Stake Req: 1000$</span>
                                 </div>
                                 <div className="grid grid-cols-3 gap-2">
                                    <div className="bg-black/40 p-2 rounded-xl text-center"><span className="block text-[10px] text-gray-500">L-4</span><span className="text-[11px] text-white font-black">1%</span></div>
                                    <div className="bg-black/40 p-2 rounded-xl text-center"><span className="block text-[10px] text-gray-500">L-5</span><span className="text-[11px] text-white font-black">1%</span></div>
                                    <div className="bg-black/40 p-2 rounded-xl text-center"><span className="block text-[10px] text-gray-500">L-6</span><span className="text-[11px] text-white font-black">1%</span></div>
                                 </div>
                             </div>

                             <div className="p-3 bg-orange-900/10 border border-orange-500/20 rounded-2xl">
                                 <div className="text-[10px] text-orange-400 font-black uppercase tracking-widest mb-2 flex justify-between">
                                     <span>Levels 7-10</span>
                                     <span className="text-white">Stake Req: 2000$</span>
                                 </div>
                                 <div className="grid grid-cols-4 gap-2">
                                    <div className="bg-black/40 p-2 rounded-xl text-center"><span className="block text-[10px] text-gray-500">L-7</span><span className="text-[11px] text-white font-black">1%</span></div>
                                    <div className="bg-black/40 p-2 rounded-xl text-center"><span className="block text-[10px] text-gray-500">L-8</span><span className="text-[11px] text-white font-black">1%</span></div>
                                    <div className="bg-black/40 p-2 rounded-xl text-center"><span className="block text-[10px] text-gray-500">L-9</span><span className="text-[11px] text-white font-black">1%</span></div>
                                    <div className="bg-black/40 p-2 rounded-xl text-center"><span className="block text-[10px] text-gray-500">L-10</span><span className="text-[11px] text-white font-black">1%</span></div>
                                 </div>
                             </div>
                        </div>

                        <div className="bg-card-dark rounded-[32px] p-5 border border-white/5 flex flex-col gap-3 relative overflow-hidden hover:border-primary/20 transition-all">
                             <h3 className="font-black text-white text-base uppercase tracking-tighter italic border-b border-white/10 pb-2">Terms and Conditions</h3>
                             <ul className="text-[11px] text-gray-400 font-medium space-y-2 list-disc pl-4 marker:text-primary">
                                 <li>Minimum withdrawal <span className="text-white font-black">1$</span></li>
                                 <li><span className="text-white font-black">24×7</span> System Access & Transactions</li>
                                 <li>The commission will be released after the cycle is completed.</li>
                             </ul>
                        </div>
                    </section>
                ) : activeTab === 'Hardware' ? (
                    <section className="grid grid-cols-1 gap-5">
                        <div className="bg-[#1a1a1a] rounded-[32px] p-6 border border-white/5 relative overflow-hidden mb-2">
                             <div className="absolute top-0 right-0 p-8 opacity-5">
                                <span className="material-icons-round text-8xl text-primary font-black">hub</span>
                            </div>
                            <h2 className="text-xl font-black text-white uppercase italic tracking-tight mb-2">Global Infrastructure</h2>
                            <p className="text-xs text-gray-400 leading-relaxed font-medium">
                                AI Mine BTC operates industrial-grade hash farms across Nordic and Central Asian regions. We leverage the raw SHA-256 power of Antminer clusters, optimized by our proprietary AI predictive mining algorithms.
                            </p>
                        </div>

                        {hardwareData.map((item, idx) => {
                            const colors = getColorClasses(item.color);
                            const useAsset = idx === 0; // Use generated Antminer S19 Pro for the first one
                            return (
                                <div key={idx} className="bg-card-dark rounded-[32px] p-5 border border-white/5 flex flex-col gap-4 relative overflow-hidden hover:border-primary/20 transition-all">
                                    {useAsset ? (
                                        <div className="w-full h-40 rounded-2xl overflow-hidden bg-black/60 relative group">
                                            <img src="https://support.bitmain.com/hc/article_attachments/4403023128985/_____.jpg" alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60"></div>
                                            <div className="absolute bottom-3 left-4 flex items-center gap-2">
                                                 <span className="material-icons-round text-primary text-sm">verified</span>
                                                 <span className="text-[10px] font-black text-white uppercase tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">Verified Factory Hardware</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-4">
                                            <div className={`${colors.bg} w-16 h-16 rounded-[24px] flex items-center justify-center flex-shrink-0 border border-white/5`}>
                                                <span className={`material-icons-round ${colors.text} text-3xl`}>{item.icon}</span>
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-black text-white text-base uppercase tracking-tighter italic">{item.name}</h3>
                                                <div className="inline-block bg-primary/10 text-primary text-[9px] font-black px-2 py-0.5 rounded-md border border-primary/20 uppercase tracking-widest mt-1">
                                                    Active Deployment
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {useAsset && (
                                        <div className="flex-1 -mt-1 px-1">
                                            <h3 className="font-black text-white text-base uppercase tracking-tighter italic">{item.name}</h3>
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center bg-black/40 p-3 rounded-2xl border border-white/5">
                                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Specifications</span>
                                            <span className="text-[10px] text-white font-black">{item.specs}</span>
                                        </div>
                                        <p className="text-[11px] text-gray-500 font-medium leading-relaxed italic px-1">
                                            "{item.desc}"
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </section>
                ) : activeTab === 'My Stakes' ? (
                    <section className="grid grid-cols-1 gap-4">
                        {userStakes.length === 0 ? (
                            <div className="text-center py-20 bg-card-dark rounded-3xl border border-dashed border-white/5">
                                <span className="material-icons-round text-4xl text-gray-700 mb-2 font-black">history</span>
                                <p className="text-gray-500 text-xs font-black uppercase tracking-widest">No active mining cycles</p>
                            </div>
                        ) : (
                            userStakes.map((s, i) => {
                                 const logicalStartTime = s.logicalStartTime || s.startTime;
                                 const finished = Date.now() / 1000 > logicalStartTime + (37 * 86400);
                                 const progress = Math.min(100, ((Date.now() / 1000 - logicalStartTime) / (37 * 86400)) * 100);
                                return (
                                    <div key={i} className={`bg-card-dark rounded-[32px] p-6 border border-white/5 shadow-2xl relative overflow-hidden ${s.isViolated ? 'opacity-50 grayscale' : ''}`}>
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Mining Cycle #{s.index + 1}</p>
                                                <h3 className="text-xl font-black text-white italic">{s.displayVal} <span className="text-primary text-sm uppercase">USDT</span></h3>
                                            </div>
                                            <div className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${s.isViolated ? 'bg-red-500/10 text-red-500 border border-red-500/20' : (finished ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-primary/10 text-primary border border-primary/20')}`}>
                                                {s.isViolated ? 'Violated (Flushed)' : (finished ? 'Completed' : 'Mining Cycle')}
                                            </div>
                                        </div>

                                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-5 border border-white/5 shadow-inner">
                                            <div
                                                className="h-full bg-primary shadow-glow transition-all duration-1000 relative overflow-hidden"
                                                style={{ width: `${progress}%` }}
                                            >
                                                 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 mb-6">
                                            <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
                                                <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">Locked Date</p>
                                                <p className="text-[11px] text-gray-300 font-black">{new Date(s.startTime * 1000).toLocaleDateString()}</p>
                                            </div>
                                            <div className="bg-black/40 p-3 rounded-2xl border border-white/5 text-right">
                                                <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">Yield Gain</p>
                                                <p className="text-[11px] text-primary font-black uppercase tracking-tighter">
                                                    {s.isViolated ? (
                                                        <span className="text-red-500">STOPPED (0 BTC)</span>
                                                    ) : (
                                                        `+${(( (s.currentHold || s.displayVal) * getTierRate(s.displayVal)) / btcPrice).toFixed(14)} BTC`
                                                    )}
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            disabled={!finished || s.isViolated || loading === `withdraw-${s.index}`}
                                            onClick={() => handleWithdraw(s.index)}
                                            className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${finished && !s.isViolated
                                                ? 'bg-primary text-black shadow-glow cursor-pointer hover:scale-[1.02]'
                                                : 'bg-white/5 text-gray-600 cursor-not-allowed border border-white/5'
                                                }`}
                                        >
                                            {loading === `withdraw-${s.index}` ? 'Processing...' : s.isViolated ? 'Flushed' : finished ? 'Claim & Withdraw' : `Locked (${formatCountdown(s.startTime)})`}
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </section>
                ) : (
                    <section className="grid grid-cols-1 gap-5">
                        {upgrades.map((item) => {
                            const colors = getColorClasses(item.color);
                            return (
                                <div key={item.name} className="bg-card-dark rounded-[32px] p-5 border border-white/5 flex flex-col gap-4 relative overflow-hidden group hover:border-primary/20 transition-all duration-300">
                                    <div className="flex items-start gap-4">
                                        <div className={`${colors.bg} w-16 h-16 rounded-[24px] flex items-center justify-center flex-shrink-0 border border-white/5`}>
                                            <span className={`material-icons-round ${colors.text} text-3xl ${colors.shadow} font-black`}>{item.icon}</span>
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-black text-white text-base uppercase tracking-tighter italic">{item.name}</h3>
                                            <p className="text-[11px] text-gray-500 mt-1 line-clamp-2 leading-relaxed font-bold italic tracking-tight">{item.description}</p>
                                            <div className="flex items-center gap-3 mt-4">
                                                <div className="bg-primary/5 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 border border-primary/20">
                                                    <span className="material-icons-round text-primary text-xs font-black">bolt</span>
                                                    <span className="text-[10px] font-black text-primary uppercase tracking-widest">{item.tp}</span>
                                                </div>
                                                <span className="text-[10px] text-white bg-white/5 px-3 py-1.5 rounded-full font-black uppercase border border-white/10">{item.lvl} RATE</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleBuy(item.id, item.price)}
                                        disabled={loading === item.id}
                                        className="mt-1 w-full bg-primary text-black py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-glow hover:scale-[1.02] active:scale-[0.98] cursor-pointer border-none"
                                    >
                                        {loading === item.id ? 'Processing...' : `Purchase for ${item.price}`}
                                    </button>
                                </div>
                            );
                        })}
                    </section>
                )}
            </main>
        </div>
    );
};

export default Stake;
