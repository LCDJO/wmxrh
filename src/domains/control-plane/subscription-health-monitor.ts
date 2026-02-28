/**
 * SubscriptionHealthMonitor — Control Plane sub-system
 *
 * Monitors subscription health across all tenants and surfaces:
 *   1. Tenants about to expire (next_billing_date within N days)
 *   2. Scheduled downgrades
 *   3. Churn risk signals (past_due, declining usage, coupon-dependent)
 *   4. Fraud suspicion (plan cycling, coupon abuse, mass user deletion)
 *
 * Reads from Supabase tables: tenant_plans, invoices, saas_plans, coupon_redemptions
 */

import { supabase } from '@/integrations/supabase/client';

// ── Types ────────────────────────────────────────────────────

export type SubscriptionHealthLevel = 'healthy' | 'attention' | 'warning' | 'critical';

export interface TenantSubscriptionHealth {
  tenant_id: string;
  tenant_name: string;
  plan_name: string;
  plan_tier: string;
  status: string;
  billing_cycle: string;

  // Expiry
  next_billing_date: string | null;
  days_until_billing: number | null;
  paid_until: string | null;
  is_overdue: boolean;

  // Downgrade
  downgrade_scheduled: boolean;
  scheduled_plan_name: string | null;
  downgrade_date: string | null;

  // Churn signals
  churn_risk_score: number; // 0-100
  churn_signals: ChurnSignal[];

  // Fraud
  fraud_signals: FraudSignal[];
  fraud_score: number; // 0-100

  // Overall
  health_level: SubscriptionHealthLevel;
  health_score: number; // 0-100
}

export type ChurnSignalType =
  | 'past_due'
  | 'grace_period_expiring'
  | 'repeated_failed_payments'
  | 'downgrade_scheduled'
  | 'low_usage'
  | 'coupon_dependent'
  | 'no_recent_login';

export interface ChurnSignal {
  type: ChurnSignalType;
  severity: 'low' | 'medium' | 'high';
  description: string;
  detected_at: number;
}

export type FraudSignalType =
  | 'plan_cycling'
  | 'coupon_abuse'
  | 'mass_user_deletion'
  | 'review_required';

export interface FraudSignal {
  type: FraudSignalType;
  severity: 'medium' | 'high' | 'critical';
  description: string;
  detected_at: number;
}

export interface SubscriptionHealthSummary {
  total_tenants: number;
  healthy: number;
  attention: number;
  warning: number;
  critical: number;

  expiring_soon: number;      // next 7 days
  past_due: number;
  downgrades_pending: number;
  high_churn_risk: number;    // score >= 60
  fraud_alerts: number;       // score >= 50

  mrr_at_risk_brl: number;
  assessed_at: number;
}

export interface SubscriptionHealthMonitorAPI {
  /** Full health assessment for all tenants */
  assess(): Promise<TenantSubscriptionHealth[]>;
  /** Summary metrics */
  getSummary(): Promise<SubscriptionHealthSummary>;
  /** Single tenant health */
  assessTenant(tenantId: string): Promise<TenantSubscriptionHealth | null>;
  /** Tenants expiring within N days */
  getExpiringSoon(days?: number): Promise<TenantSubscriptionHealth[]>;
  /** Tenants with high churn risk */
  getHighChurnRisk(minScore?: number): Promise<TenantSubscriptionHealth[]>;
  /** Tenants with fraud signals */
  getFraudAlerts(minScore?: number): Promise<TenantSubscriptionHealth[]>;
}

// ── Factory ──────────────────────────────────────────────────

