/**
 * Helper utility to parse ethers.js / web3 errors and extract a user-friendly message.
 */
export function parseEthersError(err: any): string {
    if (!err) return 'Unknown error occurred.';

    // Log the raw error details for developer debugging in the console
    console.error('[Web3 Transaction Error]:', err);

    // 1. User rejection / cancellation
    if (
        err.code === 'ACTION_REJECTED' || 
        err.message?.includes('user rejected') || 
        err.message?.includes('User rejected') ||
        err.message?.includes('Rejected by user')
    ) {
        return 'Transaction cancelled by user.';
    }

    // 2. Insufficient BNB balance for gas fees
    if (
        err.code === 'INSUFFICIENT_FUNDS' || 
        err.message?.includes('insufficient funds') || 
        err.message?.includes('INSUFFICIENT_FUNDS') ||
        err.message?.includes('gas required exceeds allowance')
    ) {
        return 'Insufficient BNB balance to pay for network/gas fees. Please deposit some BNB and try again.';
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

    // 3. Ethers v6 "could not coalesce error"
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
        // Ethers wraps underlying provider errors when it fails to parse them.
        // Usually, this is because of gas/network limitations or user rejection.
        return 'Transaction failed. Please check if you have sufficient BNB for gas fees or if your wallet connection is stable.';
    }

    // 4. Try to extract specific revert reason from the nested structure
    // Check err.reason or err.shortMessage
    if (err.reason) return err.reason;
    if (err.shortMessage) return err.shortMessage;

    // Check nested provider errors (err.error or err.info)
    const nestedError = err.error || err.info?.error;
    if (nestedError) {
        if (nestedError.message) return nestedError.message;
        if (nestedError.reason) return nestedError.reason;
    }

    // Check raw error data / message
    if (err.data && typeof err.data === 'string') {
        return `Execution reverted. Raw details: ${err.data}`;
    }

    return err.message || 'Transaction failed. Please try again.';
}
