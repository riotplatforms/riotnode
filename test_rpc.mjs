async function main() {
    const CONTRACT_ADDRESS = '0x56ACf536aBa0A122e2Da9d2C2D3Fdc14513A2436';
    const url = `https://api.bscscan.com/api?module=account&action=txlist&address=${CONTRACT_ADDRESS}&startblock=0&endblock=999999999&sort=asc`;
    console.log("Fetching transactions from BSCScan API:", url);
    try {
        const res = await fetch(url);
        const data = await res.json();
        console.log("Status:", data.status);
        console.log("Message:", data.message);
        if (data.result && Array.isArray(data.result)) {
            console.log("Total txs found:", data.result.length);
            const senders = new Set(data.result.map(tx => tx.from.toLowerCase()));
            console.log("Unique senders count:", senders.size);
            console.log("Unique senders:", Array.from(senders));
        } else {
            console.log("Result:", data.result);
        }
    } catch (err) {
        console.error("Error fetching BSCScan API:", err);
    }
}

main();
