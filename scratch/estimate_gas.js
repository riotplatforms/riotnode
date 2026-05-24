import { ethers } from 'ethers';

const CONTRACT_ADDRESS = '0x56ACf536aBa0A122e2Da9d2C2D3Fdc14513A2436'; 
const USER_ADDRESS = '0xb313F163af20245755884C7FdCa051D603428F6d';

const ABI = [
    { "inputs": [{ "internalType": "uint256", "name": "_stakeIndex", "type": "uint256" }], "name": "withdraw", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
];

const provider = new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org/');

async function main() {
    try {
        const stakingContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
        const gasEstimate = await stakingContract.withdraw.estimateGas(0, {
            from: USER_ADDRESS
        });
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice || ethers.parseUnits('3', 'gwei');

        const totalCostWei = gasEstimate * gasPrice;
        console.log(`Estimated Gas: ${gasEstimate.toString()}`);
        console.log(`Gas Price: ${ethers.formatUnits(gasPrice, 'gwei')} Gwei`);
        console.log(`Estimated Tx Cost: ${ethers.formatEther(totalCostWei)} BNB`);
        
        const balance = await provider.getBalance(USER_ADDRESS);
        console.log(`User BNB Balance: ${ethers.formatEther(balance)} BNB`);

        if (balance < totalCostWei) {
            console.log("RESULT: INSUFFICIENT_BNB");
        } else {
            console.log("RESULT: SUFFICIENT_BNB");
        }
    } catch (e) {
        console.error("Error estimating gas:", e);
    }
}

main();
