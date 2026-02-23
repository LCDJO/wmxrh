/**
 * Multi-Network Configuration & Fallback Strategy
 *
 * Supports multiple blockchain networks with automatic failover.
 * When the primary network is unreachable, the system falls back
 * to the next available network in priority order.
 *
 * FUTURE: Replace simulated providers with real RPC endpoints.
 */

// ═══════════════════════════════════════════════════════
// NETWORK DEFINITIONS
// ═══════════════════════════════════════════════════════

export interface NetworkConfig {
  /** Unique network identifier */
  id: string;
  /** Display name */
  name: string;
  /** Chain ID (EVM) */
  chainId: number;
  /** RPC endpoint URL */
  rpcUrl: string;
  /** Block explorer base URL */
  explorerUrl: string;
  /** Explorer path template for tx — use {txHash} placeholder */
  explorerTxPath: string;
  /** Average block time in seconds */
  blockTimeSeconds: number;
  /** Whether this network is currently enabled */
  enabled: boolean;
  /** Priority for fallback (lower = higher priority) */
  priority: number;
  /** Cost per anchor in BRL (estimated) */
  costPerAnchorBrl: number;
  /** Network type */
  type: 'mainnet' | 'testnet' | 'simulated';
}

export const NETWORK_REGISTRY: Record<string, NetworkConfig> = {
  'simulated-polygon': {
    id: 'simulated-polygon',
    name: 'Polygon (Simulado)',
    chainId: 137,
    rpcUrl: 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
    explorerTxPath: '/tx/{txHash}',
    blockTimeSeconds: 2,
    enabled: true,
    priority: 1,
    costPerAnchorBrl: 0.12,
    type: 'simulated',
  },
  'polygon-mainnet': {
    id: 'polygon-mainnet',
    name: 'Polygon Mainnet',
    chainId: 137,
    rpcUrl: 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
    explorerTxPath: '/tx/{txHash}',
    blockTimeSeconds: 2,
    enabled: false, // Enable when real provider is connected
    priority: 2,
    costPerAnchorBrl: 0.08,
    type: 'mainnet',
  },
  'polygon-amoy': {
    id: 'polygon-amoy',
    name: 'Polygon Amoy (Testnet)',
    chainId: 80002,
    rpcUrl: 'https://rpc-amoy.polygon.technology',
    explorerUrl: 'https://amoy.polygonscan.com',
    explorerTxPath: '/tx/{txHash}',
    blockTimeSeconds: 2,
    enabled: false,
    priority: 3,
    costPerAnchorBrl: 0,
    type: 'testnet',
  },
  'ethereum-mainnet': {
    id: 'ethereum-mainnet',
    name: 'Ethereum Mainnet',
    chainId: 1,
    rpcUrl: 'https://eth.llamarpc.com',
    explorerUrl: 'https://etherscan.io',
    explorerTxPath: '/tx/{txHash}',
    blockTimeSeconds: 12,
    enabled: false,
    priority: 10,
    costPerAnchorBrl: 2.50,
    type: 'mainnet',
  },
};

// ═══════════════════════════════════════════════════════
// FALLBACK STRATEGY
// ═══════════════════════════════════════════════════════

export interface NetworkHealth {
  networkId: string;
  healthy: boolean;
  lastChecked: string;
  latencyMs?: number;
  errorMessage?: string;
}

/** In-memory health cache (edge function context) */
const healthCache = new Map<string, NetworkHealth>();

/**
 * Get the best available network based on priority and health.
 * Falls back to the next enabled network if primary is unhealthy.
 */
export function selectNetwork(preferredId?: string): NetworkConfig {
  const enabled = Object.values(NETWORK_REGISTRY)
    .filter((n) => n.enabled)
    .sort((a, b) => a.priority - b.priority);

  if (enabled.length === 0) {
    throw new Error('No blockchain networks are enabled');
  }

  // If preferred network is healthy, use it
  if (preferredId && NETWORK_REGISTRY[preferredId]?.enabled) {
    const health = healthCache.get(preferredId);
    if (!health || health.healthy) {
      return NETWORK_REGISTRY[preferredId];
    }
  }

  // Fallback: first healthy network by priority
  for (const network of enabled) {
    const health = healthCache.get(network.id);
    if (!health || health.healthy) {
      return network;
    }
  }

  // All unhealthy — use highest priority anyway
  return enabled[0];
}

/**
 * Update health status for a network (called after anchor attempt).
 */
export function updateNetworkHealth(
  networkId: string,
  healthy: boolean,
  latencyMs?: number,
  errorMessage?: string,
): void {
  healthCache.set(networkId, {
    networkId,
    healthy,
    lastChecked: new Date().toISOString(),
    latencyMs,
    errorMessage,
  });
}

/**
 * Get all network health statuses.
 */
export function getAllNetworkHealth(): NetworkHealth[] {
  return Object.keys(NETWORK_REGISTRY).map((id) => {
    const cached = healthCache.get(id);
    return cached ?? { networkId: id, healthy: true, lastChecked: new Date().toISOString() };
  });
}

/**
 * Build explorer URL for a transaction hash.
 */
export function buildExplorerUrl(networkId: string, txHash: string): string {
  const network = NETWORK_REGISTRY[networkId];
  if (!network) return '';
  return `${network.explorerUrl}${network.explorerTxPath.replace('{txHash}', txHash)}`;
}

/**
 * Get all enabled networks for display.
 */
export function getEnabledNetworks(): NetworkConfig[] {
  return Object.values(NETWORK_REGISTRY)
    .filter((n) => n.enabled)
    .sort((a, b) => a.priority - b.priority);
}
