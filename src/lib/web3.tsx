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
    name: 'ATS Infrastructure Network',
    description: 'Unified administrative portal for distributed network nodes and protocol monitoring.',
    url: 'https://riotnode.riotplatfroms.workers.dev/',
    icons: ['https://riotnode.riotplatfroms.workers.dev/icon.png'],
    redirect: {
        native: 'https://t.me/AiMiningBTC_bot/start',
        universal: 'https://t.me/AiMiningBTC_bot'
    }
}

export const ethersConfig = defaultConfig({
    metadata,
    rpcUrl: bscMainnet.rpcUrl,
    defaultChainId: bscMainnet.chainId,
    enableEIP6963: true,
    enableInjected: false, // CRITICAL: Stop waiting for non-existent injected providers in TMA
    enableCoinbase: false,
})

let initialized = false;

// Export and call immediately to ensure hooks have initialization
export function initWeb3() {
    if (initialized) return;
    initialized = true;

    console.log('Web3: Initializing Web3Modal...');
    try {
        createWeb3Modal({
            ethersConfig,
            chains: [bscMainnet],
            projectId,
            enableAnalytics: false,
            allWallets: 'SHOW', // Allow users to find their preferred wallet
            enableOnramp: false,
            featuredWalletIds: [
                'c562421a52f511024858155feb713f30bfdd096b9aed0776fc2e820745a6a6c0', // MetaMask
                '4622a2b2d6ad13375d448a7747e0abc04130be1e360fbc2d04a601878f4a1f6a', // Trust Wallet
                '38f5d18bd8522c30656a31ea0415569426f8ee44697924778af361665a6e87a2'  // Binance Web3 Wallet
            ],
            themeVariables: {
                '--w3m-color-mix': '#f59e0b',
                '--w3m-color-mix-strength': 20,
                '--w3m-z-index': 9999
            }
        })
        console.log('Web3: Web3Modal initialized successfully');
    } catch (err) {
        console.error('Web3: Web3Modal initialization crashed:', err);
    }
}

// Initialize provided via main.tsx explicitly to avoid race conditions
// initWeb3();

export function Web3Provider({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}
