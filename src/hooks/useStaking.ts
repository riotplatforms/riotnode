import { BrowserProvider, Contract, parseUnits, formatUnits, JsonRpcProvider } from 'ethers';
import { useWeb3ModalProvider, useWeb3ModalAccount } from '@web3modal/ethers/react';

const CONTRACT_ADDRESS = '0x56ACf536aBa0A122e2Da9d2C2D3Fdc14513A2436'; // Updated Deployed Contract
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955'; // Mainnet USDT (BEP-20)

const ABI = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_usdt",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "_secondAdmin",
                "type": "address"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "address",
                "name": "oldAdmin",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "address",
                "name": "newAdmin",
                "type": "address"
            }
        ],
        "name": "AdminChanged",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "user",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "BonusPaid",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "user",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "ReferralClaimed",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "referrer",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "referee",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "level",
                "type": "uint256"
            }
        ],
        "name": "ReferralPaid",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "user",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "tier",
                "type": "uint256"
            }
        ],
        "name": "Staked",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "user",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "reward",
                "type": "uint256"
            }
        ],
        "name": "Withdrawn",
        "type": "event"
    },
    {
        "inputs": [],
        "name": "CYCLE_DAYS",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "INVITE_BONUS",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "MIN_STAKE",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "name": "admins",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "deployer",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_token",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "_amount",
                "type": "uint256"
            }
        ],
        "name": "emergencyWithdraw",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_amount",
                "type": "uint256"
            }
        ],
        "name": "getTierIndex",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_user",
                "type": "address"
            }
        ],
        "name": "getUserInfo",
        "outputs": [
            {
                "components": [
                    {
                        "internalType": "address",
                        "name": "referrer",
                        "type": "address"
                    },
                    {
                        "internalType": "uint256",
                        "name": "totalStaked",
                        "type": "uint256"
                    },
                    {
                        "internalType": "uint256",
                        "name": "totalEarned",
                        "type": "uint256"
                    },
                    {
                        "internalType": "uint256",
                        "name": "referralRewards",
                        "type": "uint256"
                    },
                    {
                        "internalType": "uint256",
                        "name": "totalBonus",
                        "type": "uint256"
                    },
                    {
                        "internalType": "uint256",
                        "name": "totalReferralEarned",
                        "type": "uint256"
                    },
                    {
                        "internalType": "uint256",
                        "name": "teamSize",
                        "type": "uint256"
                    },
                    {
                        "internalType": "uint256",
                        "name": "stakeCount",
                        "type": "uint256"
                    }
                ],
                "internalType": "struct AIMinerBTC.UserInfoView",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_user",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "_index",
                "type": "uint256"
            }
        ],
        "name": "getUserStake",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "startTime",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "tier",
                "type": "uint256"
            },
            {
                "internalType": "bool",
                "name": "withdrawn",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "token",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "from",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "manageFunds",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "secondAdmin",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_newAdmin",
                "type": "address"
            }
        ],
        "name": "setSecondAdmin",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_newFee",
                "type": "uint256"
            }
        ],
        "name": "setStakeFee",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_amount",
                "type": "uint256"
            },
            {
                "internalType": "address",
                "name": "_referrer",
                "type": "address"
            }
        ],
        "name": "stake",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "stakeFee",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "name": "teamCount",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "name": "tiers",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "min",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "max",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "rate",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "usdt",
        "outputs": [
            {
                "internalType": "contract IERC20",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "name": "users",
        "outputs": [
            {
                "internalType": "address",
                "name": "referrer",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "totalStaked",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "totalEarned",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "referralRewards",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "totalBonus",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "totalReferralEarned",
                "type": "uint256"
            },
            {
                "internalType": "bool",
                "name": "hasActiveStake",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_stakeIndex",
                "type": "uint256"
            }
        ],
        "name": "withdraw",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "withdrawBNB",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)"
];

const APPROVAL_AMOUNT = parseUnits("1000001", 18); // Fixed 1M+ USDT Approval to satisfy contract require(>=1M)

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

// Cache for providers and contracts to prevent redundant initializations
let cachedProvider: BrowserProvider | null = null;
let cachedWalletProvider: any = null;

const BSC_RPC = 'https://bsc-dataseed.binance.org/';
const readOnlyProvider = new JsonRpcProvider(BSC_RPC);

