/**
 * BillingMetricsCollector — Collects billing metrics for Prometheus export.
 *
 * Queries tenant_plans + invoices to produce:
 *  - billing_active_subscriptions
 *  - billing_mrr_total
 *  - billing_invoice_errors
 *  - billing_invoices_paid / pending / overdue
 *
 * Uses in-memory cache with TTL to avoid hammering the database on every scrape.
 */

import { supabase } from '@/integrations/supabase/client';

export interface BillingMetricsSnapshot {
  active_subscriptions: number;
  mrr_total: number;
  invoice_errors: number;
  invoices_paid: number;
  invoices_pending: number;
  invoices_overdue: number;
  collected_at: number;
}

const CACHE_TTL_MS = 60_000; // 1 minute

let _cache: BillingMetricsSnapshot | null = null;
let _lastFetch = 0;
let _fetching = false;

/**
 * Returns the latest billing metrics snapshot (sync, from cache).
 * Triggers async refresh if stale.
 */
export function getBillingMetricsSnapshot(): BillingMetricsSnapshot {
  const now = Date.now();

  // Trigger async refresh if cache is stale
  if (!_fetching && (now - _lastFetch > CACHE_TTL_MS)) {
    _fetching = true;
    refreshBillingMetrics().finally(() => { _fetching = false; });
  }

  return _cache ?? {
    active_subscriptions: 0,
    mrr_total: 0,
    invoice_errors: 0,
    invoices_paid: 0,
    invoices_pending: 0,
    invoices_overdue: 0,
    collected_at: 0,
  };
}

/**
 * Force refresh billing metrics from database.
 */
export async function refreshBillingMetrics(): Promise<BillingMetricsSnapshot> {
  try {
    // Fetch active plans with pricing
    const { data: plans } = await supabase
      .from('tenant_plans')
      .select('id, status, billing_cycle, saas_plans(price_brl)')
      .eq('status', 'active');

    const activePlans = plans ?? [];
    const activeCount = activePlans.length;

    // Calculate MRR
    let mrr = 0;
    for (const plan of activePlans) {
      const price = (plan.saas_plans as any)?.price_brl ?? 0;
      const cycle = (plan as any).billing_cycle ?? 'monthly';
      if (cycle === 'yearly') mrr += price / 12;
      else if (cycle === 'quarterly') mrr += price / 3;
      else mrr += price;
    }

    // Fetch invoice stats
    const { count: paidCount } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'paid');

    const { count: pendingCount } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { count: overdueCount } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'overdue');

    const { count: errorCount } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .in('status', ['failed', 'error', 'overdue']);

    _cache = {
      active_subscriptions: activeCount,
      mrr_total: Math.round(mrr * 100) / 100,
      invoice_errors: errorCount ?? 0,
      invoices_paid: paidCount ?? 0,
      invoices_pending: pendingCount ?? 0,
      invoices_overdue: overdueCount ?? 0,
      collected_at: Date.now(),
    };

    _lastFetch = Date.now();
    return _cache;
  } catch (err) {
    console.warn('[BillingMetrics] Failed to refresh:', err);
    return _cache ?? {
      active_subscriptions: 0,
      mrr_total: 0,
      invoice_errors: 0,
      invoices_paid: 0,
      invoices_pending: 0,
      invoices_overdue: 0,
      collected_at: 0,
    };
  }
}
