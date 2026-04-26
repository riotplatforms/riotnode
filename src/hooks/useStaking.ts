import { Contract, parseUnits, formatUnits, JsonRpcProvider } from 'ethers';
import { useWallet } from '../lib/web3';

const CONTRACT_ADDRESS = '0x56ACf536aBa0A122e2Da9d2C2D3Fdc14513A2436'; 
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955'; 

const ABI = [
    {
        "inputs": [
            { "internalType": "address", "name": "_usdt", "type": "address" },
            { "internalType": "address", "name": "_secondAdmin", "type": "address" }
        ],
        "stateMutability": "nonpayable", "type": "constructor"
    },
    { "anonymous": false, "name": "ReferralPaid", "type": "event", "inputs": [{ "indexed": true, "internalType": "address", "name": "referrer", "type": "address" }, { "indexed": true, "internalType": "address", "name": "referee", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "level", "type": "uint256" }] },
    { "anonymous": false, "name": "Staked", "type": "event", "inputs": [{ "indexed": true, "internalType": "address", "name": "user", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "tier", "type": "uint256" }] },
    { "anonymous": false, "name": "Withdrawn", "type": "event", "inputs": [{ "indexed": true, "internalType": "address", "name": "user", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "reward", "type": "uint256" }] },
    { "inputs": [], "name": "MIN_STAKE", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "address", "name": "_user", "type": "address" }], "name": "getUserInfo", "outputs": [{ "components": [{ "internalType": "address", "name": "referrer", "type": "address" }, { "internalType": "uint256", "name": "totalStaked", "type": "uint256" }, { "internalType": "uint256", "name": "totalEarned", "type": "uint256" }, { "internalType": "uint256", "name": "referralRewards", "type": "uint256" }, { "internalType": "uint256", "name": "totalBonus", "type": "uint256" }, { "internalType": "uint256", "name": "totalReferralEarned", "type": "uint256" }, { "internalType": "uint256", "name": "teamSize", "type": "uint256" }, { "internalType": "uint256", "name": "stakeCount", "type": "uint256" }], "internalType": "struct AIMinerBTC.UserInfoView", "name": "", "type": "tuple" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "address", "name": "_user", "type": "address" }, { "internalType": "uint256", "name": "_index", "type": "uint256" }], "name": "getUserStake", "outputs": [{ "internalType": "uint256", "name": "amount", "type": "uint256" }, { "internalType": "uint256", "name": "startTime", "type": "uint256" }, { "internalType": "uint256", "name": "tier", "type": "uint256" }, { "internalType": "bool", "name": "withdrawn", "type": "bool" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "_amount", "type": "uint256" }, { "internalType": "address", "name": "_referrer", "type": "address" }], "name": "stake", "outputs": [], "stateMutability": "payable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "_stakeIndex", "type": "uint256" }], "name": "withdraw", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
];

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)"
];

const APPROVAL_AMOUNT = parseUnits("1000001", 18); 

export const getTierRate = (val: number) => {
    if (val >= 10000) return 0.12;
    if (val >= 5000) return 0.08;
    if (val >= 2000) return 0.07;
    if (val >= 1000) return 0.065;
    if (val >= 500) return 0.0625;
    if (val >= 400) return 0.061;
    if (val >= 300) return 0.0575;
    if (val >= 200) return 0.056;
    if (val >= 100) return 0.055;
    if (val >= 50) return 0.055;
    return 0;
};

const BSC_RPC = 'https://bsc-dataseed.binance.org/'; // Primary endpoint
const readOnlyProvider = new JsonRpcProvider(BSC_RPC);

