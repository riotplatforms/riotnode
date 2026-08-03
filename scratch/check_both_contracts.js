import { JsonRpcProvider, Contract } from 'ethers';

const ADDR1 = '0x504E877770923E8EbF8C02c2266D4D6f7ad45429';
const ADDR2 = '0x56ACf536aBa0A122e2Da9d2C2D3Fdc14513A2436';

const ABI = [
    { "inputs": [], "name": "usdt", "outputs": [{ "internalType": "contract IERC20", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "stakeFee", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }
];

const BSC_RPC = 'https://bsc-rpc.publicnode.com';
const provider = new JsonRpcProvider(BSC_RPC);

async function checkAddress(addr, label) {
    try {
        const contract = new Contract(addr, ABI, provider);
        const usdtAddress = await contract.usdt();
        const fee = await contract.stakeFee();
        console.log(`${label} (${addr}):`);
        console.log("  USDT:", usdtAddress);
        console.log("  Stake Fee (Wei):", fee.toString());
    } catch (err) {
        console.error(`Error checking ${label} (${addr}):`, err.message);
    }
}

async function main() {
    await checkAddress(ADDR1, "Contract in useStaking/useAdmin (0xD72...)");
    await checkAddress(ADDR2, "Contract in check_referrals/estimate_stake_gas (0x56A...)");
}

main();
