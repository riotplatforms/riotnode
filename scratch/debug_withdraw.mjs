import { JsonRpcProvider, Contract, formatUnits, id as keccakId, Interface } from 'ethers';

const NEW_CONTRACT = '0x504E877770923E8EbF8C02c2266D4D6f7ad45429';
const USER_ADDRESS = '0xb313F163af20245755884C7FdCa051D603428F6d';
const USDT = '0x55d398326f99059fF775485246999027B3197955';

const iface = new Interface([
    "function withdraw(uint256 _stakeIndex)",
    "event Withdrawn(address indexed user, uint256 amount, uint256 reward)"
]);

async function main() {
    // 1. Simulate on a second RPC to confirm
    const p2 = new JsonRpcProvider('https://bsc-dataseed.binance.org');
    const c2 = new Contract(NEW_CONTRACT, iface, p2);
    try { await c2.withdraw.staticCall(0, { from: USER_ADDRESS }); console.log('NEW withdraw(0) on dataseed RPC: SUCCESS'); }
    catch (e) { console.log(`NEW withdraw(0) on dataseed RPC: REVERT — ${e.shortMessage || e.message}`); }

    // 2. debug_traceCall to see internal transfers
    const data = iface.encodeFunctionData('withdraw', [0]);
    const p3 = new JsonRpcProvider('https://bsc-rpc.publicnode.com');
    try {
        const trace = await p3.send('debug_traceCall', [{
            from: USER_ADDRESS, to: NEW_CONTRACT, data
        }, 'latest', { tracer: 'callTracer', tracerConfig: { withLog: true } }]);
        const walk = (node, depth) => {
            const val = node.value ? formatUnits(BigInt(node.value), 18) : '0';
            console.log(`${'  '.repeat(depth)}-> ${node.type} ${node.to} value=${val} gas=${node.gasUsed}${node.error ? ' ERROR:' + node.error : ''}`);
            if (node.logs) for (const l of node.logs) {
                try { console.log(`${'  '.repeat(depth)}   LOG: ${JSON.stringify(iface.parseLog({ topics: l.topics, data: l.data })?.args)}`); } catch { console.log(`${'  '.repeat(depth)}   LOG: raw ${l.topics?.[0]?.slice(0, 20)}`); }
            }
            if (node.calls) node.calls.forEach(ch => walk(ch, depth + 1));
        };
        walk(trace, 0);
    } catch (e) {
        console.log('debug_traceCall not supported:', String(e).slice(0, 150));
    }
}
main();



