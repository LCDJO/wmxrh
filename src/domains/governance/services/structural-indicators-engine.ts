/**
 * Structural Indicators Engine
 *
 * Computes four core organizational health metrics:
 *   1. TurnoverRiskScore    — Likelihood of elevated turnover
 *   2. StabilityIndex       — Workforce tenure & retention health
 *   3. LegalExposureIndex   — Accumulated legal/disciplinary liability
 *   4. OrganizationalRiskMap — Composite risk across all dimensions
 *
 * All scoring weights are tenant-configurable via `org_indicator_configs`.
 * Snapshots are persisted to `org_indicator_snapshots` for time-series analysis.
 */

import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

export type IndicatorType = 'turnover_risk' | 'stability' | 'legal_exposure' | 'org_risk_map';

export interface IndicatorWeights {
  [factor: string]: number;
}

export interface IndicatorThresholds {
  low: number;
  medium: number;
  high: number;
  critical: number;
}

export interface IndicatorConfig {
  id: string;
  tenant_id: string;
  indicator_type: IndicatorType;
  weights: IndicatorWeights;
  thresholds: IndicatorThresholds;
  is_active: boolean;
}

export interface IndicatorResult {
  indicator_type: IndicatorType;
  score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  components: Record<string, number>;
  computed_at: string;
}

// ══════════════════════════════════════════════
// DEFAULT WEIGHTS & THRESHOLDS
// ══════════════════════════════════════════════

const DEFAULT_CONFIGS: Record<IndicatorType, { weights: IndicatorWeights; thresholds: IndicatorThresholds }> = {
  turnover_risk: {
    weights: {
      recent_terminations: 30,
      voluntary_ratio: 25,
      avg_tenure_months: 20,
      warning_density: 15,
      open_positions_ratio: 10,
    },
    thresholds: { low: 25, medium: 50, high: 75, critical: 90 },
  },
  stability: {
    weights: {
      avg_tenure_months: 30,
      retention_rate_12m: 25,
      promotion_rate: 15,
      internal_mobility: 15,
      satisfaction_score: 15,
    },
    thresholds: { low: 75, medium: 50, high: 30, critical: 15 },
  },
  legal_exposure: {
    weights: {
      active_sanctions: 25,
      contested_sanctions: 20,
      pending_decisions: 15,
      overdue_policies: 15,
      unaccepted_policies: 15,
      recent_legal_events: 10,
    },
    thresholds: { low: 20, medium: 45, high: 70, critical: 85 },
  },
  org_risk_map: {
    weights: {
      turnover_risk_score: 30,
      legal_exposure_score: 30,
      stability_index_inverse: 25,
      dept_risk_variance: 15,
    },
    thresholds: { low: 25, medium: 50, high: 70, critical: 85 },
  },
};

// ══════════════════════════════════════════════
// CONFIG MANAGEMENT
// ══════════════════════════════════════════════

export class IndicatorConfigManager {
  /**
   * Load tenant config, falling back to defaults.
   */
  async getConfig(tenantId: string, indicatorType: IndicatorType): Promise<{ weights: IndicatorWeights; thresholds: IndicatorThresholds }> {
    const { data } = await supabase
      .from('org_indicator_configs')
      .select('weights, thresholds')
      .eq('tenant_id', tenantId)
      .eq('indicator_type', indicatorType)
      .eq('is_active', true)
      .maybeSingle();

    if (data) {
      return {
        weights: data.weights as unknown as IndicatorWeights,
        thresholds: data.thresholds as unknown as IndicatorThresholds,
      };
    }
    return DEFAULT_CONFIGS[indicatorType];
  }

  /**
   * Upsert tenant-specific weights/thresholds.
   */
  async saveConfig(
    tenantId: string,
    indicatorType: IndicatorType,
    weights: IndicatorWeights,
    thresholds: IndicatorThresholds,
    createdBy?: string,
  ): Promise<void> {
    const { error } = await supabase
      .from('org_indicator_configs')
      .upsert({
        tenant_id: tenantId,
        indicator_type: indicatorType,
        weights: weights as unknown as Json,
        thresholds: thresholds as unknown as Json,
        is_active: true,
        created_by: createdBy ?? null,
      }, { onConflict: 'tenant_id,indicator_type' });

    if (error) throw new Error(`[StructuralIndicators] Config save failed: ${error.message}`);
  }

  /**
   * List all configs for a tenant.
   */
  async listConfigs(tenantId: string): Promise<IndicatorConfig[]> {
    const { data, error } = await supabase
      .from('org_indicator_configs')
      .select('*')
      .eq('tenant_id', tenantId);

    if (error) throw new Error(`[StructuralIndicators] Config list failed: ${error.message}`);
    return (data ?? []) as unknown as IndicatorConfig[];
  }

  /**
   * Reset to defaults by deactivating tenant override.
   */
  async resetToDefaults(tenantId: string, indicatorType: IndicatorType): Promise<void> {
    await supabase
      .from('org_indicator_configs')
      .update({ is_active: false })
      .eq('tenant_id', tenantId)
      .eq('indicator_type', indicatorType);
  }
}

