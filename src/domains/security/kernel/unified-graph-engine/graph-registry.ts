/**
 * GraphRegistry — Central registry for all graph sources.
 * Each graph domain registers a provider function that returns nodes/edges.
 * 
 * IMPORTANT: Read-only. Never mutates source graphs.
 */

import type { GraphDomain, UnifiedNode, UnifiedEdge } from './types';

export interface GraphProvider {
  domain: GraphDomain;
  /** Human-readable name */
  name: string;
  /** Returns nodes and edges from this source graph */
  provide(): { nodes: UnifiedNode[]; edges: UnifiedEdge[] };
  /** Whether this provider is currently available (graph built) */
  isAvailable(): boolean;
}

class GraphRegistryImpl {
  private providers = new Map<GraphDomain, GraphProvider>();

  register(provider: GraphProvider): void {
    this.providers.set(provider.domain, provider);
  }

  unregister(domain: GraphDomain): void {
    this.providers.delete(domain);
  }

  getProvider(domain: GraphDomain): GraphProvider | null {
    return this.providers.get(domain) ?? null;
  }

  getAvailableProviders(): GraphProvider[] {
    return Array.from(this.providers.values()).filter(p => p.isAvailable());
  }

  getAllDomains(): GraphDomain[] {
    return Array.from(this.providers.keys());
  }

  getRegisteredDomains(): GraphDomain[] {
    return Array.from(this.providers.keys());
  }
}

export const graphRegistry = new GraphRegistryImpl();
