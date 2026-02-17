/**
 * Revenue Intelligence Engine — Core Implementation
 *
 * All sub-engines wired together:
 *  - RevenueAnalyzer: MRR/ARR/Growth from real billing data
 *  - ChurnPredictionService: risk scoring based on activity + payment history
 *  - UpgradeRecommendationService: usage-based upgrade signals
 *  - ReferralManager + LinkGenerator + TrackingService
 *  - GamificationEngine + RewardCalculator
 */

import { supabase } from '@/integrations/supabase/client';
import { emitBillingEvent } from '@/domains/billing-core/billing-events';
import type {
  RevenueAnalyzerAPI,
  ChurnPredictionServiceAPI,
  UpgradeRecommendationServiceAPI,
  ReferralManagerAPI,
  GamificationEngineAPI,
  RewardCalculatorAPI,
  RevenueMetrics,
  RevenueForecast,
  ChurnRiskTenant,
  UpgradeCandidate,
  ReferralLink,
  ReferralTracking,
  GamificationLeaderboardEntry,
  GamificationPointEntry,
  GamificationTier,
} from './types';

// ══════════════════════════════════════════════════════════════
// REWARD CALCULATOR
// ══════════════════════════════════════════════════════════════

const TIER_THRESHOLDS: Record<GamificationTier, number> = {
  bronze: 0,
  silver: 500,
  gold: 2000,
  platinum: 5000,
  diamond: 15000,
};

const COMMISSION_RATES: Record<GamificationTier, number> = {
  bronze: 0.05,
  silver: 0.08,
  gold: 0.10,
  platinum: 0.12,
  diamond: 0.15,
};

export function createRewardCalculator(): RewardCalculatorAPI {
  return {
    calculateCommission(paymentBrl, tier) {
      return Math.round(paymentBrl * COMMISSION_RATES[tier] * 100) / 100;
    },
    getTierThresholds() {
      return { ...TIER_THRESHOLDS };
    },
  };
}

// ══════════════════════════════════════════════════════════════
// REVENUE ANALYZER
// ══════════════════════════════════════════════════════════════