// ══════════════════════════════════════════════
// SCORING ENGINE
// ══════════════════════════════════════════════

function classifyRisk(score: number, thresholds: IndicatorThresholds, inverted = false): 'low' | 'medium' | 'high' | 'critical' {
  if (inverted) {
    // StabilityIndex: higher score = better
    if (score >= thresholds.low) return 'low';
    if (score >= thresholds.medium) return 'medium';
    if (score >= thresholds.high) return 'high';
    return 'critical';
  }
  // Normal: higher score = worse
  if (score >= thresholds.critical) return 'critical';
  if (score >= thresholds.high) return 'high';
  if (score >= thresholds.medium) return 'medium';
  return 'low';
}

function weightedScore(components: Record<string, number>, weights: IndicatorWeights): number {
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return 0;

  let score = 0;
  for (const [factor, weight] of Object.entries(weights)) {
    const value = components[factor] ?? 0;
    score += (value * weight) / totalWeight;
  }
  return Math.min(100, Math.max(0, Math.round(score * 100) / 100));
}

// ══════════════════════════════════════════════
// STRUCTURAL INDICATORS ENGINE
// ══════════════════════════════════════════════

export class StructuralIndicatorsEngine {
  private configManager = new IndicatorConfigManager();

  // ── TurnoverRiskScore ──

  async computeTurnoverRisk(tenantId: string, inputs: {
    recent_terminations: number;
    total_employees: number;
    voluntary_terminations: number;
    total_terminations: number;
    avg_tenure_months: number;
    warning_count_30d: number;
    open_positions: number;
  }): Promise<IndicatorResult> {
    const config = await this.configManager.getConfig(tenantId, 'turnover_risk');

    const components: Record<string, number> = {
      recent_terminations: inputs.total_employees > 0
        ? Math.min(1, inputs.recent_terminations / Math.max(1, inputs.total_employees * 0.1))
        : 0,
      voluntary_ratio: inputs.total_terminations > 0
        ? inputs.voluntary_terminations / inputs.total_terminations
        : 0,
      avg_tenure_months: Math.max(0, 1 - (inputs.avg_tenure_months / 60)),
      warning_density: inputs.total_employees > 0
        ? Math.min(1, inputs.warning_count_30d / Math.max(1, inputs.total_employees * 0.05))
        : 0,
      open_positions_ratio: inputs.total_employees > 0
        ? Math.min(1, inputs.open_positions / Math.max(1, inputs.total_employees * 0.15))
        : 0,
    };

    const score = weightedScore(components, config.weights);
    return {
      indicator_type: 'turnover_risk',
      score,
      risk_level: classifyRisk(score, config.thresholds),
      components,
      computed_at: new Date().toISOString(),
    };
  }

  // ── StabilityIndex ──

  async computeStability(tenantId: string, inputs: {
    avg_tenure_months: number;
    retention_rate_12m: number;
    promotions_12m: number;
    total_employees: number;
    internal_transfers_12m: number;
    satisfaction_score: number; // 0-1
  }): Promise<IndicatorResult> {
    const config = await this.configManager.getConfig(tenantId, 'stability');

    const components: Record<string, number> = {
      avg_tenure_months: Math.min(1, inputs.avg_tenure_months / 48),
      retention_rate_12m: inputs.retention_rate_12m,
      promotion_rate: inputs.total_employees > 0
        ? Math.min(1, inputs.promotions_12m / (inputs.total_employees * 0.1))
        : 0,
      internal_mobility: inputs.total_employees > 0
        ? Math.min(1, inputs.internal_transfers_12m / (inputs.total_employees * 0.05))
        : 0,
      satisfaction_score: inputs.satisfaction_score,
    };

    const score = weightedScore(components, config.weights);
    return {
      indicator_type: 'stability',
      score,
      risk_level: classifyRisk(score, config.thresholds, true),
      components,
      computed_at: new Date().toISOString(),
    };
  }

  // ── LegalExposureIndex ──

  async computeLegalExposure(tenantId: string, inputs: {
    active_sanctions: number;
    contested_sanctions: number;
    pending_decisions: number;
    overdue_policies: number;
    unaccepted_policies: number;
    recent_legal_events_30d: number;
    total_employees: number;
  }): Promise<IndicatorResult> {
    const config = await this.configManager.getConfig(tenantId, 'legal_exposure');
    const emp = Math.max(1, inputs.total_employees);

    const components: Record<string, number> = {
      active_sanctions: Math.min(1, inputs.active_sanctions / (emp * 0.05)),
      contested_sanctions: Math.min(1, inputs.contested_sanctions / Math.max(1, inputs.active_sanctions)),
      pending_decisions: Math.min(1, inputs.pending_decisions / (emp * 0.02)),
      overdue_policies: Math.min(1, inputs.overdue_policies / 5),
      unaccepted_policies: Math.min(1, inputs.unaccepted_policies / (emp * 0.1)),
      recent_legal_events: Math.min(1, inputs.recent_legal_events_30d / (emp * 0.03)),
    };

    const score = weightedScore(components, config.weights);
    return {
      indicator_type: 'legal_exposure',
      score,
      risk_level: classifyRisk(score, config.thresholds),
      components,
      computed_at: new Date().toISOString(),
    };
  }

