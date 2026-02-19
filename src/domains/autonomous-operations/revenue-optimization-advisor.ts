/**
 * RevenueOptimizationAdvisor — Revenue-maximizing recommendations per tenant.
 *
 * Uses real data from:
 *  - RevenueIntelligenceEngine (MRR, churn scores, upgrade candidates)
 *  - BillingCore coupon/redemption tables
 *
 * Generates insights:
 *  - Tenants prontos para upgrade (usage ≥ 60% do plano)
 *  - Planos subutilizados (baixa adoção de módulos)
 *  - Cupons com baixo ROI (alta redenção mas baixa conversão em receita)
 *  - Retenção proativa (alto churn risk)
 */

import type { RevenueOptimization } from './types';
import { getRevenueIntelligenceEngine } from '@/domains/revenue-intelligence';
import type {
  RevenueMetrics,
  ChurnRiskTenant,
  UpgradeCandidate,
} from '@/domains/revenue-intelligence';
import { supabase } from '@/integrations/supabase/client';

let _revSeq = 0;
const now = () => new Date().toISOString();

// ══════════════════════════════════════════════
// Insight: Tenants prontos para upgrade
// ══════════════════════════════════════════════

function insightsFromUpgradeCandidates(candidates: UpgradeCandidate[]): RevenueOptimization[] {
  return candidates
    .filter(c => c.usage_pct >= 60)
    .map(c => ({
      id: `rev_${++_revSeq}`,
      tenant_id: c.tenant_id,
      tenant_name: c.tenant_name,
      current_plan: c.current_plan,
      recommended_action: 'upgrade' as const,
      estimated_mrr_impact: c.potential_uplift_brl,
      confidence: Math.min(95, Math.round(c.usage_pct * 1.1)),
      reasoning: `Uso em ${c.usage_pct}% do limite do plano "${c.current_plan}". Sinais: ${c.signals.join('; ')}. Plano recomendado: ${c.recommended_plan}.`,
      created_at: now(),
    }));
}

// ══════════════════════════════════════════════
// Insight: Retenção proativa (churn risk)
// ══════════════════════════════════════════════

function insightsFromChurnRisk(atRisk: ChurnRiskTenant[]): RevenueOptimization[] {
  return atRisk
    .filter(t => t.risk_score >= 50)
    .map(t => ({
      id: `rev_${++_revSeq}`,
      tenant_id: t.tenant_id,
      tenant_name: t.tenant_name,
      current_plan: t.plan_name,
      recommended_action: 'retention_offer' as const,
      estimated_mrr_impact: -t.mrr_at_risk * 0.15, // cost of retention discount
      confidence: t.risk_score,
      reasoning: `Risco de churn em ${t.risk_score}%. MRR em risco: R$${t.mrr_at_risk.toFixed(2)}. Fatores: ${t.risk_factors.slice(0, 3).join('; ')}. Ação: ${t.recommended_action}.`,
      created_at: now(),
    }));
}

// ══════════════════════════════════════════════
// Insight: Planos subutilizados
// ══════════════════════════════════════════════

