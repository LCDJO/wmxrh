/**
 * RevenueOptimizationAdvisor — Recommends revenue-maximizing actions per tenant.
 */

import type { RevenueOptimization } from './types';

let _revSeq = 0;

interface TenantUsageSnapshot {
  tenant_id: string;
  tenant_name: string;
  current_plan: string;
  mrr: number;
  usage_pct: number;          // 0-100 of plan limits
  active_modules: number;
  total_modules: number;
  months_active: number;
  churn_risk_score: number;   // 0-100
}

function analyzeSnapshot(snap: TenantUsageSnapshot): RevenueOptimization | null {
  // High usage → upgrade recommendation
  if (snap.usage_pct >= 75 && snap.current_plan !== 'enterprise') {
    return {
      id: `rev_${++_revSeq}`,
      tenant_id: snap.tenant_id,
      tenant_name: snap.tenant_name,
      current_plan: snap.current_plan,
      recommended_action: 'upgrade',
      estimated_mrr_impact: snap.mrr * 0.4,
      confidence: Math.min(95, snap.usage_pct),
      reasoning: `Uso em ${snap.usage_pct}% do limite do plano. Upgrade evitaria throttling e desbloquearia funcionalidades.`,
      created_at: new Date().toISOString(),
    };
  }

  // Low module adoption → cross-sell
  if (snap.active_modules / snap.total_modules < 0.4 && snap.months_active >= 3) {
    return {
      id: `rev_${++_revSeq}`,
      tenant_id: snap.tenant_id,
      tenant_name: snap.tenant_name,
      current_plan: snap.current_plan,
      recommended_action: 'cross_sell',
      estimated_mrr_impact: snap.mrr * 0.2,
      confidence: 65,
      reasoning: `Apenas ${snap.active_modules}/${snap.total_modules} módulos ativos após ${snap.months_active} meses. Oportunidade de ativação.`,
      created_at: new Date().toISOString(),
    };
  }

  // High churn risk → retention offer
  if (snap.churn_risk_score >= 60) {
    return {
      id: `rev_${++_revSeq}`,
      tenant_id: snap.tenant_id,
      tenant_name: snap.tenant_name,
      current_plan: snap.current_plan,
      recommended_action: 'retention_offer',
      estimated_mrr_impact: -snap.mrr * 0.1,
      confidence: snap.churn_risk_score,
      reasoning: `Risco de churn em ${snap.churn_risk_score}%. Oferta de retenção pode preservar MRR de R$${snap.mrr.toFixed(2)}.`,
      created_at: new Date().toISOString(),
    };
  }

  return null;
}

export const RevenueOptimizationAdvisor = {
  /** Analyze tenant snapshots and generate optimizations */
  analyze(snapshots: TenantUsageSnapshot[]): RevenueOptimization[] {
    return snapshots.map(analyzeSnapshot).filter(Boolean) as RevenueOptimization[];
  },

  /** Quick analysis with mock data for dashboard preview */
  generatePreview(): RevenueOptimization[] {
    const mockSnapshots: TenantUsageSnapshot[] = [
      { tenant_id: 't1', tenant_name: 'Empresa Alpha', current_plan: 'professional', mrr: 499, usage_pct: 82, active_modules: 8, total_modules: 13, months_active: 6, churn_risk_score: 15 },
      { tenant_id: 't2', tenant_name: 'Corp Beta', current_plan: 'starter', mrr: 199, usage_pct: 45, active_modules: 3, total_modules: 13, months_active: 8, churn_risk_score: 25 },
      { tenant_id: 't3', tenant_name: 'Grupo Gamma', current_plan: 'professional', mrr: 799, usage_pct: 30, active_modules: 5, total_modules: 13, months_active: 12, churn_risk_score: 72 },
    ];
    return RevenueOptimizationAdvisor.analyze(mockSnapshots);
  },
};
