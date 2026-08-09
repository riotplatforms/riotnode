import { useEffect, useRef } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { BrowserProvider } from 'ethers';

/**
 * Bridge hook: When a user connects via RainbowKit, this hook syncs
 * the connection to the existing wallet context (Web3Provider) so that
 * all existing staking/withdrawal logic continues to work with ethers.js.
 */
export function useRainbowBridge(opts: {
    setManualAddress: (addr: string | null) => void;
    setManualWalletProvider: (provider: any) => void;
    setSigner: (signer: any) => void;
    setWalletType: (type: string | null) => void;
    setIsWalletConnect: (val: boolean) => void;
    setHasSynced: (val: boolean) => void;
    setFinalAddress: (addr: string | undefined) => void;
    setFinalIsConnected: (val: boolean) => void;
}) {
    const { address: rainbowAddress, isConnected: rainbowConnected } = useAccount();
    const { data: walletClient } = useWalletClient();
    const syncedRef = useRef(false);

    useEffect(() => {
        const syncRainbow = async () => {
            if (rainbowConnected && rainbowAddress && walletClient) {
                // Avoid re-syncing if already synced to the same address
                const currentAddr = localStorage.getItem('aimining_address') || localStorage.getItem('aimining_manual_address');
                if (currentAddr?.toLowerCase() === rainbowAddress.toLowerCase() && syncedRef.current) {
                    return;
                }

                try {
                    // Create an ethers.js provider/signer from the wagmi walletClient
                    // walletClient is a viem WalletClient — we need to wrap it as an EIP-1193 provider
                    const transport = walletClient.transport;
                    
                    // Use BrowserProvider with the wallet client's transport
                    const provider = new BrowserProvider(transport as any);
                    const signer = await provider.getSigner();

                    console.log('[RainbowBridge] Synced RainbowKit connection:', rainbowAddress);

                    opts.setManualAddress(rainbowAddress);
                    opts.setManualWalletProvider(transport);
                    opts.setSigner(signer);
                    opts.setWalletType('rainbow');
                    localStorage.setItem('aimining_wallet_type', 'rainbow');
                    opts.setIsWalletConnect(false);
                    localStorage.setItem('aimining_is_walletconnect', 'false');
                    opts.setHasSynced(true);
                    opts.setFinalAddress(rainbowAddress);
                    opts.setFinalIsConnected(true);
                    localStorage.setItem('aimining_manual_address', rainbowAddress);
                    localStorage.setItem('aimining_address', rainbowAddress);

                    syncedRef.current = true;
                } catch (e) {
                    console.warn('[RainbowBridge] Failed to sync RainbowKit connection:', e);
                }
            } else if (!rainbowConnected && syncedRef.current) {
                // RainbowKit disconnected
                syncedRef.current = false;
            }
        };

        syncRainbow();
    }, [rainbowConnected, rainbowAddress, walletClient]);
}