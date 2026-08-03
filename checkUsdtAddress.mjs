import { JsonRpcProvider, Contract } from 'ethers';

const CONTRACT_ADDRESS = '0x504E877770923E8EbF8C02c2266D4D6f7ad45429'; 
const ABI = [
    { "inputs": [], "name": "usdt", "outputs": [{ "internalType": "contract IERC20", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }
];

const BSC_RPC = 'https://bsc-rpc.publicnode.com';
const provider = new JsonRpcProvider(BSC_RPC);
const contract = new Contract(CONTRACT_ADDRESS, ABI, provider);

async function main() {
    try {
        const usdtAddress = await contract.usdt();
        console.log("Configured USDT Address on-chain:", usdtAddress);
    } catch (err) {
        console.error("Error fetching USDT address:", err);
    }
}

main();
