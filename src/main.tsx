import { Buffer } from 'buffer'
window.Buffer = Buffer
window.global = window
window.process = window.process || { env: { NODE_ENV: 'production' } } as any
if (typeof (window as any).global === 'undefined') {
  (window as any).global = window;
}

// --- TMA DEEP LINK SHIELD (v37) ---
// We must override window.open BEFORE any libraries load to catch all deep-link requests
(function () {
  const webapp = (window as any).Telegram?.WebApp;
  if (!webapp) return;

  // Signal readiness as early as possible
  webapp.ready();
  webapp.expand();

  // Navigation Guard: We track the last time the route changed
  // to prevent auto-sync calls from jumping out of the app
  let lastNavTime = 0;
  window.addEventListener('hashchange', () => {
    lastNavTime = Date.now();
    console.log('[TMA-Shield] Navigation Detected, Guard Active');
  });

  const originalOpen = window.open;
  window.open = function (url: string | URL | undefined, target?: string, features?: string) {
    const urlStr = url?.toString() || '';
    if (!urlStr) return originalOpen.call(window, url!, target!, features!);

    // Use /start to force Telegram to handle it as a deep-link entry point
    const botUrl = 'https://t.me/AiMiningBTC_bot/start';
    const isWalletLink = urlStr.startsWith('wc:') || urlStr.startsWith('metamask:');
    const timeSinceNav = Date.now() - lastNavTime;

    console.log('[TMA-Shield] Link Request:', urlStr, '| TimeSinceNav:', timeSinceNav);

    // GUARD: If a wallet link is triggered within 1 second of navigation,
    // it's likely an automatic library sync. We ignore it to prevent the popup loop.
    if (isWalletLink && timeSinceNav < 1000) {
      console.warn('[TMA-Shield] Nav Guard Blocked Auto-Sync Link:', urlStr);
      return { closed: false, focus: () => { }, close: () => { } };
    }

    // 1. Handle Wallet-Specific Schemes (Catches "Unknown URL Scheme" error)
    const bridges: Record<string, string> = {
      'metamask://': 'https://metamask.app.link/',
      'trust://': 'https://link.trustwallet.com/',
      'safepal://': 'https://link.safepal.io/',
      'tp://': 'https://tokenpocket.platform/',
      'bitkeep://': 'https://bkcode.vip/',
      'okx://': 'https://www.okx.com/download',
      'bnc://': 'https://app.binance.com/',
      'rainbow://': 'https://rnbwapp.com/',
      'phantom://': 'https://phantom.app/ul/'
    };

    // Check if it matches any known wallet scheme
    for (const [scheme, bridge] of Object.entries(bridges)) {
      if (urlStr.startsWith(scheme)) {
        let finalUrl = '';
        if (urlStr.includes('wc?uri=')) {
          const wcPart = encodeURIComponent(urlStr.split('wc?uri=')[1]);
          finalUrl = `${bridge}wc?uri=${wcPart}&redirectUrl=${encodeURIComponent(botUrl)}`;
        } else {
          const cleanPath = urlStr.replace(scheme, '');
          const joiner = bridge.endsWith('/') ? '' : '/';
          finalUrl = `${bridge}${joiner}${cleanPath}${urlStr.includes('?') ? '&' : '?'}redirectUrl=${encodeURIComponent(botUrl)}`;
        }

        console.log(`[TMA-Shield] Bridging ${scheme} -> ${finalUrl}`);
        webapp.openLink(finalUrl);
        return { closed: false, focus: () => { }, close: () => { } };
      }
    }

    // 2. Handle Generic WalletConnect (wc:) URIs
    if (urlStr.startsWith('wc:')) {
      const bridgeUrl = `https://metamask.app.link/wc?uri=${encodeURIComponent(urlStr)}&redirectUrl=${encodeURIComponent(botUrl)}`;
      console.log('[TMA-Shield] Bridging Generic WC ->', bridgeUrl);
      webapp.openLink(bridgeUrl);
      return { closed: false, focus: () => { }, close: () => { } };
    }

    // 3. Handle Other External links (must use openLink in TMA)
    if (urlStr.startsWith('http')) {
      webapp.openLink(urlStr);
      return { closed: false, focus: () => { }, close: () => { } };
    }

    return originalOpen.call(window, url!, target!, features!);
  } as any;
})();
// ---------------------------------
// ---------------------------------

import { createRoot } from 'react-dom/client'
import './index.css'
import { initWeb3 } from './lib/web3'
import App from './App.tsx'

import { HashRouter as Router } from 'react-router-dom'

console.log('main.tsx: BOOTING...');

// Telegram SDK Handling is centralized in useTelegram() hook
// We only ensure it's loaded here to prevent early crashes

const rootElement = document.getElementById('root');

if (rootElement) {
  try {
    // 1. Initialize Web3 immediately for hooks (MUST be synchronous)
    initWeb3();

    // 2. Render App with Router at ROOT immediately
    const root = createRoot(rootElement);
    root.render(
      <Router>
        <App />
      </Router>
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
