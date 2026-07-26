import { JsonRpcProvider, Contract, formatUnits } from 'ethers';

const CONTRACT_ADDRESS = '0xD72342c78085Dc264E56B3d5941341093aD54B42'; 
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
