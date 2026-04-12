import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTelegram } from '../hooks/useTelegram';

const Layout: React.FC<{ children: React.ReactNode, hideNav?: boolean }> = ({ children, hideNav }) => {
    const { tg } = useTelegram();

    const handleNav = () => {
        if (tg?.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('medium');
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const navItems = [
        { path: '/', label: 'Mining', icon: 'token' },
        { path: '/stake', label: 'Upgrade', icon: 'rocket_launch' },
        { path: '/team', label: 'Team', icon: 'hub' },
        { path: '/wallet', label: 'Wallet', icon: 'account_balance_wallet' }
    ];

    return (
        <div className="bg-[#050505] text-white font-body antialiased min-h-screen flex flex-col relative" style={{ minHeight: '100dvh' }}>
            {/* Background Orbs */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden opacity-30">
                <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary opacity-10 rounded-full blur-[100px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-primary/20 opacity-10 rounded-full blur-[100px]"></div>
            </div>

            <div className="flex-1 flex flex-col max-w-md mx-auto w-full relative z-10 pb-44">
                <main className="flex-1">
                    {children}
                </main>
            </div>

            {/* Floating Bottom Navigation */}
            {!hideNav && (
                <nav className="fixed bottom-8 left-4 right-4 z-50 bg-[#161616]/95 rounded-[32px] shadow-[0_8px_32px_rgba(0,0,0,0.8)] border border-white/10 px-6 py-3 flex justify-between items-center backdrop-blur-lg max-w-md mx-auto">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={handleNav}
                            end={item.path === '/'}
                            className={({ isActive }) =>
                                `flex flex-col items-center justify-center space-y-1 w-16 transition-all duration-300 border-none bg-transparent cursor-pointer ${isActive ? 'text-primary' : 'text-gray-500 hover:text-white'}`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <div className="relative">
                                        <span className={`material-icons-round text-2xl ${isActive ? 'drop-shadow-[0_0_8px_rgba(255,215,0,0.6)] scale-110' : ''}`}>
                                            {item.icon}
                                        </span>
                                        {isActive && (
                                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-8 h-8 bg-primary/10 rounded-full blur-lg"></div>
                                        )}
                                    </div>
                                    <span className={`text-[10px] font-black tracking-tight uppercase ${isActive ? 'opacity-100' : 'opacity-80'}`}>
                                        {item.label}
                                    </span>
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>
            )}
        </div>
    );
};

export default Layout;