  // ── OrganizationalRiskMap (composite) ──

  async computeOrgRiskMap(tenantId: string, subScores: {
    turnover_risk_score: number;
    stability_index: number;
    legal_exposure_score: number;
    dept_risk_scores: number[];
  }): Promise<IndicatorResult> {
    const config = await this.configManager.getConfig(tenantId, 'org_risk_map');

    const deptScores = subScores.dept_risk_scores;
    const mean = deptScores.length > 0 ? deptScores.reduce((a, b) => a + b, 0) / deptScores.length : 0;
    const variance = deptScores.length > 1
      ? Math.sqrt(deptScores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / deptScores.length) / 100
      : 0;

    const components: Record<string, number> = {
      turnover_risk_score: subScores.turnover_risk_score / 100,
      legal_exposure_score: subScores.legal_exposure_score / 100,
      stability_index_inverse: 1 - (subScores.stability_index / 100),
      dept_risk_variance: Math.min(1, variance * 3),
    };

    const score = weightedScore(components, config.weights);
    return {
      indicator_type: 'org_risk_map',
      score,
      risk_level: classifyRisk(score, config.thresholds),
      components,
      computed_at: new Date().toISOString(),
    };
  }

  // ── Full computation + persistence ──

  async computeAndPersistAll(tenantId: string, inputs: {
    turnover: Parameters<StructuralIndicatorsEngine['computeTurnoverRisk']>[1];
    stability: Parameters<StructuralIndicatorsEngine['computeStability']>[1];
    legal: Parameters<StructuralIndicatorsEngine['computeLegalExposure']>[1];
    dept_risk_scores: number[];
  }): Promise<IndicatorResult[]> {
    const [turnover, stability, legal] = await Promise.all([
      this.computeTurnoverRisk(tenantId, inputs.turnover),
      this.computeStability(tenantId, inputs.stability),
      this.computeLegalExposure(tenantId, inputs.legal),
    ]);

    const orgRisk = await this.computeOrgRiskMap(tenantId, {
      turnover_risk_score: turnover.score,
      stability_index: stability.score,
      legal_exposure_score: legal.score,
      dept_risk_scores: inputs.dept_risk_scores,
    });

    const results = [turnover, stability, legal, orgRisk];
    const now = new Date().toISOString();
    const periodStart = new Date(Date.now() - 30 * 86400000).toISOString();

    // Persist all snapshots
    const { error } = await supabase
      .from('org_indicator_snapshots')
      .insert(results.map(r => ({
        tenant_id: tenantId,
        indicator_type: r.indicator_type,
        score: r.score,
        components: r.components as unknown as Json,
        risk_level: r.risk_level,
        period_start: periodStart,
        period_end: now,
        computed_at: now,
      })));

    if (error) console.error('[StructuralIndicators] Snapshot persist failed:', error.message);

    return results;
  }

  // ── Query historical snapshots ──

  async getLatest(tenantId: string, indicatorType: IndicatorType): Promise<IndicatorResult | null> {
    const { data } = await supabase
      .from('org_indicator_snapshots')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('indicator_type', indicatorType)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return null;
    return {
      indicator_type: data.indicator_type as IndicatorType,
      score: Number(data.score),
      risk_level: data.risk_level as IndicatorResult['risk_level'],
      components: data.components as unknown as Record<string, number>,
      computed_at: data.computed_at,
    };
  }

  async getTrend(tenantId: string, indicatorType: IndicatorType, limit = 12): Promise<IndicatorResult[]> {
    const { data } = await supabase
      .from('org_indicator_snapshots')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('indicator_type', indicatorType)
      .order('computed_at', { ascending: true })
      .limit(limit);

    return (data ?? []).map(d => ({
      indicator_type: d.indicator_type as IndicatorType,
      score: Number(d.score),
      risk_level: d.risk_level as IndicatorResult['risk_level'],
      components: d.components as unknown as Record<string, number>,
      computed_at: d.computed_at,
    }));
  }

  async getDashboard(tenantId: string): Promise<Record<IndicatorType, IndicatorResult | null>> {
    const types: IndicatorType[] = ['turnover_risk', 'stability', 'legal_exposure', 'org_risk_map'];
    const results = await Promise.all(types.map(t => this.getLatest(tenantId, t)));
    return Object.fromEntries(types.map((t, i) => [t, results[i]])) as Record<IndicatorType, IndicatorResult | null>;
  }
}

// ── Singleton ──

let _instance: StructuralIndicatorsEngine | null = null;

export function getStructuralIndicatorsEngine(): StructuralIndicatorsEngine {
  if (!_instance) _instance = new StructuralIndicatorsEngine();
  return _instance;
}

let _configInstance: IndicatorConfigManager | null = null;

export function getIndicatorConfigManager(): IndicatorConfigManager {
  if (!_configInstance) _configInstance = new IndicatorConfigManager();
  return _configInstance;
}
