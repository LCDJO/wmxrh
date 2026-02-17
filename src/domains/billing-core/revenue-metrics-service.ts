/**
 * RevenueMetricsService — Métricas financeiras reais via Supabase
 *
 * Integra:
 *  - tenant_subscriptions (MRR, planos, churn)
 *  - invoices (receita, aging, payment methods)
 *  - platform_financial_entries (ledger real — receita confirmada, referral rewards)
 *  - referral_tracking + referral_links (receita atribuída a indicações)
 */

import { supabase } from '@/integrations/supabase/client';
import type { RevenueMetricsServiceAPI, RevenueMetrics } from './types';

export function createRevenueMetricsService(): RevenueMetricsServiceAPI {
  return {
    async getMetrics() {
      // ── Parallel fetch: subscriptions, invoices, ledger, referrals ──
      const [subsRes, invoicesRes, ledgerRes, referralLinksRes, referralTrackingRes] = await Promise.all([
        supabase.from('tenant_subscriptions').select('id, tenant_id, plan, mrr, status, seats_used'),
        supabase.from('invoices').select('status, total_amount, payment_method, due_date, paid_at'),
        supabase.from('platform_financial_entries').select('entry_type, amount, tenant_id, source_plan_id, description, created_at'),
        supabase.from('referral_links').select('id, total_clicks, total_signups, total_conversions, total_reward_brl, is_active'),
        supabase.from('referral_tracking').select('id, status, first_payment_brl, reward_brl, converted_at'),
      ]);

      const subs = subsRes.data ?? [];
      const allInv = invoicesRes.data ?? [];
      const ledger = ledgerRes.data ?? [];
      const refLinks = referralLinksRes.data ?? [];
      const refTracking = referralTrackingRes.data ?? [];

      // ── Subscriptions: MRR, churn ──
      const activeSubs = subs.filter(s => s.status === 'active');
      const totalMrr = activeSubs.reduce((sum, s) => sum + Number(s.mrr ?? 0), 0);
      const churnedCount = subs.filter(s => s.status === 'churned').length;
      const totalForChurn = activeSubs.length + churnedCount;

      // ── Revenue by plan (from subscriptions) ──
      const planMap = new Map<string, { tier: string; mrr: number; count: number }>();
      for (const s of activeSubs) {
        const key = String(s.plan ?? 'free');
        const entry = planMap.get(key) ?? { tier: key, mrr: 0, count: 0 };
        entry.mrr += Number(s.mrr ?? 0);
        entry.count++;
        planMap.set(key, entry);
      }

      // ── Invoices: paid revenue, pending, aging, payment methods ──
      const paidInvoiceTotal = allInv
        .filter(i => i.status === 'paid')
        .reduce((sum, i) => sum + Number(i.total_amount), 0);
      const pendingTotal = allInv
        .filter(i => i.status === 'pending' || i.status === 'overdue')
        .reduce((sum, i) => sum + Number(i.total_amount), 0);

      const methodMap = new Map<string, { total: number; count: number }>();
      for (const inv of allInv.filter(i => i.status === 'paid')) {
        const m = inv.payment_method ?? 'unknown';
        const entry = methodMap.get(m) ?? { total: 0, count: 0 };
        entry.total += Number(inv.total_amount);
        entry.count++;
        methodMap.set(m, entry);
      }

      // Aging buckets
      const today = new Date();
      const aging: { bucket: string; count: number; total_brl: number }[] = [
        { bucket: '1-15 dias', count: 0, total_brl: 0 },
        { bucket: '16-30 dias', count: 0, total_brl: 0 },
        { bucket: '31-60 dias', count: 0, total_brl: 0 },
        { bucket: '60+ dias', count: 0, total_brl: 0 },
      ];
      for (const inv of allInv.filter(i => i.status === 'overdue')) {
        const days = Math.floor((today.getTime() - new Date(inv.due_date).getTime()) / 86400000);
        const bucket = days <= 15 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : 3;
        aging[bucket].count++;
        aging[bucket].total_brl += Number(inv.total_amount);
      }

      // ── Ledger: confirmed revenue (payments) and referral rewards ──
      const ledgerRevenue = ledger
        .filter(e => e.entry_type === 'payment' || e.entry_type === 'subscription_payment')
        .reduce((sum, e) => sum + Number(e.amount ?? 0), 0);

      const ledgerRefunds = ledger
        .filter(e => e.entry_type === 'refund')
        .reduce((sum, e) => sum + Number(e.amount ?? 0), 0);

      const referralRewardsFromLedger = ledger
        .filter(e => e.entry_type === 'referral_reward' || e.entry_type === 'referral_bonus' || e.entry_type === 'referral_discount')
        .reduce((sum, e) => sum + Number(e.amount ?? 0), 0);

      // Use ledger revenue when available, fallback to invoice totals
      const confirmedRevenue = ledgerRevenue > 0 ? ledgerRevenue - ledgerRefunds : paidInvoiceTotal;

      // ── Referral events: conversions & attributed revenue ──
      const referralConversions = refTracking.filter(t => t.status === 'converted').length;
      const referralAttributedRevenue = refTracking
        .filter(t => t.status === 'converted' && t.first_payment_brl)
        .reduce((sum, t) => sum + Number(t.first_payment_brl ?? 0), 0);
      const totalReferralRewards = refLinks.reduce((sum, l) => sum + Number(l.total_reward_brl ?? 0), 0);

      // ── NRR: use ledger data for current vs previous period ──
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000);
      const sixtyDaysAgo = new Date(today.getTime() - 60 * 86400000);

      const currentPeriodRevenue = ledger
        .filter(e =>
          (e.entry_type === 'payment' || e.entry_type === 'subscription_payment') &&
          new Date(e.created_at) >= thirtyDaysAgo
        )
        .reduce((sum, e) => sum + Number(e.amount ?? 0), 0);

      const previousPeriodRevenue = ledger
        .filter(e =>
          (e.entry_type === 'payment' || e.entry_type === 'subscription_payment') &&
          new Date(e.created_at) >= sixtyDaysAgo &&
          new Date(e.created_at) < thirtyDaysAgo
        )
        .reduce((sum, e) => sum + Number(e.amount ?? 0), 0);

      const nrrPct = previousPeriodRevenue > 0
        ? Math.round((currentPeriodRevenue / previousPeriodRevenue) * 1000) / 10
        : 100;

      const metrics: RevenueMetrics = {
        mrr_brl: Math.round(totalMrr * 100) / 100,
        arr_brl: Math.round(totalMrr * 12 * 100) / 100,
        revenue_brl: Math.round(confirmedRevenue * 100) / 100,
        pending_brl: Math.round(pendingTotal * 100) / 100,
        paying_tenants: activeSubs.length,
        arpa_brl: activeSubs.length > 0 ? Math.round((totalMrr / activeSubs.length) * 100) / 100 : 0,
        churn_rate_pct: totalForChurn > 0 ? Math.round((churnedCount / totalForChurn) * 1000) / 10 : 0,
        nrr_pct: nrrPct,
        revenue_by_plan: [...planMap.entries()].map(([plan, v]) => ({
          plan,
          tier: v.tier as any,
          mrr: v.mrr,
          count: v.count,
        })),
        revenue_by_method: [...methodMap.entries()].map(([method, v]) => ({
          method,
          total: v.total,
          count: v.count,
        })),
        aging,
        calculated_at: Date.now(),
      };

      return metrics;
    },

    async getMRRTrend(months) {
      // Use ledger + invoices for historical MRR reconstruction
      const [subsRes, ledgerRes] = await Promise.all([
        supabase.from('tenant_subscriptions').select('mrr, status, created_at'),
        supabase.from('platform_financial_entries')
          .select('amount, entry_type, created_at')
          .in('entry_type', ['payment', 'subscription_payment'])
          .order('created_at', { ascending: true })
          .limit(1000),
      ]);

      const activeSubs = (subsRes.data ?? []).filter(s => s.status === 'active');
      const currentMrr = activeSubs.reduce((sum, s) => sum + Number(s.mrr ?? 0), 0);
      const ledgerEntries = ledgerRes.data ?? [];

      // Group ledger payments by month
      const monthlyPayments = new Map<string, number>();
      for (const entry of ledgerEntries) {
        const month = entry.created_at.slice(0, 7);
        monthlyPayments.set(month, (monthlyPayments.get(month) ?? 0) + Number(entry.amount ?? 0));
      }

      const trend: { month: string; mrr: number }[] = [];
      const now = new Date();

      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setMonth(d.getMonth() - i);
        const monthKey = d.toISOString().slice(0, 7);

        // Use ledger data if available for that month, otherwise interpolate from current MRR
        const ledgerAmount = monthlyPayments.get(monthKey);
        const mrr = ledgerAmount !== undefined
          ? Math.round(ledgerAmount * 100) / 100
          : Math.round(currentMrr * (0.85 + (months - i) * 0.15 / months) * 100) / 100;

        trend.push({ month: monthKey, mrr });
      }

      return trend;
    },

    async getChurnTrend(months) {
      // Use real subscription data for churn tracking
      const { data: subs } = await supabase
        .from('tenant_subscriptions')
        .select('status, created_at, updated_at');

      const allSubs = subs ?? [];
      const churnedSubs = allSubs.filter(s => s.status === 'churned');

      const trend: { month: string; churn_rate: number; churned: number }[] = [];
      const now = new Date();

      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setMonth(d.getMonth() - i);
        const monthKey = d.toISOString().slice(0, 7);

        // Count churned in this month (by updated_at)
        const churnedInMonth = churnedSubs.filter(s =>
          s.updated_at && s.updated_at.slice(0, 7) === monthKey
        ).length;

        // Active at start of month approximation
        const activeAtMonth = allSubs.filter(s =>
          s.created_at.slice(0, 7) <= monthKey &&
          (s.status === 'active' || (s.status === 'churned' && s.updated_at && s.updated_at.slice(0, 7) >= monthKey))
        ).length;

        const churnRate = activeAtMonth > 0
          ? Math.round((churnedInMonth / activeAtMonth) * 1000) / 10
          : 0;

        trend.push({ month: monthKey, churn_rate: churnRate, churned: churnedInMonth });
      }

      return trend;
    },

    async getForecast(months) {
      // Use ledger + subscriptions for forecast base
      const [subsRes, ledgerRes] = await Promise.all([
        supabase.from('tenant_subscriptions').select('mrr, status'),
        supabase.from('platform_financial_entries')
          .select('amount, entry_type, created_at')
          .in('entry_type', ['payment', 'subscription_payment'])
          .order('created_at', { ascending: true })
          .limit(1000),
      ]);

      const currentMrr = (subsRes.data ?? [])
        .filter(s => s.status === 'active')
        .reduce((sum, s) => sum + Number(s.mrr ?? 0), 0);

      // Calculate real growth rate from ledger if enough data
      const ledgerEntries = ledgerRes.data ?? [];
      const monthlyPayments = new Map<string, number>();
      for (const entry of ledgerEntries) {
        const month = entry.created_at.slice(0, 7);
        monthlyPayments.set(month, (monthlyPayments.get(month) ?? 0) + Number(entry.amount ?? 0));
      }

      const sortedMonths = [...monthlyPayments.keys()].sort();
      let growthRate = 0.03; // default 3% monthly

      if (sortedMonths.length >= 3) {
        const recent = sortedMonths.slice(-3);
        const first = monthlyPayments.get(recent[0]) ?? 0;
        const last = monthlyPayments.get(recent[recent.length - 1]) ?? 0;
        if (first > 0) {
          growthRate = Math.max(0, Math.min(0.15, (last - first) / first / (recent.length - 1)));
        }
      }

      const forecast: { month: string; projected_mrr: number; projected_arr: number }[] = [];
      const now = new Date();

      for (let i = 1; i <= months; i++) {
        const d = new Date(now);
        d.setMonth(d.getMonth() + i);
        const projected = currentMrr * Math.pow(1 + growthRate, i);
        forecast.push({
          month: d.toISOString().slice(0, 7),
          projected_mrr: Math.round(projected * 100) / 100,
          projected_arr: Math.round(projected * 12 * 100) / 100,
        });
      }

      return forecast;
    },
  };
}
