/**
 * Helper utility to parse ethers.js / web3 errors and extract a user-friendly message.
 */
export function parseEthersError(err: any): string {
    if (!err) return 'Unknown error occurred.';

    // Log the raw error details for developer debugging in the console
    console.error('[Web3 Transaction Error]:', err);

    const errMsg = (err.message || '').toLowerCase();
    const errReason = (err.reason || '').toLowerCase();

    // 1. User rejection / cancellation
    if (
        err.code === 'ACTION_REJECTED' || 
        errMsg.includes('user rejected') || 
        errMsg.includes('rejected by user') ||
        errReason.includes('user rejected') ||
        errReason.includes('rejected by user')
    ) {
        return 'Transaction cancelled by user.';
    }

    // 2. Try to extract specific revert reason from the nested structure first
    // Check nested provider errors (err.error or err.info or err.data)
    const nestedError = err.error || err.info?.error || err.data;
    let specificReason = '';

    if (err.reason) {
        specificReason = err.reason;
    } else if (err.shortMessage) {
        specificReason = err.shortMessage;
    } else if (nestedError) {
        specificReason = nestedError.message || nestedError.reason || '';
    }

    if (specificReason && typeof specificReason === 'string') {
        const lowerReason = specificReason.toLowerCase();
        if (!lowerReason.includes('could not coalesce') && !lowerReason.includes('coalesce_error')) {
            // Clean up common execution revert prefixes if present
            let cleanReason = specificReason;
            if (cleanReason.includes('execution reverted:')) {
                cleanReason = cleanReason.split('execution reverted:')[1];
            }
            return cleanReason.trim();
        }
    }

    // 3. Insufficient BNB balance for gas fees (True insufficient balance)
    if (
        err.code === 'INSUFFICIENT_FUNDS' || 
        errMsg.includes('insufficient funds') || 
        errReason.includes('insufficient funds')
    ) {
        return 'Insufficient BNB balance to pay for network/gas fees. Please deposit some BNB and try again.';
    }

    // 4. Gas estimation failure / Transaction Revert without reason
    if (
        errMsg.includes('gas required exceeds allowance') ||
        errMsg.includes('always failing transaction') ||
        errMsg.includes('execution reverted') ||
        errReason.includes('gas required exceeds allowance') ||
        errReason.includes('always failing transaction') ||
        errReason.includes('execution reverted')
    ) {
        return 'Transaction failed. Please make sure you have enough USDT and BNB, and check if you already have an active stake.';
    }

    // Helper to check if a value is a coalesce error indicator
    const isCoalesce = (val: any): boolean => {
        if (!val) return false;
        if (typeof val === 'string') {
            const lower = val.toLowerCase();
            return lower.includes('could not coalesce error') || lower.includes('coalesce_error');
        }
        return false;
    };

    // Fallback serialization check
    let hasCoalesceInString = false;
    try {
        const errStr = String(err).toLowerCase();
        if (errStr.includes('could not coalesce error') || errStr.includes('coalesce_error')) {
            hasCoalesceInString = true;
        } else {
            const jsonStr = JSON.stringify(err).toLowerCase();
            if (jsonStr.includes('could not coalesce error') || jsonStr.includes('coalesce_error')) {
                hasCoalesceInString = true;
            }
        }
    } catch (_) {
        // ignore
    }

    // 5. Ethers v6 "could not coalesce error"
    if (
        hasCoalesceInString ||
        isCoalesce(err) ||
        isCoalesce(err.message) ||
        isCoalesce(err.reason) ||
        isCoalesce(err.shortMessage) ||
        isCoalesce(err.code) ||
        isCoalesce(err.error?.message) ||
        isCoalesce(err.error?.reason) ||
        isCoalesce(err.error?.code) ||
        isCoalesce(err.info?.error?.message) ||
        isCoalesce(err.info?.error?.reason) ||
        isCoalesce(err.info?.error?.code)
    ) {
        // Return a general error message that does not specifically blame BNB fees if we couldn't parse the details
        return 'Transaction failed. Please ensure your wallet has enough USDT/BNB and your connection is stable.';
    }

    // 6. Missing revert data error (Ethers BAD_DATA / call exception when RPC returns empty 0x or network fail)
    if (
        err.code === 'BAD_DATA' ||
        err.code === 'CALL_EXCEPTION' ||
        errMsg.includes('missing revert data') ||
        errMsg.includes('call exception') ||
        errMsg.includes('could not decode result')
    ) {
        return 'Network/RPC call failed or returned invalid data. Please check your network connection or try switching your RPC / wallet network.';
    }

    return err.message || 'Transaction failed. Please try again.';
}
