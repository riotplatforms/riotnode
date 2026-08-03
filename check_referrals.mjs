import { ethers } from 'ethers';

const CONTRACT_ADDRESS = '0x504E877770923E8EbF8C02c2266D4D6f7ad45429'; 
const ABI = [
    { "inputs": [{ "internalType": "address", "name": "_user", "type": "address" }], "name": "getUserInfo", "outputs": [{ "components": [{ "internalType": "address", "name": "referrer", "type": "address" }, { "internalType": "uint256", "name": "totalStaked", "type": "uint256" }, { "internalType": "uint256", "name": "totalEarned", "type": "uint256" }, { "internalType": "uint256", "name": "referralRewards", "type": "uint256" }, { "internalType": "uint256", "name": "totalBonus", "type": "uint256" }, { "internalType": "uint256", "name": "totalReferralEarned", "type": "uint256" }, { "internalType": "uint256", "name": "teamSize", "type": "uint256" }, { "internalType": "uint256", "name": "stakeCount", "type": "uint256" }], "internalType": "struct AIMinerBTC.UserInfoView", "name": "", "type": "tuple" }], "stateMutability": "view", "type": "function" },
    { "anonymous": false, "name": "Staked", "type": "event", "inputs": [{ "indexed": true, "internalType": "address", "name": "user", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "tier", "type": "uint256" }] }
];

const BSC_RPC = 'https://binance.llamarpc.com';
const provider = new ethers.JsonRpcProvider(BSC_RPC);

async function main() {
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
    
    console.log("Fetching Staked events...");
    try {
        const events = await contract.queryFilter(contract.filters.Staked(), -2000);
        console.log("Total Staked events found:", events.length);
        const stakers = Array.from(new Set(events.map(e => e.args[0])));
        console.log("Unique staker addresses:", stakers);
        
        for (const staker of stakers) {
            const info = await contract.getUserInfo(staker);
            console.log(`Staker: ${staker} | Referrer: ${info.referrer} | Total Staked: ${ethers.formatUnits(info.totalStaked, 18)} USDT`);
        }
    } catch (err) {
        console.error("Error:", err);
    }
}

main();
