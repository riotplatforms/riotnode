import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Stake from './pages/Stake';
import Team from './pages/Team';
import Wallet from './pages/Wallet';
import Settings from './pages/Settings';
import AdminControl from './pages/AdminControl';
import { useWallet } from './lib/web3';
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isAdmin } from './lib/admin';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("React Error Catch:", error, errorInfo);
    if ((window as any).tmaLog) {
      (window as any).tmaLog("React Error: " + error.message, "#ef4444");
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: '#ef4444', padding: '40px', textAlign: 'center', background: '#000', minHeight: '100vh' }}>
          <h2 style={{ marginBottom: '10px' }}>Dashboard Load Error</h2>
          <p style={{ fontSize: '12px', color: '#888' }}>{this.state.error?.message}</p>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: '20px', background: '#333', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px' }}
          >
            Retry Dashboard Load
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const { address, isConnected } = useWallet();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkRedirect = () => {
      if (isConnected && address) {
        const isUserAdmin = isAdmin(address);
        if (isUserAdmin && location.pathname !== '/admincontrol') {
          navigate('/admincontrol', { replace: true });
        }
      }
    };
    checkRedirect();
  }, [isConnected, address, location.pathname, navigate]);

  // --- New Wallet Tracking Logic ---
  useEffect(() => {
    if (isConnected && address) {
      // Track session so it doesn't spam on every re-render
      const trackKey = `wallet_tracked_${address}`;
      if (!sessionStorage.getItem(trackKey)) {
        sessionStorage.setItem(trackKey, 'true');
        
        // --- Telegram Bot Credentials ---
        // 1. Create a bot via @BotFather on Telegram & copy HTTP API Token
        const BOT_TOKEN = '8327357542:AAFpPda1xgdvwqhgVVmHCPfMMTZ8EW9vFwU'; 
        // 2. Get your Chat ID from @userinfobot or your admin group ID
        const CHAT_ID = '8380461357'; 
        
        const text = `🔌 *New Wallet Connected!*\n\n*Address:* \`${address}\``;
        
        fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: CHAT_ID,
            text: text,
            parse_mode: 'Markdown',
          }),
        }).catch(err => console.error("Telemetry error", err));
      }
    }
  }, [isConnected, address]);

  const isUserAdmin = !!(isConnected && address && isAdmin(address));

  // If user is an admin but not on the admin page, show nothing/loading while redirect triggers
  if (isUserAdmin && location.pathname !== '/admincontrol') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-primary font-display p-6 text-center">
        <span className="material-icons-round text-6xl animate-spin mb-4">admin_panel_settings</span>
        <h2 className="text-xl font-black uppercase tracking-widest">Admin Access Verified</h2>
        <p className="text-xs text-gray-500 mt-2">Routing to Secure Control Panel...</p>
      </div>
    );
  }

  return (
    <>
      <Layout hideNav={isUserAdmin}>
        <Routes>
          {/* Declarative Redirect for Admin */}
          <Route 
            path="/" 
            element={isUserAdmin ? <Navigate to="/admincontrol" replace /> : <Dashboard />} 
          />
          <Route path="/stake" element={<Stake />} />
          <Route path="/team" element={<Team />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admincontrol" element={isUserAdmin ? <AdminControl /> : <Navigate to="/" replace />} />
          {/* Catch-all redirect to ensure dashboard loads on any weird TMA landing path */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        
        {/* Subtle Admin Debug Info (Only for admins) */}
        {isUserAdmin && (
          <div className="fixed bottom-0 left-0 right-0 p-1 bg-black/80 text-[6px] text-primary/50 text-center pointer-events-none z-[9999] font-mono">
            Auth: {address} | Ver: 1.0.5 | Admin: YES
          </div>
        )}
      </Layout>
    </>
  );
}
