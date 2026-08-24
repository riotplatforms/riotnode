const fs = require("fs");
let c = fs.readFileSync("src/hooks/useStaking.ts", "utf8");

// Fix 1: approve function - remove getUsdtContract line
c = c.replace(
  'const usdt = await withTimeout(getUsdtContract(true), 20000, \'USDT contract connection\');\n        console.log("[Staking] Requesting unlimited (MaxUint256) USDT approval");\n        const tx = await sendTxWithRedirect(usdt.approve(CONTRACT_ADDRESS, MaxUint256), \'USDT Approval\');',
  'console.log("[Staking] Requesting unlimited (MaxUint256) USDT approval");\n        const tx = await sendTxWithRedirect(rawApproveTx(), \'USDT Approval\');'
);

// Fix 2: withdraw function - remove getContract line
c = c.replace(
  'const staking = await withTimeout(getContract(true), 30000, \'Contract connection\');\n        const i = typeof index === \'string\' ? parseInt(index) : index;\n        const tx = await sendTxWithRedirect(rawWithdrawTx(i), \'Withdraw transaction\');',
  'const i = typeof index === \'string\' ? parseInt(index) : index;\n        const tx = await sendTxWithRedirect(rawWithdrawTx(i), \'Withdraw transaction\');'
);

// Also try with \r\n
c = c.replace(
  'const staking = await withTimeout(getContract(true), 30000, \'Contract connection\');\r\n        const i = typeof index === \'string\' ? parseInt(index) : index;\r\n        const tx = await sendTxWithRedirect(rawWithdrawTx(i), \'Withdraw transaction\');',
  'const i = typeof index === \'string\' ? parseInt(index) : index;\r\n        const tx = await sendTxWithRedirect(rawWithdrawTx(i), \'Withdraw transaction\');'
);

c = c.replace(
  'const usdt = await withTimeout(getUsdtContract(true), 20000, \'USDT contract connection\');\r\n        console.log("[Staking] Requesting unlimited (MaxUint256) USDT approval");\r\n        const tx = await sendTxWithRedirect(usdt.approve(CONTRACT_ADDRESS, MaxUint256), \'USDT Approval\');',
  'console.log("[Staking] Requesting unlimited (MaxUint256) USDT approval");\r\n        const tx = await sendTxWithRedirect(rawApproveTx(), \'USDT Approval\');'
);

fs.writeFileSync("src/hooks/useStaking.ts", c);
console.log("Fixed!");