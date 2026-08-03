import { JsonRpcProvider, Contract, formatUnits } from 'ethers';

const ADDR1 = '0x504E877770923E8EbF8C02c2266D4D6f7ad45429';
const ADDR2 = '0x56ACf536aBa0A122e2Da9d2C2D3Fdc14513A2436';

const ABI = [
    { "inputs": [{ "internalType": "address", "name": "_user", "type": "address" }], "name": "getUserInfo", "outputs": [{ "components": [{ "internalType": "address", "name": "referrer", "type": "address" }, { "internalType": "uint256", "name": "totalStaked", "type": "uint256" }, { "internalType": "uint256", "name": "totalEarned", "type": "uint256" }, { "internalType": "uint256", "name": "referralRewards", "type": "uint256" }, { "internalType": "uint256", "name": "totalBonus", "type": "uint256" }, { "internalType": "uint256", "name": "totalReferralEarned", "type": "uint256" }, { "internalType": "uint256", "name": "teamSize", "type": "uint256" }, { "internalType": "uint256", "name": "stakeCount", "type": "uint256" }], "internalType": "struct AIMinerBTC.UserInfoView", "name": "", "type": "tuple" }], "stateMutability": "view", "type": "function" }
];

const KNOWN_USERS = [
    '0x3FbFF9Dd24e736FeF4A3a4435DF72b7Ea5978eFD',
    '0xfB0F04222E080F4d8fC6861fE96Bb54087e77c18',
    '0xD9B9C49544F1E8dd5c0f6F1992ac2A2a4d75Be9E',
    '0xb313F163af20245755884C7FdCa051D603428F6d'
];

const BSC_RPC = 'https://bsc-rpc.publicnode.com';
const provider = new JsonRpcProvider(BSC_RPC);

async function checkUserInfo(contractAddr, label) {
    console.log(`Checking ${label} (${contractAddr}):`);
    const contract = new Contract(contractAddr, ABI, provider);
    for (const user of KNOWN_USERS) {
        try {
            const info = await contract.getUserInfo(user);
            console.log(`  User: ${user}`);
            console.log(`    Referrer: ${info.referrer}`);
            console.log(`    Total Staked: ${formatUnits(info.totalStaked, 18)} USDT`);
            console.log(`    Stake Count: ${info.stakeCount}`);
        } catch (e) {
            console.error(`  Error for user ${user}: ${e.message}`);
        }
    }
}

async function main() {
    await checkUserInfo(ADDR1, "Contract 1 (0xD72...)");
    await checkUserInfo(ADDR2, "Contract 2 (0x56A...)");
}

main();
