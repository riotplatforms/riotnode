import { JsonRpcProvider, Contract, formatUnits } from 'ethers';

const CONTRACT_ADDRESS = '0x504E877770923E8EbF8C02c2266D4D6f7ad45429'; 
const USER_ADDRESS = '0xb313F163af20245755884C7FdCa051D603428F6d';

const ABI = [
    { "inputs": [
        { "internalType": "address", "name": "_user", "type": "address" },
        { "internalType": "uint256", "name": "_index", "type": "uint256" }
    ], "name": "getUserStake", "outputs": [
        { "internalType": "uint256", "name": "amount", "type": "uint256" },
        { "internalType": "uint256", "name": "startTime", "type": "uint256" },
        { "internalType": "uint256", "name": "tier", "type": "uint256" },
        { "internalType": "bool", "name": "withdrawn", "type": "bool" }
    ], "stateMutability": "view", "type": "function" }
];

const BSC_RPC = 'https://bsc-rpc.publicnode.com';
const provider = new JsonRpcProvider(BSC_RPC);
const contract = new Contract(CONTRACT_ADDRESS, ABI, provider);

async function main() {
    try {
        const stake = await contract.getUserStake(USER_ADDRESS, 0);
        console.log("Stake 0 details:");
        console.log("  Amount:", formatUnits(stake.amount, 18), "USDT");
        console.log("  StartTime:", new Date(Number(stake.startTime) * 1000).toLocaleString());
        console.log("  Tier:", stake.tier.toString());
        console.log("  Withdrawn:", stake.withdrawn);
    } catch (err) {
        console.error("Error:", err);
    }
}

main();
