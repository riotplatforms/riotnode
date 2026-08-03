import { JsonRpcProvider, Contract, formatUnits } from 'ethers';

const ADDR1 = '0x504E877770923E8EbF8C02c2266D4D6f7ad45429';
const ADDR2 = '0x56ACf536aBa0A122e2Da9d2C2D3Fdc14513A2436';
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';
const USER_ADDRESS = '0xb313F163af20245755884C7FdCa051D603428F6d';

const ERC20_ABI = [
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)"
];

const BSC_RPC = 'https://bsc-rpc.publicnode.com';
const provider = new JsonRpcProvider(BSC_RPC);

async function main() {
    try {
        const usdt = new Contract(USDT_ADDRESS, ERC20_ABI, provider);
        const balance = await usdt.balanceOf(USER_ADDRESS);
        const allowance1 = await usdt.allowance(USER_ADDRESS, ADDR1);
        const allowance2 = await usdt.allowance(USER_ADDRESS, ADDR2);
        
        console.log("User:", USER_ADDRESS);
        console.log("USDT Balance:", formatUnits(balance, 18), "USDT");
        console.log("Allowance to Staking Contract 1 (0xD72...):", formatUnits(allowance1, 18), "USDT");
        console.log("Allowance to Staking Contract 2 (0x56A...):", formatUnits(allowance2, 18), "USDT");
    } catch (err) {
        console.error("Error:", err);
    }
}

main();
