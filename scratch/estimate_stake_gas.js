import { ethers } from 'ethers';

const CONTRACT_ADDRESS = '0x504E877770923E8EbF8C02c2266D4D6f7ad45429'; 
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';
const USER_ADDRESS = '0xb313F163af20245755884C7FdCa051D603428F6d';

const CONTRACT_ABI = [
    { "inputs": [], "name": "stakeFee", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "_amount", "type": "uint256" }, { "internalType": "address", "name": "_referrer", "type": "address" }], "name": "stake", "outputs": [], "stateMutability": "payable", "type": "function" }
];

const BSC_RPC = 'https://bsc-rpc.publicnode.com';
const provider = new ethers.JsonRpcProvider(BSC_RPC);

async function main() {
    try {
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
        const stakeFee = await contract.stakeFee();

        const amountToStake = ethers.parseUnits("54", 18);
        const referrer = "0x0000000000000000000000000000000000000000";

        console.log("Estimating gas for stake...");
        const gasEstimate = await contract.stake.estimateGas(amountToStake, referrer, {
            from: USER_ADDRESS,
            value: stakeFee
        });

        console.log("Gas Estimate:", gasEstimate.toString());

        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice || ethers.parseUnits('3', 'gwei');
        console.log("Gas Price:", ethers.formatUnits(gasPrice, 'gwei'), "Gwei");

        const gasCost = gasEstimate * gasPrice;
        console.log("Gas Cost:", ethers.formatUnits(gasCost, 18), "BNB");

        const totalRequired = stakeFee + gasCost;
        console.log("Total Required BNB (Stake Fee + Gas):", ethers.formatUnits(totalRequired, 18), "BNB");

        const balance = await provider.getBalance(USER_ADDRESS);
        console.log("User BNB Balance:", ethers.formatUnits(balance, 18), "BNB");

        if (balance < totalRequired) {
            console.log("RESULT: INSUFFICIENT BNB (Need at least " + ethers.formatUnits(totalRequired, 18) + " BNB, have " + ethers.formatUnits(balance, 18) + ")");
        } else {
            console.log("RESULT: SUFFICIENT BNB");
        }
    } catch (err) {
        console.error("Error estimating gas:", err);
    }
}

main();
