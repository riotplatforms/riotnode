import { ethers } from 'ethers';

const USER_ADDRESS = '0xb313F163af20245755884C7FdCa051D603428F6d';
const provider = new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org/');

async function main() {
    try {
        const balance = await provider.getBalance(USER_ADDRESS);
        console.log(`User BNB Balance: ${ethers.formatEther(balance)} BNB`);
    } catch (e) {
        console.error("Error fetching BNB balance:", e);
    }
}

main();
