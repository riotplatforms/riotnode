async function main() {
    const url = 'https://bsc-dataseed.binance.org/';
    
    // Get current block first
    const blockRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_blockNumber",
            params: []
        })
    });
    const blockData = await blockRes.json();
    const currentBlock = parseInt(blockData.result, 16);
    console.log("Current block:", currentBlock);

    // Let's do from block = current block - 500
    const fromBlockHex = "0x" + (currentBlock - 500).toString(16);
    const body = {
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getLogs",
        params: [{
            address: "0x56ACf536aBa0A122e2Da9d2C2D3Fdc14513A2436",
            fromBlock: fromBlockHex, 
            toBlock: "latest",
            topics: ["0x1449c6dd7851abc30abf37f57715f492010519147cc2652fbc38202c18a6ee90"]
        }]
    };

    console.log("Sending raw eth_getLogs to:", url, "with fromBlock:", fromBlockHex);
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.error) {
            console.log("RPC Error:", data.error);
        } else {
            console.log("Success! Found logs count:", data.result?.length);
            console.log("Logs:", data.result);
        }
    } catch (e) {
        console.error("Fetch Error:", e);
    }
}
main();