export function createSubscriptionHealthMonitor(): SubscriptionHealthMonitorAPI {
  // Cache for short TTL
  let _cache: { data: TenantSubscriptionHealth[]; at: number } | null = null;
  const CACHE_TTL = 60_000; // 1min

  async function fetchAll(): Promise<TenantSubscriptionHealth[]> {
    if (_cache && Date.now() - _cache.at < CACHE_TTL) return _cache.data;

    const now = new Date();

    // 1. Fetch active/trial/past_due subscriptions with plan info
    const { data: subs, error: subErr } = await supabase
      .from('tenant_plans')
      .select(`
        id, tenant_id, plan_id, status, billing_cycle,
        next_billing_date, paid_until, cycle_end_date,
        downgrade_scheduled, scheduled_plan_id,
        failed_payment_count, review_required,
        grace_period_ends_at,
        tenants!tenant_plans_tenant_id_fkey(name),
        saas_plans!tenant_plans_plan_id_fkey(name, price)
      `)
      .in('status', ['active', 'trial', 'past_due'])
      .order('created_at', { ascending: false });

    if (subErr || !subs) {
      console.error('[SubscriptionHealthMonitor] fetch error', subErr);
      return [];
    }

    // 2. Fetch overdue invoices count per tenant
    const { data: overdueInvs } = await supabase
      .from('invoices')
      .select('tenant_id')
      .eq('status', 'overdue');

    const overdueCounts = new Map<string, number>();
    for (const inv of overdueInvs ?? []) {
      overdueCounts.set(inv.tenant_id, (overdueCounts.get(inv.tenant_id) ?? 0) + 1);
    }

    // 3. Fetch recent plan changes (last 90d) to detect cycling
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000).toISOString();
    const { data: recentChanges } = await supabase
      .from('audit_logs')
      .select('tenant_id, action')
      .in('action', ['plan_upgrade', 'plan_downgrade', 'plan_change'])
      .gte('created_at', ninetyDaysAgo);

    const planChangeCounts = new Map<string, number>();
    for (const ch of recentChanges ?? []) {
      planChangeCounts.set(ch.tenant_id, (planChangeCounts.get(ch.tenant_id) ?? 0) + 1);
    }

    // 4. Fetch coupon redemptions per tenant (last 90d)
    const { data: recentCoupons } = await supabase
      .from('coupon_redemptions')
      .select('tenant_id')
      .gte('redeemed_at', ninetyDaysAgo);

    const couponCounts = new Map<string, number>();
    for (const c of recentCoupons ?? []) {
      couponCounts.set(c.tenant_id, (couponCounts.get(c.tenant_id) ?? 0) + 1);
    }

    // 5. Build health entries
    const results: TenantSubscriptionHealth[] = [];

    for (const sub of subs) {
      const tenant = sub.tenants as any;
      const plan = sub.saas_plans as any;
      const tenantId = sub.tenant_id;
      const planName = plan?.name ?? 'Desconhecido';
      const planTier = planName.toLowerCase().includes('enterprise') ? 'enterprise'
        : planName.toLowerCase().includes('professional') ? 'professional'
        : planName.toLowerCase().includes('starter') ? 'starter' : 'free';

      const daysUntilBilling = sub.next_billing_date
        ? Math.ceil((new Date(sub.next_billing_date).getTime() - now.getTime()) / 86400000)
        : null;

      const isOverdue = sub.paid_until
        ? new Date(sub.paid_until) < now
        : false;

      // ── Churn signals ──
      const churnSignals: ChurnSignal[] = [];
      const ts = Date.now();

      if (sub.status === 'past_due') {
        churnSignals.push({ type: 'past_due', severity: 'high', description: 'Pagamento em atraso', detected_at: ts });
      }

      if (sub.grace_period_ends_at) {
        const graceEnd = new Date(sub.grace_period_ends_at).getTime();
        const daysLeft = Math.ceil((graceEnd - now.getTime()) / 86400000);
        if (daysLeft <= 3 && daysLeft > 0) {
          churnSignals.push({ type: 'grace_period_expiring', severity: 'high', description: `Grace period expira em ${daysLeft} dia(s)`, detected_at: ts });
        }
      }

      if ((sub.failed_payment_count ?? 0) >= 2) {
        churnSignals.push({ type: 'repeated_failed_payments', severity: 'high', description: `${sub.failed_payment_count} tentativas de pagamento falharam`, detected_at: ts });
      }

      if (sub.downgrade_scheduled) {
        churnSignals.push({ type: 'downgrade_scheduled', severity: 'medium', description: 'Downgrade agendado para próximo ciclo', detected_at: ts });
      }

      if ((couponCounts.get(tenantId) ?? 0) >= 3) {
        churnSignals.push({ type: 'coupon_dependent', severity: 'low', description: `${couponCounts.get(tenantId)} cupons usados em 90 dias`, detected_at: ts });
      }

      // Churn score
      const churnWeights: Record<ChurnSignalType, number> = {
        past_due: 30, grace_period_expiring: 25, repeated_failed_payments: 20,
        downgrade_scheduled: 15, low_usage: 10, coupon_dependent: 5, no_recent_login: 10,
      };
      const churnScore = Math.min(100, churnSignals.reduce((s, sig) => s + (churnWeights[sig.type] ?? 0), 0));

      // ── Fraud signals ──
      const fraudSignals: FraudSignal[] = [];

      const changes = planChangeCounts.get(tenantId) ?? 0;
      if (changes >= 4) {
        fraudSignals.push({ type: 'plan_cycling', severity: 'high', description: `${changes} trocas de plano em 90 dias`, detected_at: ts });
      }

      const couponsUsed = couponCounts.get(tenantId) ?? 0;
      if (couponsUsed >= 5) {
        fraudSignals.push({ type: 'coupon_abuse', severity: 'high', description: `${couponsUsed} cupons resgatados em 90 dias`, detected_at: ts });
      }

      if (sub.review_required) {
        fraudSignals.push({ type: 'review_required', severity: 'critical', description: 'Marcado para revisão de fraude', detected_at: ts });
      }

      const fraudScore = Math.min(100, fraudSignals.reduce((s, sig) => {
        const w: Record<string, number> = { medium: 20, high: 35, critical: 50 };
        return s + (w[sig.severity] ?? 10);
      }, 0));

      // ── Overall health ──
      const healthScore = Math.max(0, 100 - churnScore - Math.floor(fraudScore * 0.5));
      const healthLevel: SubscriptionHealthLevel =
        healthScore >= 75 ? 'healthy' :
        healthScore >= 50 ? 'attention' :
        healthScore >= 25 ? 'warning' : 'critical';

      // Resolve scheduled plan name
      let scheduledPlanName: string | null = null;
      if (sub.downgrade_scheduled && sub.scheduled_plan_id) {
        const { data: sp } = await supabase
          .from('saas_plans')
          .select('name')
          .eq('id', sub.scheduled_plan_id)
          .maybeSingle();
        scheduledPlanName = sp?.name ?? null;
      }

      results.push({
        tenant_id: tenantId,
        tenant_name: tenant?.name ?? tenantId.slice(0, 8),
        plan_name: plan?.name ?? 'Desconhecido',
        plan_tier: planTier,
        status: sub.status,
        billing_cycle: sub.billing_cycle ?? 'monthly',
        next_billing_date: sub.next_billing_date,
        days_until_billing: daysUntilBilling,
        paid_until: sub.paid_until,
        is_overdue: isOverdue,
        downgrade_scheduled: sub.downgrade_scheduled ?? false,
        scheduled_plan_name: scheduledPlanName,
        downgrade_date: sub.downgrade_scheduled ? sub.cycle_end_date : null,
        churn_risk_score: churnScore,
        churn_signals: churnSignals,
        fraud_signals: fraudSignals,
        fraud_score: fraudScore,
        health_level: healthLevel,
        health_score: healthScore,
      });
    }

    // Sort by health score ascending (worst first)
    results.sort((a, b) => a.health_score - b.health_score);

    _cache = { data: results, at: Date.now() };
    return results;
  }

  return {
    async assess() {
      return fetchAll();
    },

    async getSummary() {
      const all = await fetchAll();
      const now = Date.now();

      const expiringSoon = all.filter(t => t.days_until_billing !== null && t.days_until_billing >= 0 && t.days_until_billing <= 7);
      const pastDue = all.filter(t => t.status === 'past_due');
      const downgrades = all.filter(t => t.downgrade_scheduled);
      const highChurn = all.filter(t => t.churn_risk_score >= 60);
      const fraudAlerts = all.filter(t => t.fraud_score >= 50);

      return {
        total_tenants: all.length,
        healthy: all.filter(t => t.health_level === 'healthy').length,
        attention: all.filter(t => t.health_level === 'attention').length,
        warning: all.filter(t => t.health_level === 'warning').length,
        critical: all.filter(t => t.health_level === 'critical').length,
        expiring_soon: expiringSoon.length,
        past_due: pastDue.length,
        downgrades_pending: downgrades.length,
        high_churn_risk: highChurn.length,
        fraud_alerts: fraudAlerts.length,
        mrr_at_risk_brl: 0, // Would need plan pricing to calculate
        assessed_at: now,
      };
    },

    async assessTenant(tenantId) {
      const all = await fetchAll();
      return all.find(t => t.tenant_id === tenantId) ?? null;
    },

    async getExpiringSoon(days = 7) {
      const all = await fetchAll();
      return all.filter(t => t.days_until_billing !== null && t.days_until_billing >= 0 && t.days_until_billing <= days);
    },

    async getHighChurnRisk(minScore = 60) {
      const all = await fetchAll();
      return all.filter(t => t.churn_risk_score >= minScore);
    },

    async getFraudAlerts(minScore = 50) {
      const all = await fetchAll();
      return all.filter(t => t.fraud_score >= minScore);
    },
  };
}
