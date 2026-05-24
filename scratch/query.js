import { ethers } from 'ethers';

const CONTRACT_ADDRESS = '0x56ACf536aBa0A122e2Da9d2C2D3Fdc14513A2436'; 
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';
const USER_ADDRESS = '0xb313F163af20245755884C7FdCa051D603428F6d';

const ABI = [
    { "inputs": [{ "internalType": "uint256", "name": "_stakeIndex", "type": "uint256" }], "name": "withdraw", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
];

const provider = new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org/');

async function main() {
    try {
        const stakingContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

        console.log("Simulating withdraw(0)...");
        // We need to use staticCall or estimateGas. Since we don't have the private key of USER_ADDRESS, 
        // we can override the msg.sender by using call or staticCall with an overrides object, 
        // or by executing eth_call directly.
        // In ethers, to set msg.sender on a read/static call, we can pass { from: USER_ADDRESS }.
        const txResult = await stakingContract.withdraw.staticCall(0, {
            from: USER_ADDRESS
        });
        console.log("Simulation succeeded!", txResult);
    } catch (e) {
        console.error("Simulation failed. Error details:");
        console.error(e);
        if (e.data) {
            console.error("Revert data:", e.data);
        }
    }
}

main();
