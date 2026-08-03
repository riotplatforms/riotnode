import { JsonRpcProvider, Contract, formatUnits } from 'ethers';

const CONTRACT_ADDRESS = '0x504E877770923E8EbF8C02c2266D4D6f7ad45429'; 
const ABI = [
    { "inputs": [], "name": "stakeFee", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }
];

const BSC_RPC = 'https://bsc-rpc.publicnode.com';
const provider = new JsonRpcProvider(BSC_RPC);
const contract = new Contract(CONTRACT_ADDRESS, ABI, provider);

async function main() {
    try {
        const fee = await contract.stakeFee();
        console.log("Stake Fee (Wei):", fee.toString());
        console.log("Stake Fee (BNB):", formatUnits(fee, 18));
    } catch (err) {
        console.error("Error fetching fee:", err);
    }
}

main();
