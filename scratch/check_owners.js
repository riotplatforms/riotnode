import { JsonRpcProvider, Contract, formatUnits } from 'ethers';

const ADDR1 = '0x504E877770923E8EbF8C02c2266D4D6f7ad45429';
const ADDR2 = '0x56ACf536aBa0A122e2Da9d2C2D3Fdc14513A2436';
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';

const ABI = [
    { "inputs": [], "name": "deployer", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "secondAdmin", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }
];

const ERC20_ABI = [
    "function balanceOf(address account) external view returns (uint256)"
];

const BSC_RPC = 'https://bsc-rpc.publicnode.com';
const provider = new JsonRpcProvider(BSC_RPC);

async function checkDetails(addr, label) {
    try {
        const contract = new Contract(addr, ABI, provider);
        const deployer = await contract.deployer();
        const secondAdmin = await contract.secondAdmin();
        const usdt = new Contract(USDT_ADDRESS, ERC20_ABI, provider);
        const balance = await usdt.balanceOf(addr);
        
        console.log(`${label} (${addr}):`);
        console.log("  Deployer:", deployer);
        console.log("  Second Admin:", secondAdmin);
        console.log("  USDT Balance:", formatUnits(balance, 18), "USDT");
    } catch (err) {
        console.error(`Error checking ${label}:`, err.message);
    }
}

async function main() {
    await checkDetails(ADDR1, "Contract 1");
    await checkDetails(ADDR2, "Contract 2");
}

main();