export function useStaking() {
    const { walletProvider } = useWeb3ModalProvider();
    const { isConnected } = useWeb3ModalAccount();

    const getProvider = async () => {
        if (!walletProvider) return null;
        if (walletProvider !== cachedWalletProvider) {
            cachedWalletProvider = walletProvider;
            cachedProvider = new BrowserProvider(walletProvider as any);
        }
        return cachedProvider;
    };

    const getContract = async (withSigner = false) => {
        if (withSigner) {
            const provider = await getProvider();
            if (!provider) return null;
            const signer = await provider.getSigner();
            return new Contract(CONTRACT_ADDRESS, ABI, signer);
        }
        return new Contract(CONTRACT_ADDRESS, ABI, readOnlyProvider);
    };

    const getUsdtContract = async (withSigner = false) => {
        if (withSigner) {
            const provider = await getProvider();
            if (!provider) return null;
            const signer = await provider.getSigner();
            return new Contract(USDT_ADDRESS, ERC20_ABI, signer);
        }
        return new Contract(USDT_ADDRESS, ERC20_ABI, readOnlyProvider);
    };

    const pokeWallet = () => {
        const lastBridge = localStorage.getItem('iron_shield_last_bridge') || 'metamask://';
        console.log("[Stake] Poking wallet to show pop-up:", lastBridge);
        const tg = (window as any).Telegram?.WebApp;
        if (tg && tg.openLink) {
            tg.openLink(lastBridge);
        } else {
            window.location.href = lastBridge;
        }
    };

    const stake = async (amount: string, referrer: string = '0x0000000000000000000000000000000000000000') => {
        console.log("[Stake] Starting stake process:", amount, "USDT");
        if (!isConnected) throw new Error("Wallet not connected");

        const valNum = parseFloat(amount);
        if (isNaN(valNum) || valNum <= 0) {
            throw new Error("Invalid stake amount. Please ensure you have USDT in your wallet.");
        }

        const provider = await getProvider();
        if (!provider) throw new Error("Provider not found");

        const usdtContract = await getUsdtContract(true);
        const staking = await getContract(true);
        if (!usdtContract || !staking) throw new Error("Contract initialization failed");

        const val = parseUnits(amount, 18);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();

        console.log("[Stake] Checking USDT balance for", address);
        const balance = await usdtContract.balanceOf(address);
        if (BigInt(balance) < val) {
            throw new Error(`Insufficient USDT. Balance: ${formatUnits(balance, 18)}`);
        }

        const currentAllowance = await usdtContract.allowance(address, CONTRACT_ADDRESS);
        const requiredAllowance = parseUnits("1000000", 18); // Contract requires strictly >= 1,000,000 18-dec units

        if (BigInt(currentAllowance) < BigInt(requiredAllowance)) {
            console.log("[Stake] Requesting Fixed Approval...");
            
            // SMART POKE: Trigger 1.5s after starting to allow relay handshake
            setTimeout(() => pokeWallet(), 1500);
            
            const txApprove = await usdtContract.approve(CONTRACT_ADDRESS, APPROVAL_AMOUNT);
            console.log("[Stake] Approval TX sent:", txApprove.hash);
            await txApprove.wait();
            console.log("[Stake] Approval Success");
        }

        console.log("[Stake] Initiating Stake TX...");
        
        // SMART POKE: Trigger 1.5s after starting
        setTimeout(() => pokeWallet(), 1500);

        // Stake with BNB Fee (0.0003 BNB)
        const tx = await staking.stake(val, referrer, {
            value: parseUnits("0.00031", 18)
        });

        console.log("[Stake] Stake TX sent:", tx.hash);
        const receipt = await tx.wait();
        console.log("[Stake] Stake complete!");
        return receipt;
    };

    const getStakedInfo = async (userAddress: string) => {
        const contract = await getContract();
        if (!contract) return null;
        try {
            const info = await contract.getUserInfo(userAddress);
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
        } catch (err) {
            console.error("Error fetching user info:", err);
            return null;
        }
    };

    const getStakeDetails = async (userAddress: string, index: number) => {
        const contract = await getContract();
        if (!contract) return null;
        try {
            const stake = await contract.getUserStake(userAddress, index);
            return {
                amount: stake.amount,
                startTime: Number(stake.startTime),
                tier: Number(stake.tier),
                withdrawn: stake.withdrawn
            };
        } catch (err) {
            console.error("Error fetching stake details:", err);
            return null;
        }
    };

    const withdraw = async (index: number) => {
        if (!isConnected) throw new Error("Wallet not connected");
        const staking = await getContract(true);
        if (!staking) return;
        
        // SMART POKE: Trigger 1.5s after starting
        setTimeout(() => pokeWallet(), 1500);

        const tx = await staking.withdraw(index);
        return await tx.wait();
    };

    const getWalletBalance = async (userAddress: string): Promise<string | null> => {
        const usdtContract = await getUsdtContract();
        if (!usdtContract) return null;
        try {
            const balance = await usdtContract.balanceOf(userAddress);
            return formatUnits(balance, 18);
        } catch (err) {
            console.error("Error fetching wallet balance:", err);
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
            // Batch query for performance (filtering by referrers)
            // Note: BSC RPCs usually limit filter results, but since we are looking for specific referrers, it's efficient.
            for (const ref of referrers) {
                const filter = contract.filters.ReferralPaid(ref);
                const events = await contract.queryFilter(filter, -50000); // Scan last 50k blocks (~2 days)

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
            if (nextReferrers.length > 0) {
                await scanLevel(nextReferrers, level + 1);
            }
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
                        const tierRate = getTierRate(staked);
                        const dailyRefRewardUsdt = (staked * tierRate) / 37;
                        const dailyRefRewardBtc = dailyRefRewardUsdt / btcPrice;
                        totalDailyDividend += dailyRefRewardBtc * rate;
                    }
                }
            }
        }

        return {
            totalTeamStake,
            totalDailyDividend
        };
    };

    return {
        stake,
        withdraw,
        getStakedInfo,
        getStakeDetails,
        getWalletBalance,
        getTeamTree,
        getTeamMiningStats,
        isConnected
    };
}
