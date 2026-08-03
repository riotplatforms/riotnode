import { ethers } from 'ethers';

const CONTRACT_ADDRESS = '0x504E877770923E8EbF8C02c2266D4D6f7ad45429'; 
const USER_ADDRESS = '0xb313F163af20245755884C7FdCa051D603428F6d';

const CONTRACT_ABI = [
    { "inputs": [], "name": "stakeFee", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "_amount", "type": "uint256" }, { "internalType": "address", "name": "_referrer", "type": "address" }], "name": "stake", "outputs": [], "stateMutability": "payable", "type": "function" }
];

const BSC_RPC = 'https://bsc-rpc.publicnode.com';
const provider = new ethers.JsonRpcProvider(BSC_RPC);

async function testStake(amountStr) {
    try {
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
        const stakeFee = await contract.stakeFee();
        const amount = ethers.parseUnits(amountStr, 18);
        const referrer = "0x0000000000000000000000000000000000000000";

        console.log(`[Simulation] Estimating gas for staking ${amountStr} USDT...`);
        const gasEstimate = await contract.stake.estimateGas(amount, referrer, {
            from: USER_ADDRESS,
            value: stakeFee
        });
        console.log(`[Success] Gas Estimate: ${gasEstimate.toString()}`);
    } catch (err) {
        console.error(`[Error] Failed for ${amountStr} USDT:`, err.message || err);
        if (err.data) {
            console.error("  Error Data:", err.data);
        }
        if (err.error) {
            console.error("  Nested Error:", err.error.message);
        }
    }
}

async function main() {
    await testStake("205.605247"); // Current full balance
    await testStake("50");          // Minimum stake
    await testStake("100");         // A value less than balance
    await testStake("250");         // A value greater than balance (should revert)
}

main();
