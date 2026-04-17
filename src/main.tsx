import { Buffer } from 'buffer'
window.Buffer = Buffer
window.global = window
window.process = window.process || { env: { NODE_ENV: 'production' } } as any
if (typeof (window as any).global === 'undefined') {
  (window as any).global = window;
}

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
