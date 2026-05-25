import { JsonRpcProvider, Contract, formatUnits } from 'ethers';

const CONTRACT_ADDRESS = '0x56ACf536aBa0A122e2Da9d2C2D3Fdc14513A2436'; 
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
