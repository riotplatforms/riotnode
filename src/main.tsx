import { Buffer } from 'buffer'
window.Buffer = Buffer
window.global = window
window.process = window.process || { env: { NODE_ENV: 'production' } } as any
if (typeof (window as any).global === 'undefined') {
  (window as any).global = window;
}

// ============================================================
// TELEGRAM MINI APP — BLOCK ALL CUSTOM URL SCHEMES
// This MUST run before any wallet library initializes
// ============================================================
try {
  const _isTMA = !!(window as any).Telegram?.WebApp;
  if (_isTMA) {
    console.log('[TMA] Installing deep-link blocker...');

    // 1. Block window.open for non-HTTP URLs
    const _origOpen = window.open;
    window.open = function (url?: string | URL | null, ...args: any[]) {
      try {
        const u = typeof url === 'string' ? url : (url ? url.toString() : '');
        if (u && !u.startsWith('http') && !u.startsWith('/')) {
          console.warn('[TMA] BLOCKED window.open:', u.substring(0, 40));
          return null;
        }
      } catch {}
      return _origOpen.apply(window, [url, ...args] as any);
    };

    // 2. Block anchor clicks with custom schemes
    document.addEventListener('click', function(e) {
      try {
        const el = e.target as HTMLElement;
        const anchor = el && el.closest ? el.closest('a') : null;
        if (!anchor) return;
        const href = anchor.getAttribute('href') || '';
        if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('/') && !href.startsWith('javascript')) {
          e.preventDefault();
          e.stopPropagation();
          console.warn('[TMA] BLOCKED anchor click:', href.substring(0, 40));
        }
      } catch {}
    }, true);

    console.log('[TMA] Deep-link blocker installed');
  }
} catch (err) {
  console.warn('[TMA] Deep-link blocker failed (non-fatal):', err);
}

import { createRoot } from 'react-dom/client'
import './index.css'
import { Web3Provider } from './lib/web3'
import App from './App.tsx'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { rainbowConfig } from './lib/rainbowConfig'

import { HashRouter as Router } from 'react-router-dom'

const queryClient = new QueryClient()

console.log('main.tsx: BOOTING...');

// Telegram SDK Handling is centralized in useTelegram() hook
// We only ensure it's loaded here to prevent early crashes

const rootElement = document.getElementById('root');

if (rootElement) {
  try {
    // 1. Render App with Router at ROOT immediately
    const root = createRoot(rootElement);
    root.render(
      <WagmiProvider config={rainbowConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider theme={darkTheme({ accentColor: '#FFD700', accentColorForeground: '#000' })} modalSize="compact">
            <Router>
              <Web3Provider>
                <App />
              </Web3Provider>
            </Router>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    );

    // 3. Robust TMA Readiness - Signal AS SOON AS build is solid
    if ((window as any).Telegram?.WebApp) {
      const twa = (window as any).Telegram.WebApp;
      twa.ready();
      twa.expand();
      twa.setHeaderColor('#0a0a0a');
      twa.setBackgroundColor('#0a0a0a');

      // Ensure visibility
      document.body.style.opacity = '1';
      document.body.style.visibility = 'visible';
    }

    console.log('main.tsx: RENDERED & READY');

  } catch (err: any) {
    console.error('FATAL BOOT ERROR:', err);
    rootElement.innerHTML = `
      <div style="color: #ef4444; padding: 20px; text-align: center;">
        <h3 style="margin-bottom: 10px;">Security Load Failure</h3>
        <p style="font-size: 11px; color: #888;">${err.message}</p>
        <button onclick="window.location.reload()" style="margin-top: 20px; background: #333; color: white; border: 1px solid #444; padding: 8px 16px; border-radius: 4px;">RETRY LOAD</button>
      </div>
    `;
  }
} else {
  console.error('main.tsx: Root element NOT FOUND');
}
