import { ethers } from 'ethers';

const CONTRACT_ADDRESS = '0x56ACf536aBa0A122e2Da9d2C2D3Fdc14513A2436'; 
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';
const USER_ADDRESS = '0xb313F163af20245755884C7FdCa051D603428F6d';

const CONTRACT_ABI = [
    { "inputs": [], "name": "stakeFee", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "_amount", "type": "uint256" }, { "internalType": "address", "name": "_referrer", "type": "address" }], "name": "stake", "outputs": [], "stateMutability": "payable", "type": "function" }
];

const ERC20_ABI = [
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)"
];

const BSC_RPC = 'https://bsc-rpc.publicnode.com'; // Using high quality RPC to avoid rate limits
const provider = new ethers.JsonRpcProvider(BSC_RPC);

async function main() {
    try {
        const bnbBalance = await provider.getBalance(USER_ADDRESS);
        console.log("User BNB Balance:", ethers.formatUnits(bnbBalance, 18), "BNB");

        const usdt = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, provider);
        const usdtBalance = await usdt.balanceOf(USER_ADDRESS);
        console.log("User USDT Balance:", ethers.formatUnits(usdtBalance, 18), "USDT");

        const allowance = await usdt.allowance(USER_ADDRESS, CONTRACT_ADDRESS);
        console.log("Contract USDT Allowance:", ethers.formatUnits(allowance, 18), "USDT");

        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
        const stakeFee = await contract.stakeFee();
        console.log("Contract Stake Fee:", ethers.formatUnits(stakeFee, 18), "BNB");

        console.log("\nSimulating stake(54 USDT)...");
        try {
            const amountToStake = ethers.parseUnits("54", 18);
            const referrer = "0x0000000000000000000000000000000000000000";
            
            await contract.stake.staticCall(amountToStake, referrer, {
                from: USER_ADDRESS,
                value: stakeFee
            });
            console.log("Simulation succeeded! Transaction would go through.");
        } catch (simErr) {
            console.error("Simulation failed! Error details:");
            console.error(simErr.message);
            if (simErr.data) {
                console.error("Revert data:", simErr.data);
            }
        }

    } catch (err) {
        console.error("General error:", err);
    }
}

main();