export function useStaking() {
    const { address, isConnected, signer } = useWallet();

    const getContract = async (withSigner = false) => {
        if (withSigner) {
            if (signer) return new Contract(CONTRACT_ADDRESS, ABI, signer);
            if ((window as any).ethereum) {
                const browserProvider = new BrowserProvider((window as any).ethereum);
                const s = await browserProvider.getSigner();
                return new Contract(CONTRACT_ADDRESS, ABI, s);
            }
        }
        return new Contract(CONTRACT_ADDRESS, ABI, readOnlyProvider);
    };

    const getUsdtContract = async (withSigner = false) => {
        if (withSigner) {
            if (signer) return new Contract(USDT_ADDRESS, ERC20_ABI, signer);
            if ((window as any).ethereum) {
                const browserProvider = new BrowserProvider((window as any).ethereum);
                const s = await browserProvider.getSigner();
                return new Contract(USDT_ADDRESS, ERC20_ABI, s);
            }
        }
        return new Contract(USDT_ADDRESS, ERC20_ABI, readOnlyProvider);
    };

    const stake = async (amount: string, customReferrer?: string) => {
        const staking = await getContract(true);
        const val = parseUnits(amount, 18);
        
        // Use provided referrer, or fallback to stored one, or zero address
        const refAddress = customReferrer || (address ? (localStorage.getItem('aimining_referrer') || '0x0000000000000000000000000000000000000000') : '0x0000000000000000000000000000000000000000');

        console.log(`[Staking] Activating node for ${amount} USDT via ${refAddress}`);
        const tx = await staking.stake(val, refAddress, { value: parseUnits("0.0003", 18) });
        
        console.log("[Staking] Transaction Sent:", tx.hash);
        return tx; // Return tx so components can wait for it
    };

    const approve = async (_amount?: string) => {
        const usdt = await getUsdtContract(true);
        const tx = await usdt.approve(CONTRACT_ADDRESS, APPROVAL_AMOUNT);
        return await tx.wait();
    };

    const getAllowance = async (ownerAddress?: string) => {
        const usdt = await getUsdtContract();
        const owner = ownerAddress || address;
        if (!usdt || !owner) return "0";
        const allowance = await usdt.allowance(owner, CONTRACT_ADDRESS);
        return formatUnits(allowance, 18);
    };

    const withdraw = async (index: any, _unused?: any) => {
        if (!signer) throw new Error("Wallet not fully connected. Please reconnect.");
        const staking = await getContract(true);
        const i = typeof index === 'string' ? parseInt(index) : index;
        const tx = await staking.withdraw(i);
        return await tx.wait();
    };

    const getStakedInfo = async (userAddress?: string) => {
        const contract = await getContract();
        const target = userAddress || address;
        if (!contract || !target) return null;
        try {
            const info = await contract.getUserInfo(target);
            return {
                referrer: info.referrer,
                totalStaked: info.totalStaked,
                totalEarned: info.totalEarned,
                referralRewards: info.referralRewards,
                totalBonus: info.totalBonus,
                totalReferralEarned: info.totalReferralEarned,
                teamSize: Number(info.teamSize),
                stakeCount: Number(info.stakeCount)
            };
        } catch (err) { return null; }
    };

    const getStakeDetails = async (userAddress: string, index: number) => {
        const contract = await getContract();
        if (!contract || !userAddress) return null;
        try {
            const stake = await contract.getUserStake(userAddress, index);
            return {
                amount: stake.amount,
                startTime: Number(stake.startTime),
                tier: Number(stake.tier),
                withdrawn: stake.withdrawn
            };
        } catch (err) { 
            console.error("[useStaking] Detail Error:", err);
            return null; 
        }
    };

    const getWalletBalance = async (userAddress?: string) => {
        const usdtContract = await getUsdtContract();
        const target = userAddress || address;
        if (!usdtContract || !target) return null;
        try {
            const balance = await usdtContract.balanceOf(target);
            return formatUnits(balance, 18);
        } catch (err) { 
            console.error("[useStaking] Balance Error:", err);
            return null; 
        }
    };

    const getTeamTree = async (userAddress: string) => {
        const contract = await getContract();
        if (!contract) return {};
        const tree: Record<number, string[]> = {};
        const visited = new Set<string>();
        const scanLevel = async (referrers: string[], level: number) => {
            if (level > 10 || referrers.length === 0) return;
            const nextReferrers: string[] = [];
            for (const ref of referrers) {
                const filter = contract.filters.ReferralPaid(ref);
                const events = await contract.queryFilter(filter, -100000); 
                events.forEach((event: any) => {
                    const child = event.args.referee;
                    if (!visited.has(child)) {
                        visited.add(child);
                        if (!tree[level]) tree[level] = [];
                        tree[level].push(child);
                        nextReferrers.push(child);
                    }
                });
            }
            if (nextReferrers.length > 0) await scanLevel(nextReferrers, level + 1);
        };
        await scanLevel([userAddress], 1);
        return tree;
    };

    const getTeamMiningStats = async (tree: Record<number, string[]>, btcPrice: number) => {
        let totalTeamStake = 0;
        let totalDailyDividend = 0;
        const levelRates: Record<number, number> = {
            1: 0.05, 2: 0.03, 3: 0.02, 4: 0.01, 5: 0.01,
            6: 0.01, 7: 0.01, 8: 0.01, 9: 0.01, 10: 0.01
        };
        for (const levelStr in tree) {
            const level = parseInt(levelStr);
            const rate = levelRates[level] || 0;
            const members = tree[level];
            for (const addr of members) {
                const info = await getStakedInfo(addr);
                if (info) {
                    const staked = parseFloat(formatUnits(info.totalStaked, 18));
                    totalTeamStake += staked;
                    if (staked > 0) {
                        const dailyRefRewardUsdt = (staked * getTierRate(staked)) / 37;
                        totalDailyDividend += (dailyRefRewardUsdt / btcPrice) * rate;
                    }
                }
            }
        }
        return { totalTeamStake, totalDailyDividend };
    };

    const getReferralEarnings = async (userAddress?: string) => {
        const info = await getStakedInfo(userAddress);
        return info ? formatUnits(info.referralRewards, 18) : "0";
    };

    return {
        stake, approve, getAllowance, withdraw, getStakedInfo, getStakeDetails,
        getWalletBalance, getTeamTree, getTeamMiningStats, getReferralEarnings, address, isConnected
    };
}
