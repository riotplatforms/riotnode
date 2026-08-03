import { JsonRpcProvider } from 'ethers';

const CONTRACT_ADDRESS = '0x56ACf536aBa0A122e2Da9d2C2D3Fdc14513A2436'; 
const provider = new JsonRpcProvider('https://bsc-rpc.publicnode.com');

async function main() {
    let low = 40000000; // Let's guess
    let high = await provider.getBlockNumber();
    console.log("Current block:", high);
    
    // We want to find the block where contract code was first deployed
    // We can do a binary search or check if the code exists
    while (low <= high) {
        let mid = Math.floor((low + high) / 2);
        console.log(`Checking block ${mid}...`);
        try {
            const code = await provider.getCode(CONTRACT_ADDRESS, mid);
            if (code !== '0x') {
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        } catch (e) {
            // If block is too old or not pruned
            low = mid + 1;
        }
    }
    console.log("Contract deployed at block around:", low);
}

main();
