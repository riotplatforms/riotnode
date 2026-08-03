import { JsonRpcProvider, Contract, formatUnits } from 'ethers';

const CONTRACT_ADDRESS = '0x56ACf536aBa0A122e2Da9d2C2D3Fdc14513A2436'; 
const ABI = [
    { "inputs": [{ "internalType": "address", "name": "_user", "type": "address" }], "name": "getUserInfo", "outputs": [{ "components": [{ "internalType": "address", "name": "referrer", "type": "address" }, { "internalType": "uint256", "name": "totalStaked", "type": "uint256" }, { "internalType": "uint256", "name": "totalEarned", "type": "uint256" }, { "internalType": "uint256", "name": "referralRewards", "type": "uint256" }, { "internalType": "uint256", "name": "totalBonus", "type": "uint256" }, { "internalType": "uint256", "name": "totalReferralEarned", "type": "uint256" }, { "internalType": "uint256", "name": "teamSize", "type": "uint256" }, { "internalType": "uint256", "name": "stakeCount", "type": "uint256" }], "internalType": "struct AIMinerBTC.UserInfoView", "name": "", "type": "tuple" }], "stateMutability": "view", "type": "function" },
    { "anonymous": false, "name": "Staked", "type": "event", "inputs": [{ "indexed": true, "internalType": "address", "name": "user", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "tier", "type": "uint256" }] }
];

const provider = new JsonRpcProvider('https://bsc-rpc.publicnode.com');
const contract = new Contract(CONTRACT_ADDRESS, ABI, provider);

async function main() {
    console.log("Fetching Staked events from block 110320000...");
    try {
        const events = await contract.queryFilter(contract.filters.Staked(), 110320000);
        console.log("Total Staked events:", events.length);
        const stakers = Array.from(new Set(events.map(e => e.args.user)));
        console.log("Stakers:", stakers);
        for (const staker of stakers) {
            const info = await contract.getUserInfo(staker);
            console.log(`Staker: ${staker} | Referrer: ${info.referrer} | Total Staked: ${formatUnits(info.totalStaked, 18)}`);
        }
    } catch (err) {
        console.error(err);
    }
}
main();