function insightsFromUnderutilizedPlans(
  metrics: RevenueMetrics,
  candidates: UpgradeCandidate[],
): RevenueOptimization[] {
  const optimizations: RevenueOptimization[] = [];

  // Tenants with very low usage on expensive plans → potential downgrade or cross-sell
  const lowUsage = candidates.filter(c => c.usage_pct < 30);

  for (const c of lowUsage) {
    optimizations.push({
      id: `rev_${++_revSeq}`,
      tenant_id: c.tenant_id,
      tenant_name: c.tenant_name,
      current_plan: c.current_plan,
      recommended_action: 'cross_sell' as const,
      estimated_mrr_impact: c.potential_uplift_brl * 0.3,
      confidence: Math.max(50, 80 - c.usage_pct),
      reasoning: `Plano "${c.current_plan}" subutilizado (${c.usage_pct}% de uso). Oportunidade de ativar módulos adicionais ou realocar para plano mais adequado.`,
      created_at: now(),
    });
  }

  // Plans with few tenants relative to revenue contribution
  for (const plan of metrics.revenue_by_plan) {
    if (plan.tenants <= 1 && plan.mrr < metrics.mrr * 0.05) {
      optimizations.push({
        id: `rev_${++_revSeq}`,
        tenant_id: '',
        tenant_name: `Plano: ${plan.plan_name}`,
        current_plan: plan.plan_name,
        recommended_action: 'increase_usage' as const,
        estimated_mrr_impact: plan.mrr * 0.5,
        confidence: 55,
        reasoning: `Plano "${plan.plan_name}" possui apenas ${plan.tenants} tenant(s) e contribui com ${((plan.mrr / Math.max(metrics.mrr, 1)) * 100).toFixed(1)}% do MRR total. Considerar estratégia de aquisição ou consolidação.`,
        created_at: now(),
      });
    }
  }

  return optimizations;
}

// ══════════════════════════════════════════════
// Insight: Cupons com baixo ROI
// ══════════════════════════════════════════════

interface CouponROIData {
  coupon_id: string;
  coupon_code: string;
  coupon_name: string;
  discount_type: string;
  discount_value: number;
  total_redemptions: number;
  total_discount_given: number;
  status: string;
}

async function fetchCouponROIData(): Promise<CouponROIData[]> {
  try {
    const { data: coupons } = await supabase
      .from('coupons')
      .select('id, code, name, discount_type, discount_value, current_redemptions, status')
      .in('status', ['active', 'expired']);

    if (!coupons || coupons.length === 0) return [];

    const couponIds = coupons.map(c => c.id);

    const { data: redemptions } = await supabase
      .from('coupon_redemptions')
      .select('coupon_id, discount_applied_brl')
      .in('coupon_id', couponIds);

    const redeemMap: Record<string, number> = {};
    for (const r of (redemptions || [])) {
      redeemMap[r.coupon_id] = (redeemMap[r.coupon_id] || 0) + (r.discount_applied_brl || 0);
    }

    return coupons.map(c => ({
      coupon_id: c.id,
      coupon_code: c.code,
      coupon_name: c.name,
      discount_type: c.discount_type,
      discount_value: c.discount_value,
      total_redemptions: c.current_redemptions || 0,
      total_discount_given: redeemMap[c.id] || 0,
      status: c.status,
    }));
  } catch (err) {
    console.warn('[RevenueOptimizationAdvisor] Failed to fetch coupon data:', err);
    return [];
  }
}

function insightsFromCouponROI(coupons: CouponROIData[], metrics: RevenueMetrics): RevenueOptimization[] {
  const optimizations: RevenueOptimization[] = [];

  for (const c of coupons) {
    // High discount given with many redemptions but low conversion to revenue
    const discountToMRRRatio = c.total_discount_given / Math.max(metrics.mrr, 1);

    // Coupon giving away > 5% of MRR with limited apparent return
    if (discountToMRRRatio > 0.05 && c.total_redemptions >= 2) {
      optimizations.push({
        id: `rev_${++_revSeq}`,
        tenant_id: '',
        tenant_name: `Cupom: ${c.coupon_code}`,
        current_plan: c.coupon_name,
        recommended_action: 'increase_usage' as const,
        estimated_mrr_impact: -c.total_discount_given * 0.5,
        confidence: Math.min(80, 40 + c.total_redemptions * 5),
        reasoning: `Cupom "${c.coupon_code}" (${c.discount_type}: ${c.discount_value}) teve ${c.total_redemptions} redenções totalizando R$${c.total_discount_given.toFixed(2)} em desconto (${(discountToMRRRatio * 100).toFixed(1)}% do MRR). ROI baixo — considerar desativação ou ajuste de condições.`,
        created_at: now(),
      });
    }

    // Expired coupons with zero redemptions → wasted effort
    if (c.status === 'expired' && c.total_redemptions === 0) {
      optimizations.push({
        id: `rev_${++_revSeq}`,
        tenant_id: '',
        tenant_name: `Cupom: ${c.coupon_code}`,
        current_plan: c.coupon_name,
        recommended_action: 'increase_usage' as const,
        estimated_mrr_impact: 0,
        confidence: 60,
        reasoning: `Cupom "${c.coupon_code}" expirou sem nenhuma redenção. Considerar melhorar divulgação ou ajustar condições de elegibilidade em futuras campanhas.`,
        created_at: now(),
      });
    }
  }

  return optimizations;
}

