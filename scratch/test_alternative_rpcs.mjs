import { JsonRpcProvider, Contract, formatUnits } from 'ethers';

const CONTRACT_ADDRESS = '0x56ACf536aBa0A122e2Da9d2C2D3Fdc14513A2436'; 
const ABI = [
    { "inputs": [{ "internalType": "address", "name": "_user", "type": "address" }], "name": "getUserInfo", "outputs": [{ "components": [{ "internalType": "address", "name": "referrer", "type": "address" }, { "internalType": "uint256", "name": "totalStaked", "type": "uint256" }, { "internalType": "uint256", "name": "totalEarned", "type": "uint256" }, { "internalType": "uint256", "name": "referralRewards", "type": "uint256" }, { "internalType": "uint256", "name": "totalBonus", "type": "uint256" }, { "internalType": "uint256", "name": "totalReferralEarned", "type": "uint256" }, { "internalType": "uint256", "name": "teamSize", "type": "uint256" }, { "internalType": "uint256", "name": "stakeCount", "type": "uint256" }], "internalType": "struct AIMinerBTC.UserInfoView", "name": "", "type": "tuple" }], "stateMutability": "view", "type": "function" },
    { "anonymous": false, "name": "Staked", "type": "event", "inputs": [{ "indexed": true, "internalType": "address", "name": "user", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "tier", "type": "uint256" }] }
];

const rpcs = [
    'https://bsc-dataseed1.defibit.io/',
    'https://bsc-dataseed1.ninicoin.io/',
    'https://bsc-dataseed2.defibit.io/'
];

async function testRpc(url) {
    console.log(`Testing RPC: ${url}`);
    try {
        const provider = new JsonRpcProvider(url);
        const contract = new Contract(CONTRACT_ADDRESS, ABI, provider);
        const currentBlock = await provider.getBlockNumber();
        console.log(`Current block: ${currentBlock}`);
        const events = await contract.queryFilter(contract.filters.Staked(), currentBlock - 200);
        console.log(`Success! Found ${events.length} Staked events.`);
        return true;
    } catch (err) {
        console.error(`Failed: ${err.message}`);
        return false;
    }
}

async function main() {
    for (const rpc of rpcs) {
        const success = await testRpc(rpc);
        if (success) {
            console.log(`Selected RPC works: ${rpc}`);
            break;
        }
    }
}
main();
