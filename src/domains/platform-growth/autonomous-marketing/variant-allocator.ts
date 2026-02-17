/**
 * VariantAllocator — Deterministic, sticky variant assignment for visitors.
 * Uses hashing for consistent allocation across sessions.
 */
import type { ABExperiment, ExperimentId, VariantId, TrafficAllocation } from './types';
import { abTestingManager } from './ab-testing-manager';

class VariantAllocator {
  private allocations: Map<string, TrafficAllocation> = new Map();

  /** Allocate a visitor to a variant (sticky — same visitor always gets same variant) */
  allocate(visitorId: string, experimentId: ExperimentId): TrafficAllocation {
    const key = `${visitorId}:${experimentId}`;
    const existing = this.allocations.get(key);
    if (existing) return existing;

    const experiment = abTestingManager.getExperiment(experimentId);
    if (experiment.status !== 'running') {
      throw new Error(`Experiment ${experimentId} is not running`);
    }

    const variantId = this.selectVariant(visitorId, experiment);
    const allocation: TrafficAllocation = {
      visitorId,
      experimentId,
      variantId,
      allocatedAt: new Date().toISOString(),
      sticky: true,
    };

    this.allocations.set(key, allocation);
    return allocation;
  }

  /** Get existing allocation for a visitor */
  getAllocation(visitorId: string, experimentId: ExperimentId): TrafficAllocation | null {
    return this.allocations.get(`${visitorId}:${experimentId}`) || null;
  }

  /** Bulk allocations report */
  getAllocationsForExperiment(experimentId: ExperimentId): TrafficAllocation[] {
    return Array.from(this.allocations.values())
      .filter(a => a.experimentId === experimentId);
  }

  // ── Private ──

  /** Deterministic hash-based variant selection */
  private selectVariant(visitorId: string, experiment: ABExperiment): VariantId {
    const hash = this.simpleHash(`${visitorId}:${experiment.id}`);
    const bucket = hash % 100;

    let cumulative = 0;
    for (const variant of experiment.variants) {
      cumulative += variant.weight;
      if (bucket < cumulative) return variant.id;
    }

    return experiment.variants[0].id; // fallback to control
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash);
  }
}

export const variantAllocator = new VariantAllocator();
export { VariantAllocator };
