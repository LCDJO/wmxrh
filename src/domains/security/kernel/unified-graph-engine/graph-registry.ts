/**
 * GraphRegistry — Central registry for all graph sources.
 * Each graph domain registers a provider function that returns nodes/edges.
 * 
 * IMPORTANT: Read-only. Never mutates source graphs.
 */

import type { GraphDomain, UnifiedNode, UnifiedEdge } from './types';

// ════════════════════════════════════
// REGISTRATION INPUT
// ════════════════════════════════════

export interface RegisterGraphInput {
  graph_id: string;
  graph_type: GraphDomain;
  source_service: string;
}

// ════════════════════════════════════
// GRAPH PROVIDER
// ════════════════════════════════════

export interface GraphProvider {
  domain: GraphDomain;
  /** Unique graph identifier */
  graphId: string;
  /** Human-readable name */
  name: string;
  /** Service that owns this graph */
  sourceService: string;
  /** Returns nodes and edges from this source graph */
  provide(): { nodes: UnifiedNode[]; edges: UnifiedEdge[] };
  /** Whether this provider is currently available (graph built) */
  isAvailable(): boolean;
}

// ════════════════════════════════════
// REGISTRY
// ════════════════════════════════════

class GraphRegistryImpl {
  private providers = new Map<string, GraphProvider>();
  private domainIndex = new Map<GraphDomain, Set<string>>();

  /**
   * Register a graph provider using the structured input.
   *
   * @example
   * graphRegistry.registerGraph({
   *   graph_id: 'platform_access_v1',
   *   graph_type: 'platform_access',
   *   source_service: 'PlatformAccessGraphService',
   * }, provider);
   */
  registerGraph(input: RegisterGraphInput, provider: Omit<GraphProvider, 'graphId' | 'domain' | 'sourceService'>): void {
    const full: GraphProvider = {
      ...provider,
      graphId: input.graph_id,
      domain: input.graph_type,
      sourceService: input.source_service,
    };
    this.providers.set(input.graph_id, full);

    if (!this.domainIndex.has(input.graph_type)) {
      this.domainIndex.set(input.graph_type, new Set());
    }
    this.domainIndex.get(input.graph_type)!.add(input.graph_id);
  }

  /** Legacy shorthand — derives graph_id from domain */
  register(provider: GraphProvider): void {
    const id = provider.graphId ?? provider.domain;
    this.providers.set(id, { ...provider, graphId: id, sourceService: provider.sourceService ?? provider.name });

    if (!this.domainIndex.has(provider.domain)) {
      this.domainIndex.set(provider.domain, new Set());
    }
    this.domainIndex.get(provider.domain)!.add(id);
  }

  unregister(domain: GraphDomain): void {
    const ids = this.domainIndex.get(domain);
    if (ids) {
      for (const id of ids) this.providers.delete(id);
      this.domainIndex.delete(domain);
    }
  }

  unregisterById(graphId: string): void {
    const provider = this.providers.get(graphId);
    if (provider) {
      this.providers.delete(graphId);
      this.domainIndex.get(provider.domain)?.delete(graphId);
    }
  }

  getProvider(domain: GraphDomain): GraphProvider | null {
    const ids = this.domainIndex.get(domain);
    if (!ids || ids.size === 0) return null;
    const firstId = ids.values().next().value;
    return firstId ? (this.providers.get(firstId) ?? null) : null;
  }

  getProviderById(graphId: string): GraphProvider | null {
    return this.providers.get(graphId) ?? null;
  }

  getProvidersByDomain(domain: GraphDomain): GraphProvider[] {
    const ids = this.domainIndex.get(domain);
    if (!ids) return [];
    return Array.from(ids).map(id => this.providers.get(id)!).filter(Boolean);
  }

  getAvailableProviders(): GraphProvider[] {
    return Array.from(this.providers.values()).filter(p => p.isAvailable());
  }

  getAllDomains(): GraphDomain[] {
    return Array.from(this.domainIndex.keys());
  }

  getRegisteredDomains(): GraphDomain[] {
    return Array.from(this.domainIndex.keys());
  }

  getRegisteredGraphs(): Array<{ graphId: string; domain: GraphDomain; sourceService: string; available: boolean }> {
    return Array.from(this.providers.values()).map(p => ({
      graphId: p.graphId,
      domain: p.domain,
      sourceService: p.sourceService,
      available: p.isAvailable(),
    }));
  }
}

export const graphRegistry = new GraphRegistryImpl();
