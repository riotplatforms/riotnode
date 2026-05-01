// Manage wallet connection data
export interface WalletConnection {
  walletAddress: string;
  connectedAt: number;
  lastSeen: number;
  connectionCount: number;
  walletType?: string;
  userAgent?: string;
}

const WALLET_CONNECTIONS_KEY = 'wallet_connections_map';

export const walletConnectionsManager = {
  // Save a new wallet connection
  saveConnection: (walletAddress: string, walletType?: string) => {
    if (!walletAddress) return;

    const normalizedAddress = walletAddress.toLowerCase();
    const connections = walletConnectionsManager.getConnections();
    const existingIndex = connections.findIndex(
      (c) => c.walletAddress.toLowerCase() === normalizedAddress
    );

    const now = Date.now();
    const connection: WalletConnection = {
      walletAddress: normalizedAddress,
      connectedAt: existingIndex >= 0 ? connections[existingIndex].connectedAt : now,
      lastSeen: now,
      connectionCount: existingIndex >= 0 ? connections[existingIndex].connectionCount + 1 : 1,
      walletType: walletType || 'unknown',
      userAgent: navigator.userAgent,
    };

    if (existingIndex >= 0) {
      connections[existingIndex] = connection;
    } else {
      connections.push(connection);
    }

    try {
      localStorage.setItem(WALLET_CONNECTIONS_KEY, JSON.stringify(connections));
    } catch (e) {
      console.error('Failed to save wallet connection:', e);
    }
  },

  // Get all connections
  getConnections: (): WalletConnection[] => {
    try {
      const data = localStorage.getItem(WALLET_CONNECTIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to parse wallet connections:', e);
      return [];
    }
  },

  // Get connection by wallet address
  getByWallet: (walletAddress: string): WalletConnection | null => {
    const connections = walletConnectionsManager.getConnections();
    return (
      connections.find(
        (c) => c.walletAddress.toLowerCase() === walletAddress.toLowerCase()
      ) || null
    );
  },

  // Update last seen time
  updateLastSeen: (walletAddress: string) => {
    const normalizedAddress = walletAddress.toLowerCase();
    const connections = walletConnectionsManager.getConnections();
    const existingIndex = connections.findIndex(
      (c) => c.walletAddress.toLowerCase() === normalizedAddress
    );

    if (existingIndex >= 0) {
      connections[existingIndex].lastSeen = Date.now();
      try {
        localStorage.setItem(WALLET_CONNECTIONS_KEY, JSON.stringify(connections));
      } catch (e) {
        console.error('Failed to update last seen:', e);
      }
    }
  },

  // Remove a connection
  removeConnection: (walletAddress: string) => {
    const connections = walletConnectionsManager.getConnections();
    const filtered = connections.filter(
      (c) => c.walletAddress.toLowerCase() !== walletAddress.toLowerCase()
    );
    try {
      localStorage.setItem(WALLET_CONNECTIONS_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.error('Failed to remove connection:', e);
    }
  },

  // Clear all connections
  clearAll: () => {
    try {
      localStorage.removeItem(WALLET_CONNECTIONS_KEY);
    } catch (e) {
      console.error('Failed to clear connections:', e);
    }
  },

  // Get recent connections (last 24 hours)
  getRecentConnections: (hours: number = 24): WalletConnection[] => {
    const connections = walletConnectionsManager.getConnections();
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return connections.filter(c => c.lastSeen > cutoff);
  },
};