// ══════════════════════════════════════════════
// Public API
// ══════════════════════════════════════════════

export const RevenueOptimizationAdvisor = {
  /**
   * Full async analysis using RevenueIntelligenceEngine + BillingCore coupons.
   * Returns all revenue optimization insights.
   */
  async analyzeFromEngine(): Promise<RevenueOptimization[]> {
    const engine = getRevenueIntelligenceEngine();

    const [metrics, atRisk, candidates, couponData] = await Promise.all([
      engine.analyzer.getMetrics(),
      engine.churn.getAtRiskTenants(),
      engine.upgrade.getCandidates(),
      fetchCouponROIData(),
    ]);

    const optimizations: RevenueOptimization[] = [
      ...insightsFromUpgradeCandidates(candidates),
      ...insightsFromChurnRisk(atRisk),
      ...insightsFromUnderutilizedPlans(metrics, candidates),
      ...insightsFromCouponROI(couponData, metrics),
    ];

    // Sort by confidence descending
    return optimizations.sort((a, b) => b.confidence - a.confidence);
  },

  /**
   * Synchronous analysis from pre-fetched snapshots (backward-compatible).
   */
  analyze(snapshots: { tenant_id: string; tenant_name: string; current_plan: string; mrr: number; usage_pct: number; active_modules: number; total_modules: number; months_active: number; churn_risk_score: number }[]): RevenueOptimization[] {
    const results: RevenueOptimization[] = [];

    for (const snap of snapshots) {
      if (snap.usage_pct >= 60 && snap.current_plan !== 'enterprise') {
        results.push({
          id: `rev_${++_revSeq}`,
          tenant_id: snap.tenant_id,
          tenant_name: snap.tenant_name,
          current_plan: snap.current_plan,
          recommended_action: 'upgrade',
          estimated_mrr_impact: snap.mrr * 0.4,
          confidence: Math.min(95, Math.round(snap.usage_pct * 1.1)),
          reasoning: `Uso em ${snap.usage_pct}% do limite. Upgrade evitaria throttling.`,
          created_at: now(),
        });
      }

      if (snap.active_modules / snap.total_modules < 0.4 && snap.months_active >= 3) {
        results.push({
          id: `rev_${++_revSeq}`,
          tenant_id: snap.tenant_id,
          tenant_name: snap.tenant_name,
          current_plan: snap.current_plan,
          recommended_action: 'cross_sell',
          estimated_mrr_impact: snap.mrr * 0.2,
          confidence: 65,
          reasoning: `Apenas ${snap.active_modules}/${snap.total_modules} módulos ativos após ${snap.months_active} meses.`,
          created_at: now(),
        });
      }

      if (snap.churn_risk_score >= 60) {
        results.push({
          id: `rev_${++_revSeq}`,
          tenant_id: snap.tenant_id,
          tenant_name: snap.tenant_name,
          current_plan: snap.current_plan,
          recommended_action: 'retention_offer',
          estimated_mrr_impact: -snap.mrr * 0.1,
          confidence: snap.churn_risk_score,
          reasoning: `Risco de churn em ${snap.churn_risk_score}%. Oferta de retenção pode preservar MRR de R$${snap.mrr.toFixed(2)}.`,
          created_at: now(),
        });
      }
    }

    return results;
  },
};
