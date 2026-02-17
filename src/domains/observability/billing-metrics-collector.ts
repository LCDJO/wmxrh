/**
 * BillingMetricsCollector — Collects billing metrics for Prometheus export.
 *
 * Exports:
 *  - billing_mrr_total
 *  - billing_active_tenants
 *  - billing_plan_usage{plan="..."}
 *  - billing_active_subscriptions
 *  - billing_invoice_errors
 *  - billing_invoices_paid / pending / overdue
 *  - billing_arr_total
 *
 * Uses in-memory cache with TTL to avoid hammering the database on every scrape.
 */

import { supabase } from '@/integrations/supabase/client';

export interface PlanUsageEntry {
  plan_name: string;
  tier: string;
  count: number;
}

export interface BillingMetricsSnapshot {
  active_subscriptions: number;
  active_tenants: number;
  mrr_total: number;
  invoice_errors: number;
  invoices_paid: number;
  invoices_pending: number;
  invoices_overdue: number;
  plan_usage: PlanUsageEntry[];
  collected_at: number;
}

const CACHE_TTL_MS = 60_000; // 1 minute

let _cache: BillingMetricsSnapshot | null = null;
let _lastFetch = 0;
let _fetching = false;

const EMPTY_SNAPSHOT: BillingMetricsSnapshot = {
  active_subscriptions: 0,
  active_tenants: 0,
  mrr_total: 0,
  invoice_errors: 0,
  invoices_paid: 0,
  invoices_pending: 0,
  invoices_overdue: 0,
  plan_usage: [],
  collected_at: 0,
};

/**
 * Returns the latest billing metrics snapshot (sync, from cache).
 * Triggers async refresh if stale.
 */
export function getBillingMetricsSnapshot(): BillingMetricsSnapshot {
  const now = Date.now();

  if (!_fetching && (now - _lastFetch > CACHE_TTL_MS)) {
    _fetching = true;
    refreshBillingMetrics().finally(() => { _fetching = false; });
  }

  return _cache ?? { ...EMPTY_SNAPSHOT };
}

/**
 * Force refresh billing metrics from database.
 */
export async function refreshBillingMetrics(): Promise<BillingMetricsSnapshot> {
  try {
    // Fetch active plans with pricing and plan name/tier
    const { data: plans } = await supabase
      .from('tenant_plans')
      .select('id, tenant_id, status, billing_cycle, saas_plans(name, tier, price_brl)')
      .eq('status', 'active');

    const activePlans = plans ?? [];

    // Active subscriptions
    const activeCount = activePlans.length;

    // Active tenants (unique tenant_ids)
    const uniqueTenants = new Set(activePlans.map(p => p.tenant_id));
    const activeTenants = uniqueTenants.size;

    // MRR calculation
    let mrr = 0;
    for (const plan of activePlans) {
      const price = (plan.saas_plans as any)?.price_brl ?? 0;
      const cycle = (plan as any).billing_cycle ?? 'monthly';
      if (cycle === 'yearly') mrr += price / 12;
      else if (cycle === 'quarterly') mrr += price / 3;
      else mrr += price;
    }

    // Plan usage breakdown (count per plan name/tier)
    const planCounts = new Map<string, { tier: string; count: number }>();
    for (const plan of activePlans) {
      const name = ((plan.saas_plans as any)?.name ?? 'unknown').toLowerCase();
      const tier = (plan.saas_plans as any)?.tier ?? 'unknown';
      const existing = planCounts.get(name);
      if (existing) {
        existing.count++;
      } else {
        planCounts.set(name, { tier, count: 1 });
      }
    }

    const planUsage: PlanUsageEntry[] = [];
    for (const [plan_name, { tier, count }] of planCounts) {
      planUsage.push({ plan_name, tier, count });
    }

    // Invoice stats (parallel)
    const [paid, pending, overdue, errors] = await Promise.all([
      supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('status', 'paid'),
      supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('status', 'overdue'),
      supabase.from('invoices').select('id', { count: 'exact', head: true }).in('status', ['failed', 'error', 'overdue']),
    ]);

    _cache = {
      active_subscriptions: activeCount,
      active_tenants: activeTenants,
      mrr_total: Math.round(mrr * 100) / 100,
      invoice_errors: errors.count ?? 0,
      invoices_paid: paid.count ?? 0,
      invoices_pending: pending.count ?? 0,
      invoices_overdue: overdue.count ?? 0,
      plan_usage: planUsage,
      collected_at: Date.now(),
    };

    _lastFetch = Date.now();
    return _cache;
  } catch (err) {
    console.warn('[BillingMetrics] Failed to refresh:', err);
    return _cache ?? { ...EMPTY_SNAPSHOT };
  }
}
