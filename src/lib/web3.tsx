import React from 'react'
import { createWeb3Modal, defaultConfig } from '@web3modal/ethers/react'

// 1. Get your Project ID from https://cloud.walletconnect.com (This is the "API" you need)
// 2. Add your website URL (domain) to the "Allowed Domains" list in the dashboard
const projectId = 'ec457184730a7f1e24bbe58a393f442b';

const bscMainnet = {
    chainId: 56,
    name: 'BNB Smart Chain',
    currency: 'BNB',
    explorerUrl: 'https://bscscan.com',
    rpcUrl: 'https://bsc-dataseed.binance.org/' // More stable official RPC
}

const metadata = {
    name: 'AI MINING BTC',
    description: 'Secure AI-powered Bitcoin Staking Platform.',
    url: 'https://riotnode.riotplatfroms.workers.dev/',
    icons: ['https://riotnode.riotplatfroms.workers.dev/logo.png'],
    redirect: {
        native: 'https://riotnode.riotplatfroms.workers.dev/',
        universal: 'https://riotnode.riotplatfroms.workers.dev/'
    }
}

export const ethersConfig = defaultConfig({
    metadata,
    rpcUrl: bscMainnet.rpcUrl,
    defaultChainId: bscMainnet.chainId,
    enableEIP6963: true,
    enableInjected: false, // Force WalletConnect in TMA
    enableCoinbase: false,
})

let initialized = false;

// Export and call immediately to ensure hooks have initialization
export function initWeb3() {
    if (initialized) return;
    initialized = true;

    createWeb3Modal({
        ethersConfig,
        chains: [bscMainnet],
        projectId,
        enableAnalytics: false,
        themeVariables: {
            '--w3m-z-index': 9999
        }
    })

    // Targeted TMA Handshake: Only redirect WalletConnect URIs
    const originalOpen = window.open;
    window.open = (url: any, target: any, features: any) => {
        const sUrl = String(url || '');
        if (sUrl.includes('wc:') || sUrl.includes('metamask.app.link') || sUrl.includes('link.trustwallet.com')) {
            const tg = (window as any).Telegram?.WebApp;
            if (tg && tg.openLink) {
                tg.openLink(sUrl);
                return null;
            }
        }
        return originalOpen.call(window, url, target, features);
    };
}

// Initialize provided via main.tsx explicitly to avoid race conditions
// initWeb3();

export function Web3Provider({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}
