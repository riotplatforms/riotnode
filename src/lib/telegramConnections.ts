// Manage persistent Telegram connection data
export interface TelegramConnection {
  walletAddress: string;
  telegramId: number;
  username: string;
  firstName: string;
  lastName?: string;
  isPremium: boolean;
  connectedAt: number;
}

const TELEGRAM_CONNECTIONS_KEY = 'telegram_connections_map';

export const telegramConnectionsManager = {
  // Save a new Telegram connection
  saveConnection: (walletAddress: string, telegramUser: any) => {
    if (!walletAddress || !telegramUser?.id) return;

    const normalizedAddress = walletAddress.toLowerCase();
    const connections = telegramConnectionsManager.getConnections();
    
    // Check if this wallet already has a connection
    const existingIndex = connections.findIndex(
      (c) => c.walletAddress.toLowerCase() === normalizedAddress
    );

    const connection: TelegramConnection = {
      walletAddress: normalizedAddress,
      telegramId: telegramUser.id,
      username: telegramUser.username || '',
      firstName: telegramUser.first_name || '',
      lastName: telegramUser.last_name || '',
      isPremium: telegramUser.is_premium || false,
      connectedAt: Date.now(),
    };

    if (existingIndex >= 0) {
      connections[existingIndex] = connection;
    } else {
      connections.push(connection);
    }

    try {
      localStorage.setItem(TELEGRAM_CONNECTIONS_KEY, JSON.stringify(connections));
    } catch (e) {
      console.error('Failed to save telegram connection:', e);
    }
  },

  // Get all connections
  getConnections: (): TelegramConnection[] => {
    try {
      const data = localStorage.getItem(TELEGRAM_CONNECTIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to parse telegram connections:', e);
      return [];
    }
  },

  // Get connection by wallet address
  getByWallet: (walletAddress: string): TelegramConnection | null => {
    const connections = telegramConnectionsManager.getConnections();
    return (
      connections.find(
        (c) => c.walletAddress.toLowerCase() === walletAddress.toLowerCase()
      ) || null
    );
  },

  // Get connection by Telegram ID
  getByTelegramId: (telegramId: number): TelegramConnection | null => {
    const connections = telegramConnectionsManager.getConnections();
    return connections.find((c) => c.telegramId === telegramId) || null;
  },

  // Remove a connection
  removeConnection: (walletAddress: string) => {
    const connections = telegramConnectionsManager.getConnections();
    const filtered = connections.filter(
      (c) => c.walletAddress.toLowerCase() !== walletAddress.toLowerCase()
    );
    try {
      localStorage.setItem(TELEGRAM_CONNECTIONS_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.error('Failed to remove connection:', e);
    }
  },

  // Clear all connections
  clearAll: () => {
    try {
      localStorage.removeItem(TELEGRAM_CONNECTIONS_KEY);
    } catch (e) {
      console.error('Failed to clear connections:', e);
    }
  },
};
