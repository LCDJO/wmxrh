/**
 * Self-Healing — Future Capability Stubs
 *
 * Preparation for upcoming features. These interfaces and placeholder
 * services define the contracts for:
 *
 *  1. Predictive Failure AI   — ML-based failure prediction
 *  2. Module Autoscaling      — Dynamic resource allocation per module
 *  3. Enterprise Tenant Priority — Prioritized healing for enterprise plans
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  SECURITY INVARIANT still applies:                               ║
 * ║  These features MUST NOT alter roles, permissions, or plans.     ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

// ════════════════════════════════════════════════════════════════
// 1. PREDICTIVE FAILURE AI
// ════════════════════════════════════════════════════════════════

export interface FailurePrediction {
  module_id: string;
  predicted_failure_type: string;
  confidence: number;            // 0-1
  estimated_time_to_failure_ms: number;
  recommended_preemptive_action: string;
  signals_used: string[];
  predicted_at: number;
}

export interface PredictiveFailureService {
  /** Analyze recent signals and predict upcoming failures. */
  predict(moduleId: string): Promise<FailurePrediction | null>;

  /** Get all active predictions. */
  getActivePredictions(): FailurePrediction[];

  /** Feed signal history for model training. */
  ingestTrainingData(signals: Array<{ type: string; module: string; timestamp: number }>): void;

  /** Whether the AI model is ready. */
  isReady(): boolean;
}

/** Placeholder — will connect to Lovable AI for real predictions. */
export class PredictiveFailureServiceStub implements PredictiveFailureService {
  async predict(_moduleId: string): Promise<FailurePrediction | null> {
    // TODO: Integrate with Lovable AI (google/gemini-3-flash-preview)
    // to analyze signal patterns and predict failures.
    return null;
  }

  getActivePredictions(): FailurePrediction[] { return []; }
  ingestTrainingData(): void { /* future */ }
  isReady(): boolean { return false; }
}

// ════════════════════════════════════════════════════════════════
// 2. MODULE AUTOSCALING
// ════════════════════════════════════════════════════════════════

export type ScaleDirection = 'up' | 'down' | 'none';

export interface AutoscaleDecision {
  module_id: string;
  direction: ScaleDirection;
  reason: string;
  current_load: number;          // 0-100
  target_capacity: number;       // abstract units
  decided_at: number;
}

export interface ModuleAutoscaler {
  /** Evaluate if a module needs scaling. */
  evaluate(moduleId: string): AutoscaleDecision;

  /** Apply a scaling decision (infrastructure-only, no permission changes). */
  apply(decision: AutoscaleDecision): Promise<boolean>;

  /** Current scaling config per module. */
  getConfig(moduleId: string): { min: number; max: number; current: number };

  /** Update scaling limits. */
  setLimits(moduleId: string, min: number, max: number): void;
}

/** Placeholder — autoscaling will be module-resource-aware. */
export class ModuleAutoscalerStub implements ModuleAutoscaler {
  evaluate(moduleId: string): AutoscaleDecision {
    return {
      module_id: moduleId,
      direction: 'none',
      reason: 'Autoscaling not yet active',
      current_load: 0,
      target_capacity: 1,
      decided_at: Date.now(),
    };
  }

  async apply(_decision: AutoscaleDecision): Promise<boolean> { return false; }
  getConfig(_moduleId: string) { return { min: 1, max: 1, current: 1 }; }
  setLimits(): void { /* future */ }
}

// ════════════════════════════════════════════════════════════════
// 3. ENTERPRISE TENANT PRIORITY
// ════════════════════════════════════════════════════════════════

export type TenantTier = 'free' | 'starter' | 'professional' | 'enterprise';

export interface TenantPriorityConfig {
  tenant_id: string;
  tier: TenantTier;
  priority_weight: number;       // 1-10, enterprise=10
  max_concurrent_recoveries: number;
  sla_recovery_target_ms: number;
}

export interface TenantPriorityService {
  /** Get priority config for a tenant. */
  getConfig(tenantId: string): TenantPriorityConfig;

  /** Rank incidents by tenant priority (enterprise first). */
  rankIncidents(incidentTenantPairs: Array<{ incident_id: string; tenant_id: string }>): string[];

  /** Whether a tenant should get preemptive healing. */
  shouldPreemptivelyHeal(tenantId: string): boolean;
}

/** Placeholder — will integrate with saas_plans table. */
export class TenantPriorityServiceStub implements TenantPriorityService {
  private readonly defaultConfig: Omit<TenantPriorityConfig, 'tenant_id'> = {
    tier: 'starter',
    priority_weight: 5,
    max_concurrent_recoveries: 2,
    sla_recovery_target_ms: 30_000,
  };

  getConfig(tenantId: string): TenantPriorityConfig {
    // TODO: Query saas_plans/experience_profiles (read-only) to resolve tier
    return { tenant_id: tenantId, ...this.defaultConfig };
  }

  rankIncidents(pairs: Array<{ incident_id: string; tenant_id: string }>): string[] {
    // No prioritization yet — return as-is
    return pairs.map(p => p.incident_id);
  }

  shouldPreemptivelyHeal(_tenantId: string): boolean {
    // TODO: Return true for enterprise tenants
    return false;
  }
}
