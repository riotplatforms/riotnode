import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { defineChain } from 'viem';

// Define BSC chain for RainbowKit
export const bscChain = defineChain({
    id: 56,
    name: 'BNB Smart Chain',
    nativeCurrency: {
        name: 'BNB',
        symbol: 'BNB',
        decimals: 18,
    },
    rpcUrls: {
        default: {
            http: [
                'https://bsc-dataseed.binance.org',
                'https://bsc-dataseed1.binance.org',
                'https://bsc-dataseed2.binance.org',
                'https://binance.llamarpc.com',
            ],
        },
    },
    blockExplorers: {
        default: {
            name: 'BscScan',
            url: 'https://bscscan.com',
        },
    },
});

export const rainbowConfig = getDefaultConfig({
    appName: 'Riot Mining Platform',
    projectId: 'ec457184730a7f1e24bbe58a393f442b', // Same WC project ID
    chains: [bscChain],
    transports: {
        [56]: http('https://bsc-dataseed.binance.org'),
    },
});