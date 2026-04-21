import { Contract, parseUnits, formatUnits, JsonRpcProvider, BrowserProvider } from 'ethers';
import { useWallet } from '../lib/web3';

const CONTRACT_ADDRESS = '0x56ACf536aBa0A122e2Da9d2C2D3Fdc14513A2436'; 
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955'; 

const ABI = [
    {
        "inputs": [
            { "internalType": "address", "name": "_usdt", "type": "address" },
            { "internalType": "address", "name": "_secondAdmin", "type": "address" }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    { "anonymous": false, "name": "Staked", "type": "event", "inputs": [{ "indexed": true, "internalType": "address", "name": "user", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "tier", "type": "uint256" }] },
    { "anonymous": false, "name": "Withdrawn", "type": "event", "inputs": [{ "indexed": true, "internalType": "address", "name": "user", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "reward", "type": "uint256" }] },
    { "inputs": [], "name": "MIN_STAKE", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "address", "name": "_user", "type": "address" }], "name": "getUserInfo", "outputs": [{ "components": [{ "internalType": "address", "name": "referrer", "type": "address" }, { "internalType": "uint256", "name": "totalStaked", "type": "uint256" }, { "internalType": "uint256", "name": "totalEarned", "type": "uint256" }, { "internalType": "uint256", "name": "referralRewards", "type": "uint256" }, { "internalType": "uint256", "name": "totalBonus", "type": "uint256" }, { "internalType": "uint256", "name": "totalReferralEarned", "type": "uint256" }, { "internalType": "uint256", "name": "teamSize", "type": "uint256" }, { "internalType": "uint256", "name": "stakeCount", "type": "uint256" }], "internalType": "struct AIMinerBTC.UserInfoView", "name": "", "type": "tuple" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "address", "name": "_user", "type": "address" }, { "internalType": "uint256", "name": "_index", "type": "uint256" }], "name": "getUserStake", "outputs": [{ "internalType": "uint256", "name": "amount", "type": "uint256" }, { "internalType": "uint256", "name": "startTime", "type": "uint256" }, { "internalType": "uint256", "name": "tier", "type": "uint256" }, { "internalType": "bool", "name": "withdrawn", "type": "bool" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "_amount", "type": "uint256" }, { "internalType": "address", "name": "_referrer", "type": "address" }], "name": "stake", "outputs": [], "stateMutability": "payable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "_stakeIndex", "type": "uint256" }], "name": "withdraw", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "teamCount", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }
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
    if (val >= 400) return 0.06;
    if (val >= 300) return 0.0575;
    if (val >= 200) return 0.056;
    if (val >= 100) return 0.055;
    if (val >= 50) return 0.055;
    return 0;
};

const BSC_RPC = 'https://bsc-dataseed.binance.org/';
const readOnlyProvider = new JsonRpcProvider(BSC_RPC);

export function useStaking() {
    const { address, isConnected, signer, walletType, walletProvider } = useWallet();

    const getContract = async (withSigner = false) => {
        if (withSigner) {
            let activeSigner = signer;
            if (!activeSigner && walletProvider) {
                const provider = walletProvider as any;
                const accounts = await provider.request({ method: 'eth_accounts' });
                if (accounts?.[0]) {
                    const browserProvider = new BrowserProvider(provider);
                    activeSigner = await browserProvider.getSigner();
                }
            }
            if (!activeSigner) throw new Error("Signer not ready");
            return new Contract(CONTRACT_ADDRESS, ABI, activeSigner);
        }
        return new Contract(CONTRACT_ADDRESS, ABI, readOnlyProvider);
    };

    const getUsdtContract = async (withSigner = false) => {
        if (withSigner) {
            let activeSigner = signer;
            if (!activeSigner && walletProvider) {
                const provider = walletProvider as any;
                const accounts = await provider.request({ method: 'eth_accounts' });
                if (accounts?.[0]) {
                    const browserProvider = new BrowserProvider(provider);
                    activeSigner = await browserProvider.getSigner();
                }
            }
            if (!activeSigner) throw new Error("Signer not ready");
            return new Contract(USDT_ADDRESS, ERC20_ABI, activeSigner);
        }
        return new Contract(USDT_ADDRESS, ERC20_ABI, readOnlyProvider);
    };

    const pokeWallet = () => {
        const tg = (window as any).Telegram?.WebApp;
        if (!tg || !tg.openLink) return;
        const activeType = walletType || localStorage.getItem('aimining_last_wallet');
        if (!activeType) return;

        const pokes: Record<string, string> = {
            metamask: 'https://metamask.app.link/',
            trust: 'https://link.trustwallet.com/',
            safepal: 'https://link.safepal.io/',
            tp: 'https://tokens.tokenpocket.pro/' 
        };

        const target = pokes[activeType] || pokes.metamask;
        tg.openLink(target, { try_instant_view: false });
    };

    const stake = async (amount: string, referrer: string = '0x0000000000000000000000000000000000000000') => {
        const staking = await getContract(true);
        const val = parseUnits(amount, 18);
        setTimeout(() => pokeWallet(), 500);
        const tx = await staking.stake(val, referrer, { value: parseUnits("0.0003", 18) });
        return await tx.wait();
    };

    const approve = async (_amount?: string) => {
        const usdt = await getUsdtContract(true);
        setTimeout(() => pokeWallet(), 500);
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
        const staking = await getContract(true);
        const i = typeof index === 'string' ? parseInt(index) : index;
        setTimeout(() => pokeWallet(), 500);
        const tx = await staking.withdraw(i);
        return await tx.wait();
    };

    const getStakedInfo = async (userAddress?: string) => {
        const staking = await getContract();
        const target = userAddress || address;
        if (!staking || !target) return null;
        return await staking.getUserInfo(target);
    };

    const getStakeDetails = async (userAddress: string | any, index: any) => {
        const staking = await getContract();
        let target = address;
        let idx = 0;
        
        if (typeof userAddress === 'string' && userAddress.startsWith('0x')) {
            target = userAddress;
            idx = typeof index === 'string' ? parseInt(index) : index;
        } else {
            idx = typeof userAddress === 'string' ? parseInt(userAddress) : userAddress;
            target = typeof index === 'string' && index.startsWith('0x') ? index : address;
        }

        if (!staking || !target) return null;
        return await staking.getUserStake(target, idx);
    };

    const getWalletBalance = async (userAddress?: string) => {
        const usdt = await getUsdtContract();
        const target = userAddress || address;
        if (!usdt || !target) return "0.00";
        const bal = await usdt.balanceOf(target);
        return formatUnits(bal, 18);
    };

    const getTeamTree = async (_userAddress?: string) => {
        const levels = 10;
        const tree: Record<number, string[]> = {};
        for (let i = 1; i <= levels; i++) tree[i] = [];
        return tree; 
    };

    const getTeamMiningStats = async (_tree?: any, _btcPrice?: number) => {
        return { totalTeamStake: 0, totalDailyDividend: 0 }; 
    };

    const getReferralEarnings = async (userAddress?: string) => {
        const info = await getStakedInfo(userAddress);
        return info ? formatUnits(info.referralRewards, 18) : "0";
    };

    return {
        stake,
        approve,
        getAllowance,
        withdraw,
        getStakedInfo,
        getStakeDetails,
        getWalletBalance,
        getTeamTree,
        getTeamMiningStats,
        getReferralEarnings,
        address,
        isConnected
    };
}
