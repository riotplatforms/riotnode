const fs = require("fs");
let content = fs.readFileSync("src/hooks/useStaking.ts", "utf8");

// Fix 1: Remove Interface lines that are BEFORE ERC20_ABI
let oldIf = "// Create Interface instances for encoding function data\nconst CONTRACT_IFACE = new Interface(ABI);\nconst ERC20_IFACE = new Interface(ERC20_ABI);\n";
content = content.replace(oldIf, "");

// Fix 2: Add Interface AFTER ERC20_ABI
let newIf = "// Create Interface instances for encoding function data\nconst CONTRACT_IFACE = new Interface(ABI);\nconst ERC20_IFACE = new Interface(ERC20_ABI);\n\n";
content = content.replace("const APPROVAL_THRESHOLD", newIf + "const APPROVAL_THRESHOLD");

// Fix 3: Remove getContract(true) from stake()
content = content.replace(
    "let staking;\n        try {\n            // Add 30s timeout to getContract to prevent indefinite hang during signer resolution\n            staking = await withTimeout(getContract(true), 30000, 'Contract connection');\n        } catch (e) {\n            throw new Error(\"Failed to connect to contract: ${e?.message || e}. Please reconnect wallet.\");\n        }\n        if (!staking) throw new Error(\"Failed to create staking contract instance. Please reconnect wallet.\");\n        const refAddress",
    "const refAddress"
);
content = content.replace(
    "staking.stake(val, refAddress, { value: feeHex })", "rawStakingTx(val, refAddress, feeHex)"
);

// Fix 4: Remove getUsdtContract(true) from approve()
content = content.replace(
    "const usdt = await withTimeout(getUsdtContract(true), 20000, 'USDT contract connection');\n        console.log(\"[Staking] Requesting unlimited (MaxUint256) USDT approval\");\n        const tx = await sendTxWithRedirect(usdt.approve(CONTRACT_ADDRESS, MaxUint256), 'USDT Approval');",
    "console.log(\"[Staking] Requesting unlimited (MaxUint256) USDT approval\");\n        const tx = await sendTxWithRedirect(rawApproveTx(), 'USDT Approval');"
);

// Fix 5: Replace withdraw
content = content.replace(
    "const staking = await withTimeout(getContract(true), 30000, 'Contract connection');\n        const i",
    "const i"
);
content = content.replace(
    "staking.withdraw(i)", "rawWithdrawTx(i)"
);

fs.writeFileSync("src/hooks/useStaking.ts", content);
console.log("Done!");