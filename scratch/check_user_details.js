import { JsonRpcProvider, Contract, formatUnits } from 'ethers';

const CONTRACT_ADDRESS = '0x504E877770923E8EbF8C02c2266D4D6f7ad45429'; 
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955'; 
const USER_ADDRESS = '0xb313F163af20245755884C7FdCa051D603428F6d';

const ABI = [
    { "inputs": [{ "internalType": "address", "name": "_user", "type": "address" }], "name": "getUserInfo", "outputs": [{ "components": [{ "internalType": "address", "name": "referrer", "type": "address" }, { "internalType": "uint256", "name": "totalStaked", "type": "uint256" }, { "internalType": "uint256", "name": "totalEarned", "type": "uint256" }, { "internalType": "uint256", "name": "referralRewards", "type": "uint256" }, { "internalType": "uint256", "name": "totalBonus", "type": "uint256" }, { "internalType": "uint256", "name": "totalReferralEarned", "type": "uint256" }, { "internalType": "uint256", "name": "teamSize", "type": "uint256" }, { "internalType": "uint256", "name": "stakeCount", "type": "uint256" }], "internalType": "struct AIMinerBTC.UserInfoView", "name": "", "type": "tuple" }], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "stakeFee", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }
];

const ERC20_ABI = [
    "function balanceOf(address account) external view returns (uint256)",
    "function allowance(address owner, address spender) external view returns (uint256)"
];

const BSC_RPC = 'https://bsc-rpc.publicnode.com';
const provider = new JsonRpcProvider(BSC_RPC);

async function main() {
    try {
        const contract = new Contract(CONTRACT_ADDRESS, ABI, provider);
        const usdt = new Contract(USDT_ADDRESS, ERC20_ABI, provider);

        const usdtBal = await usdt.balanceOf(USER_ADDRESS);
        const allowance = await usdt.allowance(USER_ADDRESS, CONTRACT_ADDRESS);
        const userInfo = await contract.getUserInfo(USER_ADDRESS);
        const bnbBal = await provider.getBalance(USER_ADDRESS);

        console.log("User:", USER_ADDRESS);
        console.log("BNB Balance:", formatUnits(bnbBal, 18), "BNB");
        console.log("USDT Balance:", formatUnits(usdtBal, 18), "USDT");
        console.log("USDT Allowance:", formatUnits(allowance, 18), "USDT");
        console.log("Staking Info:");
        console.log("  Referrer:", userInfo.referrer);
        console.log("  Total Staked:", formatUnits(userInfo.totalStaked, 18), "USDT");
        console.log("  Referral Rewards:", formatUnits(userInfo.referralRewards, 18), "USDT");
        console.log("  Stake Count:", userInfo.stakeCount.toString());
    } catch (err) {
        console.error("Error:", err);
    }
}

main();