export function createRevenueAnalyzer(): RevenueAnalyzerAPI {
  return {
    async getMetrics(): Promise<RevenueMetrics> {
      // Fetch ALL real data sources in parallel
      const [tpRes, invRes, ledgerRes, usageRes, allPlansRes, cancelledRes] = await Promise.all([
        supabase.from('tenant_plans').select('*, saas_plans(name, price)').eq('status', 'active'),
        supabase.from('invoices').select('total_amount, status, paid_at, created_at, plan_id').eq('status', 'paid').order('created_at', { ascending: false }).limit(1000),
        supabase.from('platform_financial_entries').select('entry_type, amount, tenant_id, source_plan_id, created_at'),
        supabase.from('usage_records').select('tenant_id, metric_key, quantity, module_id, metadata, created_at'),
        supabase.from('saas_plans').select('id, name, price').eq('is_active', true),
        supabase.from('tenant_plans').select('id').eq('status', 'cancelled'),
      ]);

      const activePlans = tpRes.data ?? [];
      const invoices = invRes.data ?? [];
      const ledger = ledgerRes.data ?? [];
      const usageRecords = usageRes.data ?? [];
      const allPlans = allPlansRes.data ?? [];
      const cancelledCount = cancelledRes.data?.length ?? 0;

      // ── MRR from active plans ──
      const mrr = activePlans.reduce((s, tp) => {
        const price = Number((tp as any).saas_plans?.price ?? 0);
        const cycle = tp.billing_cycle;
        if (cycle === 'annual' || cycle === 'yearly') return s + price / 12;
        if (cycle === 'quarterly') return s + price / 3;
        return s + price;
      }, 0);

      const arr = mrr * 12;
      const paying = activePlans.length;
      const arpa = paying > 0 ? mrr / paying : 0;

      // ── Churn from cancelled vs total ──
      const totalPlans = paying + cancelledCount;
      const churnRate = totalPlans > 0 ? Math.round((cancelledCount / totalPlans) * 1000) / 10 : 0;
      const ltv = arpa > 0 && churnRate > 0 ? arpa / (churnRate / 100) : arpa * 24;

      // ── Growth: current vs previous month (from invoices) ──
      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

      const thisRevenue = invoices.filter(i => i.paid_at?.startsWith(thisMonth)).reduce((s, i) => s + Number(i.total_amount), 0);
      const prevRevenue = invoices.filter(i => i.paid_at?.startsWith(prevMonth)).reduce((s, i) => s + Number(i.total_amount), 0);
      const growthRate = prevRevenue > 0 ? ((thisRevenue - prevRevenue) / prevRevenue) * 100 : 0;

      // ── Revenue by Plan (from active plans) ──
      const planMap = new Map<string, { mrr: number; tenants: number }>();
      for (const tp of activePlans) {
        const planName = (tp as any).saas_plans?.name ?? 'Desconhecido';
        const price = Number((tp as any).saas_plans?.price ?? 0);
        const cycle = tp.billing_cycle;
        const monthly = cycle === 'annual' || cycle === 'yearly' ? price / 12 : cycle === 'quarterly' ? price / 3 : price;
        const entry = planMap.get(planName) ?? { mrr: 0, tenants: 0 };
        entry.mrr += monthly;
        entry.tenants++;
        planMap.set(planName, entry);
      }
      const revenue_by_plan = [...planMap.entries()].map(([plan_name, v]) => ({
        plan_name, mrr: Math.round(v.mrr * 100) / 100, tenants: v.tenants,
      })).sort((a, b) => b.mrr - a.mrr);

      // ── Revenue by Module (from usage_records) ──
      const moduleMap = new Map<string, { total_brl: number; records: number }>();
      for (const ur of usageRecords) {
        const mod = ur.module_id ?? 'unknown';
        const entry = moduleMap.get(mod) ?? { total_brl: 0, records: 0 };
        entry.total_brl += Number(ur.quantity ?? 0);
        entry.records++;
        moduleMap.set(mod, entry);
      }
      const revenue_by_module = [...moduleMap.entries()].map(([module_id, v]) => ({
        module_id, total_brl: Math.round(v.total_brl * 100) / 100, records: v.records,
      })).sort((a, b) => b.total_brl - a.total_brl);

      // ── Ledger total (from platform_financial_entries) ──
      const ledger_total_brl = ledger.reduce((s, e) => {
        const sign = e.entry_type === 'payment' || e.entry_type === 'subscription_payment' ? 1 : -1;
        return s + Number(e.amount) * sign;
      }, 0);

      return {
        mrr,
        arr,
        paying_tenants: paying,
        arpa,
        growth_rate_pct: Math.round(growthRate * 10) / 10,
        net_revenue_retention_pct: Math.round((100 + growthRate) * 10) / 10,
        churn_rate_pct: churnRate,
        ltv_estimate: Math.round(ltv),
        revenue_by_plan,
        revenue_by_module,
        ledger_total_brl: Math.round(ledger_total_brl * 100) / 100,
      };
    },

    async getForecast(months): Promise<RevenueForecast[]> {
      const metrics = await this.getMetrics();
      const forecasts: RevenueForecast[] = [];
      const growthMonthly = (metrics.growth_rate_pct / 100) || 0.03;

      for (let i = 1; i <= months; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() + i);
        const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        const base = metrics.mrr * Math.pow(1 + growthMonthly, i);

        forecasts.push({
          month: label,
          projected_mrr: Math.round(base),
          confidence_low: Math.round(base * 0.85),
          confidence_high: Math.round(base * 1.2),
          growth_scenario: 'base',
        });
      }
      return forecasts;
    },

    async getMonthlyTrend(months) {
      // Use real ledger + invoices for trend
      const [invData, ledgerData] = await Promise.all([
        supabase.from('invoices').select('total_amount, paid_at, tenant_id').eq('status', 'paid').order('paid_at', { ascending: true }).limit(1000),
        supabase.from('platform_financial_entries').select('amount, entry_type, tenant_id, created_at').order('created_at', { ascending: true }).limit(1000),
      ]);

      const invoices = invData.data ?? [];
      const ledger = ledgerData.data ?? [];
      const now = new Date();
      const result: { month: string; mrr: number; tenants: number }[] = [];

      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });

        // Combine invoice + ledger revenue for the month
        const monthInvoices = invoices.filter(inv => inv.paid_at?.startsWith(key));
        const monthLedger = ledger.filter(e =>
          e.created_at?.startsWith(key) &&
          (e.entry_type === 'payment' || e.entry_type === 'subscription_payment')
        );

        const tenantSet = new Set([
          ...monthInvoices.map(i => i.tenant_id),
          ...monthLedger.map(e => e.tenant_id),
        ]);

        const invTotal = monthInvoices.reduce((s, inv) => s + Number(inv.total_amount), 0);
        const ledgerTotal = monthLedger.reduce((s, e) => s + Number(e.amount), 0);
        // Use the higher of the two to avoid double-counting
        const total = Math.max(invTotal, ledgerTotal) || (invTotal + ledgerTotal);

        result.push({ month: label, mrr: total, tenants: tenantSet.size });
      }
      return result;
    },
  };
}

