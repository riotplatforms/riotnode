export const ADMIN_WALLETS = [
    '0x6bc0CE568a12CB0C17576dCdE9a0Cef345B30447'
].map(a => a.toLowerCase());

export const isAdmin = (address: string | undefined | null) => {
    if (!address) return false;
    const cleanAddr = address.trim().toLowerCase();
    return ADMIN_WALLETS.includes(cleanAddr);
};

export const PRIMARY_ADMIN = ADMIN_WALLETS[0];