// ══════════════════════════════════════════════════════════════
// CHURN PREDICTION SERVICE
// ══════════════════════════════════════════════════════════════

export function createChurnPredictionService(): ChurnPredictionServiceAPI {
  return {
    async getAtRiskTenants(): Promise<ChurnRiskTenant[]> {
      // Fetch ALL signals in parallel
      const [tpRes, invRes, usageCurr, usagePrev, couponRes, downgradeLedger] = await Promise.all([
        supabase.from('tenant_plans').select('tenant_id, plan_id, saas_plans(name, price), tenants(name)').eq('status', 'active'),
        supabase.from('invoices').select('tenant_id, status, created_at, due_date').order('created_at', { ascending: false }).limit(1000),
        // Current month usage
        supabase.from('usage_records').select('tenant_id, quantity, recorded_at')
          .gte('recorded_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        // Previous month usage
        supabase.from('usage_records').select('tenant_id, quantity, recorded_at')
          .gte('recorded_at', new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString())
          .lt('recorded_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        // Coupon redemptions (last 90 days)
        supabase.from('coupon_redemptions').select('tenant_id, discount_applied_brl, status')
          .gte('redeemed_at', new Date(Date.now() - 90 * 86400000).toISOString()),
        // Downgrade signals from ledger
        supabase.from('platform_financial_entries').select('tenant_id, entry_type, description, created_at')
          .in('entry_type', ['plan_downgrade', 'refund', 'credit'])
          .gte('created_at', new Date(Date.now() - 90 * 86400000).toISOString()),
      ]);

      const tenantPlans = tpRes.data ?? [];
      if (!tenantPlans.length) return [];

      const invoices = invRes.data ?? [];
      const currUsage = usageCurr.data ?? [];
      const prevUsage = usagePrev.data ?? [];
      const coupons = couponRes.data ?? [];
      const downgrades = downgradeLedger.data ?? [];

      // Pre-aggregate usage per tenant
      const aggUsage = (records: typeof currUsage) => {
        const map = new Map<string, number>();
        for (const r of records) {
          map.set(r.tenant_id, (map.get(r.tenant_id) ?? 0) + Number(r.quantity));
        }
        return map;
      };
      const currUsageMap = aggUsage(currUsage);
      const prevUsageMap = aggUsage(prevUsage);

      // Coupon discount per tenant
      const couponMap = new Map<string, { total_discount: number; count: number }>();
      for (const c of coupons) {
        const entry = couponMap.get(c.tenant_id) ?? { total_discount: 0, count: 0 };
        entry.total_discount += Number(c.discount_applied_brl);
        entry.count++;
        couponMap.set(c.tenant_id, entry);
      }

      // Downgrade events per tenant
      const downgradeMap = new Map<string, number>();
      for (const d of downgrades) {
        downgradeMap.set(d.tenant_id, (downgradeMap.get(d.tenant_id) ?? 0) + 1);
      }

      const now = Date.now();
      const risks: ChurnRiskTenant[] = [];

      for (const tp of tenantPlans) {
        const tid = tp.tenant_id;
        const tenantInvoices = invoices.filter(i => i.tenant_id === tid);
        const overdueCount = tenantInvoices.filter(i => i.status === 'overdue').length;
        const lastInvoice = tenantInvoices[0];
        const daysSinceLastInvoice = lastInvoice
          ? Math.floor((now - new Date(lastInvoice.created_at).getTime()) / 86400000)
          : 999;

        const factors: string[] = [];
        let score = 0;

        // ── Signal 1: Overdue invoices ──
        if (overdueCount > 0) {
          score += Math.min(overdueCount * 15, 30);
          factors.push(`${overdueCount} fatura(s) vencida(s)`);
        }

        // ── Signal 2: Inactivity ──
        if (daysSinceLastInvoice > 90) {
          score += 20;
          factors.push('Inatividade crítica > 90 dias');
        } else if (daysSinceLastInvoice > 60) {
          score += 12;
          factors.push('Sem atividade > 60 dias');
        }

        // ── Signal 3: Usage reduction ──
        const curr = currUsageMap.get(tid) ?? 0;
        const prev = prevUsageMap.get(tid) ?? 0;
        if (prev > 0) {
          const usageDrop = ((prev - curr) / prev) * 100;
          if (usageDrop >= 50) {
            score += 25;
            factors.push(`Uso caiu ${Math.round(usageDrop)}% vs mês anterior`);
          } else if (usageDrop >= 25) {
            score += 15;
            factors.push(`Uso caiu ${Math.round(usageDrop)}% vs mês anterior`);
          }
        } else if (curr === 0 && prev === 0) {
          score += 5;
          factors.push('Sem uso registrado');
        }

        // ── Signal 4: Plan downgrade ──
        const downgradeCount = downgradeMap.get(tid) ?? 0;
        if (downgradeCount > 0) {
          score += Math.min(downgradeCount * 15, 25);
          factors.push(`${downgradeCount} downgrade(s) recente(s)`);
        }

        // ── Signal 5: Heavy coupon usage ──
        const couponData = couponMap.get(tid);
        if (couponData) {
          const planPrice = Number((tp as any).saas_plans?.price ?? 0);
          const discountRatio = planPrice > 0 ? couponData.total_discount / planPrice : 0;
          if (discountRatio > 0.5) {
            score += 15;
            factors.push(`Alto desconto via cupons (${Math.round(discountRatio * 100)}% do plano)`);
          } else if (couponData.count >= 2) {
            score += 8;
            factors.push(`${couponData.count} cupons resgatados recentemente`);
          }
        }

        // Only include tenants with meaningful risk
        if (score >= 15) {
          const clampedScore = Math.min(score, 100);
          risks.push({
            tenant_id: tid,
            tenant_name: (tp as any).tenants?.name ?? tid,
            plan_name: (tp as any).saas_plans?.name ?? '—',
            risk_score: clampedScore,
            risk_factors: factors,
            days_since_last_activity: daysSinceLastInvoice,
            mrr_at_risk: Number((tp as any).saas_plans?.price ?? 0),
            recommended_action:
              clampedScore > 75 ? 'Contato urgente — risco iminente' :
              clampedScore > 50 ? 'Engajamento proativo necessário' :
              clampedScore > 30 ? 'Acompanhamento preventivo' :
              'Monitorar',
          });
        }
      }

      return risks.sort((a, b) => b.risk_score - a.risk_score);
    },

    async getTenantRiskScore(tenantId) {
      const risks = await this.getAtRiskTenants();
      return risks.find(r => r.tenant_id === tenantId)?.risk_score ?? 0;
    },
  };
}

// ══════════════════════════════════════════════════════════════
// UPGRADE RECOMMENDATION SERVICE
// ══════════════════════════════════════════════════════════════

export function createUpgradeRecommendationService(): UpgradeRecommendationServiceAPI {
  return {
    async getCandidates(): Promise<UpgradeCandidate[]> {
      const [tpRes, plansRes, tiersRes, usageRes] = await Promise.all([
        supabase.from('tenant_plans').select('tenant_id, plan_id, saas_plans(name, price), tenants(name)').eq('status', 'active'),
        supabase.from('saas_plans').select('id, name, price').eq('is_active', true).order('price', { ascending: true }),
        supabase.from('usage_pricing_tiers').select('plan_id, metric_key, included_quantity').eq('is_active', true),
        // Current month usage per tenant
        supabase.from('usage_records').select('tenant_id, metric_key, quantity')
          .gte('recorded_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      ]);

      const plans = plansRes.data ?? [];
      const tiers = tiersRes.data ?? [];
      const usage = usageRes.data ?? [];

      // Aggregate usage per tenant per metric
      const usageMap = new Map<string, Map<string, number>>();
      for (const u of usage) {
        if (!usageMap.has(u.tenant_id)) usageMap.set(u.tenant_id, new Map());
        const m = usageMap.get(u.tenant_id)!;
        m.set(u.metric_key, (m.get(u.metric_key) ?? 0) + Number(u.quantity));
      }

      // Plan limits: plan_id → metric_key → included_quantity
      const limitMap = new Map<string, Map<string, number>>();
      for (const t of tiers) {
        if (!limitMap.has(t.plan_id)) limitMap.set(t.plan_id, new Map());
        limitMap.get(t.plan_id)!.set(t.metric_key, Number(t.included_quantity));
      }

      const candidates: UpgradeCandidate[] = [];

      for (const tp of tpRes.data ?? []) {
        const currentPlan = plans.find(p => p.id === tp.plan_id);
        if (!currentPlan) continue;
        const nextPlan = plans.find(p => Number(p.price) > Number(currentPlan.price));
        if (!nextPlan) continue;

        const tenantUsage = usageMap.get(tp.tenant_id);
        const planLimits = limitMap.get(tp.plan_id);

        // Calculate max usage percentage across all metrics
        let maxUsagePct = 0;
        const signals: string[] = [];

        if (tenantUsage && planLimits) {
          for (const [metric, used] of tenantUsage.entries()) {
            const limit = planLimits.get(metric);
            if (limit && limit > 0) {
              const pct = Math.round((used / limit) * 100);
              if (pct > maxUsagePct) maxUsagePct = pct;
              if (pct >= 90) {
                signals.push(`${metric}: ${pct}% do limite (${used}/${limit})`);
              } else if (pct >= 70) {
                signals.push(`${metric}: ${pct}% do limite`);
              }
            }
          }
        }

        // Even without tier limits, check if there's significant usage
        if (!planLimits || planLimits.size === 0) {
          if (tenantUsage && tenantUsage.size > 0) {
            const totalUsage = [...tenantUsage.values()].reduce((s, v) => s + v, 0);
            if (totalUsage > 0) {
              signals.push(`${tenantUsage.size} métricas de uso ativas`);
              maxUsagePct = 50; // moderate signal
            }
          }
        }

        // Only recommend if usage is meaningful (>= 60%) or we have signals
        if (maxUsagePct >= 60 || signals.length > 0) {
          if (signals.length === 0) {
            signals.push('Uso crescente de recursos');
          }

          candidates.push({
            tenant_id: tp.tenant_id,
            tenant_name: (tp as any).tenants?.name ?? tp.tenant_id,
            current_plan: currentPlan.name,
            recommended_plan: nextPlan.name,
            usage_pct: Math.min(maxUsagePct, 100),
            potential_uplift_brl: Number(nextPlan.price) - Number(currentPlan.price),
            signals,
          });
        }
      }

      return candidates.sort((a, b) => b.usage_pct - a.usage_pct);
    },
  };
}

// ══════════════════════════════════════════════════════════════
// REFERRAL MANAGER
// ══════════════════════════════════════════════════════════════

function generateReferralCode(): string {
  return 'REF-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function createReferralManager(): ReferralManagerAPI {
  return {
    async generateLink(userId) {
      const code = generateReferralCode();
      const url = `${window.location.origin}/signup?ref=${code}`;

      const { data, error } = await supabase
        .from('referral_links')
        .insert({ referrer_user_id: userId, code, url })
        .select()
        .single();

      if (error) throw new Error(`ReferralManager.generateLink: ${error.message}`);
      return data as unknown as ReferralLink;
    },

    async getLinks(userId) {
      let query = supabase.from('referral_links').select('*').order('created_at', { ascending: false });
      if (userId) query = query.eq('referrer_user_id', userId);
      const { data } = await query;
      return (data ?? []) as unknown as ReferralLink[];
    },

    async getTracking(linkId) {
      let query = supabase.from('referral_tracking').select('*').order('created_at', { ascending: false });
      if (linkId) query = query.eq('referral_link_id', linkId);
      const { data } = await query;
      return (data ?? []) as unknown as ReferralTracking[];
    },

    async recordConversion(trackingId, planId, paymentBrl) {
      await supabase
        .from('referral_tracking')
        .update({
          status: 'converted',
          converted_at: new Date().toISOString(),
          plan_id: planId,
          first_payment_brl: paymentBrl,
        })
        .eq('id', trackingId);
    },
  };
}

// ══════════════════════════════════════════════════════════════
// GAMIFICATION ENGINE
// ══════════════════════════════════════════════════════════════

const POINTS_MAP: Record<string, number> = {
  referral_signup: 100,
  referral_conversion: 500,
  referral_payment: 200,
};

export function createGamificationEngine(): GamificationEngineAPI {
  return {
    async getLeaderboard(limit = 20) {
      const { data } = await supabase
        .from('gamification_leaderboard')
        .select('*')
        .order('total_points', { ascending: false })
        .limit(limit);
      return (data ?? []) as unknown as GamificationLeaderboardEntry[];
    },

    async getUserPoints(userId) {
      const { data } = await supabase
        .from('gamification_points')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      return (data ?? []) as unknown as GamificationPointEntry[];
    },

    async awardPoints(userId, action, points, source, description) {
      await supabase.from('gamification_points').insert({
        user_id: userId,
        action,
        points: points || POINTS_MAP[action] || 0,
        source,
        description: description ?? null,
      });

      // Upsert leaderboard
      const { data: existing } = await supabase
        .from('gamification_leaderboard')
        .select('total_points, total_referrals, total_conversions')
        .eq('user_id', userId)
        .single();

      if (existing) {
        await supabase
          .from('gamification_leaderboard')
          .update({
            total_points: existing.total_points + (points || POINTS_MAP[action] || 0),
            total_referrals: existing.total_referrals + (action === 'referral_signup' ? 1 : 0),
            total_conversions: existing.total_conversions + (action === 'referral_conversion' ? 1 : 0),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);
      } else {
        await supabase.from('gamification_leaderboard').insert({
          user_id: userId,
          total_points: points || POINTS_MAP[action] || 0,
          total_referrals: action === 'referral_signup' ? 1 : 0,
          total_conversions: action === 'referral_conversion' ? 1 : 0,
          current_tier: 'bronze',
        });
      }

      // Recalculate tier
      await this.recalculateTier(userId);
    },

    async recalculateTier(userId): Promise<GamificationTier> {
      const { data } = await supabase
        .from('gamification_leaderboard')
        .select('total_points')
        .eq('user_id', userId)
        .single();

      const pts = data?.total_points ?? 0;
      let tier: GamificationTier = 'bronze';
      if (pts >= TIER_THRESHOLDS.diamond) tier = 'diamond';
      else if (pts >= TIER_THRESHOLDS.platinum) tier = 'platinum';
      else if (pts >= TIER_THRESHOLDS.gold) tier = 'gold';
      else if (pts >= TIER_THRESHOLDS.silver) tier = 'silver';

      await supabase
        .from('gamification_leaderboard')
        .update({ current_tier: tier, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      return tier;
    },
  };
}

// ══════════════════════════════════════════════════════════════
// FACADE
// ══════════════════════════════════════════════════════════════

export interface RevenueIntelligenceEngine {
  analyzer: RevenueAnalyzerAPI;
  churn: ChurnPredictionServiceAPI;
  upgrade: UpgradeRecommendationServiceAPI;
  referral: ReferralManagerAPI;
  gamification: GamificationEngineAPI;
  rewards: RewardCalculatorAPI;
}

let _instance: RevenueIntelligenceEngine | null = null;

export function getRevenueIntelligenceEngine(): RevenueIntelligenceEngine {
  if (!_instance) {
    _instance = {
      analyzer: createRevenueAnalyzer(),
      churn: createChurnPredictionService(),
      upgrade: createUpgradeRecommendationService(),
      referral: createReferralManager(),
      gamification: createGamificationEngine(),
      rewards: createRewardCalculator(),
    };
  }
  return _instance;
}
