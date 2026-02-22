/**
 * UsageBillingEngine — Usage-Based Billing
 *
 * ├── UsageCollector      — Records raw usage events
 * ├── UsageAggregator     — Aggregates usage per metric/period
 * └── PricingCalculator   — Calculates cost from usage + pricing tiers
 *
 * All data persisted to Supabase (usage_records, usage_pricing_tiers).
 */

import { supabase } from '@/integrations/supabase/client';
import { emitBillingEvent } from './billing-events';
import type {
  UsageCollectorAPI,
  UsageAggregatorAPI,
  UsagePricingCalculatorAPI,
  UsageBillingEngineAPI,
  UsageRecord,
  UsageAggregate,
  UsagePricingTier,
  UsageCostBreakdown,
  UsageCostLineItem,
} from './types';

// ══════════════════════════════════════════════════════════════════
// UsageCollector — Records metered events
// ══════════════════════════════════════════════════════════════════

function createUsageCollector(): UsageCollectorAPI {
  return {
    async record(tenantId, metricKey, quantity, opts) {
      const now = new Date();
      const periodStart = opts?.billing_period_start ?? now.toISOString().slice(0, 10);
      const periodEnd = opts?.billing_period_end ?? new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from('usage_records')
        .insert([{
          tenant_id: tenantId,
          metric_key: metricKey,
          metric_type: opts?.metric_type ?? 'api_calls',
          module_id: opts?.module_id ?? null,
          quantity,
          unit: opts?.unit ?? 'unit',
          billing_period_start: periodStart,
          billing_period_end: periodEnd,
          source: opts?.source ?? 'system',
          metadata: (opts?.metadata ?? {}) as any,
        }])
        .select()
        .single();

      if (error) throw new Error(`UsageCollector.record: ${error.message}`);
      const record = data as unknown as UsageRecord;

      emitBillingEvent({
        type: 'UsageRecorded',
        timestamp: Date.now(),
        tenant_id: tenantId,
        metric: metricKey,
        quantity,
        unit: opts?.unit ?? 'unit',
      });

      return record;
    },

    async recordBatch(tenantId, records) {
      const rows = records.map(r => ({
        tenant_id: tenantId,
        metric_key: r.metric_key,
        metric_type: r.metric_type ?? 'api_calls',
        module_id: r.module_id ?? null,
        quantity: r.quantity,
        unit: r.unit ?? 'unit',
        billing_period_start: r.billing_period_start,
        billing_period_end: r.billing_period_end,
        source: r.source ?? 'system',
        metadata: (r.metadata ?? {}) as any,
      }));

      const { data, error } = await supabase
        .from('usage_records')
        .insert(rows)
        .select();

      if (error) throw new Error(`UsageCollector.recordBatch: ${error.message}`);
      return (data ?? []) as unknown as UsageRecord[];
    },

    async getByTenant(tenantId, opts) {
      let query = supabase
        .from('usage_records')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('recorded_at', { ascending: false });

      if (opts?.metric_key) query = query.eq('metric_key', opts.metric_key);
      if (opts?.metric_type) query = query.eq('metric_type', opts.metric_type);
      if (opts?.module_id) query = query.eq('module_id', opts.module_id);
      if (opts?.period_start) query = query.gte('billing_period_start', opts.period_start);
      if (opts?.period_end) query = query.lte('billing_period_end', opts.period_end);
      if (opts?.limit) query = query.limit(opts.limit);

      const { data, error } = await query;
      if (error) throw new Error(`UsageCollector.getByTenant: ${error.message}`);
      return (data ?? []) as unknown as UsageRecord[];
    },
  };
}

// ══════════════════════════════════════════════════════════════════
// UsageAggregator — Aggregates raw records into totals per metric
// ══════════════════════════════════════════════════════════════════

function createUsageAggregator(): UsageAggregatorAPI {
  return {
    async aggregate(tenantId, periodStart, periodEnd) {
      const { data, error } = await supabase
        .from('usage_records')
        .select('metric_key, quantity, unit')
        .eq('tenant_id', tenantId)
        .gte('billing_period_start', periodStart)
        .lte('billing_period_end', periodEnd);

      if (error) throw new Error(`UsageAggregator.aggregate: ${error.message}`);

      const map = new Map<string, UsageAggregate>();
      for (const row of data ?? []) {
        const key = row.metric_key;
        const existing = map.get(key);
        if (existing) {
          existing.total_quantity += Number(row.quantity);
          existing.record_count++;
        } else {
          map.set(key, {
            tenant_id: tenantId,
            metric_key: key,
            total_quantity: Number(row.quantity),
            unit: row.unit,
            period_start: periodStart,
            period_end: periodEnd,
            record_count: 1,
          });
        }
      }

      return [...map.values()];
    },

    async aggregateMetric(tenantId, metricKey, periodStart, periodEnd) {
      const aggregates = await this.aggregate(tenantId, periodStart, periodEnd);
      return aggregates.find(a => a.metric_key === metricKey) ?? {
        tenant_id: tenantId,
        metric_key: metricKey,
        total_quantity: 0,
        unit: 'unit',
        period_start: periodStart,
        period_end: periodEnd,
        record_count: 0,
      };
    },
  };
}

// ══════════════════════════════════════════════════════════════════
// PricingCalculator — Applies pricing tiers to aggregated usage
// ══════════════════════════════════════════════════════════════════

function createUsagePricingCalculator(): UsagePricingCalculatorAPI {
  return {
    async getTiers(planId, metricKey) {
      const { data, error } = await supabase
        .from('usage_pricing_tiers')
        .select('*')
        .eq('plan_id', planId)
        .eq('metric_key', metricKey)
        .eq('is_active', true)
        .order('tier_start', { ascending: true });

      if (error) throw new Error(`PricingCalculator.getTiers: ${error.message}`);
      return (data ?? []) as unknown as UsagePricingTier[];
    },

    async calculateCost(planId, aggregates) {
      const lineItems: UsageCostLineItem[] = [];
      let totalBrl = 0;

      for (const agg of aggregates) {
        const tiers = await this.getTiers(planId, agg.metric_key);
        if (tiers.length === 0) continue;

        let remaining = agg.total_quantity;
        let metricCost = 0;

        for (const tier of tiers) {
          if (remaining <= 0) break;

          // Subtract included/free quantity
          const effectiveStart = Math.max(0, Number(tier.tier_start) - Number(tier.included_quantity));
          const tierRange = tier.tier_end != null
            ? Number(tier.tier_end) - Number(tier.tier_start)
            : remaining;
          const billableInTier = Math.min(remaining, tierRange);

          const model = tier.pricing_model;
          let tierCost = Number(tier.flat_fee_brl);

          if (model === 'tiered' || model === 'graduated') {
            // Graduated: each tier priced independently
            const freeInTier = Math.min(billableInTier, Number(tier.included_quantity));
            const paidInTier = Math.max(0, billableInTier - freeInTier);
            tierCost += paidInTier * Number(tier.unit_price_brl);
          } else if (model === 'volume') {
            // Volume: all units at this tier's price if quantity falls in range
            tierCost += agg.total_quantity * Number(tier.unit_price_brl);
            remaining = 0; // volume pricing uses total, not per-tier
          } else if (model === 'flat') {
            // Flat: fixed fee if any usage exists
            tierCost += billableInTier > 0 ? Number(tier.flat_fee_brl) : 0;
          }

          metricCost += tierCost;
          remaining -= billableInTier;
        }

        metricCost = Math.round(metricCost * 100) / 100;
        totalBrl += metricCost;

        lineItems.push({
          metric_key: agg.metric_key,
          quantity: agg.total_quantity,
          unit: agg.unit,
          unit_price_brl: tiers.length > 0 ? Number(tiers[0].unit_price_brl) : 0,
          total_brl: metricCost,
          tiers_applied: tiers.length,
          pricing_model: tiers[0]?.pricing_model ?? 'tiered',
        });
      }

      return {
        plan_id: planId,
        line_items: lineItems,
        total_usage_brl: Math.round(totalBrl * 100) / 100,
        calculated_at: Date.now(),
      };
    },

    async setTiers(planId, metricKey, tiers) {
      // Deactivate existing
      await supabase
        .from('usage_pricing_tiers')
        .update({ is_active: false })
        .eq('plan_id', planId)
        .eq('metric_key', metricKey);

      // Insert new
      const rows = tiers.map(t => ({
        plan_id: planId,
        metric_key: metricKey,
        module_id: t.module_id ?? null,
        metric_type: t.metric_type ?? 'api_calls',
        tier_start: t.tier_start,
        tier_end: t.tier_end ?? null,
        unit_price_brl: t.unit_price_brl,
        price_per_unit: t.price_per_unit ?? t.unit_price_brl,
        flat_fee_brl: t.flat_fee_brl ?? 0,
        included_quantity: t.included_quantity ?? 0,
        overage_price: t.overage_price ?? t.unit_price_brl,
        pricing_model: t.pricing_model ?? 'tiered',
        is_active: true,
      }));

      const { error } = await supabase
        .from('usage_pricing_tiers')
        .insert(rows);

      if (error) throw new Error(`PricingCalculator.setTiers: ${error.message}`);
    },

    async getRulesForModule(planId, moduleId) {
      const { data, error } = await supabase
        .from('usage_pricing_tiers')
        .select('*')
        .eq('plan_id', planId)
        .eq('module_id', moduleId)
        .eq('is_active', true);

      if (error) throw new Error(`PricingCalculator.getRulesForModule: ${error.message}`);
      return (data ?? []).map((t) => ({
        module_id: t.module_id ?? '',
        metric_type: t.metric_type as 'users' | 'api_calls' | 'storage' | 'executions',
        price_per_unit: Number(t.price_per_unit),
        included_quota: Number(t.included_quantity),
        overage_price: Number(t.overage_price),
      }));
    },
  };
}

// ══════════════════════════════════════════════════════════════════
// Aggregate: UsageBillingEngine
// ══════════════════════════════════════════════════════════════════

export function createUsageBillingEngine(): UsageBillingEngineAPI {
  const collector = createUsageCollector();
  const aggregator = createUsageAggregator();
  const pricing = createUsagePricingCalculator();

  return {
    collector,
    aggregator,
    pricing,

    async calculateTenantUsageCost(tenantId, planId, periodStart, periodEnd) {
      const aggregates = await aggregator.aggregate(tenantId, periodStart, periodEnd);
      const cost = await pricing.calculateCost(planId, aggregates);

      // Emit UsageOverageCalculated for each line item with overage
      for (const item of cost.line_items) {
        if (item.total_brl > 0) {
          emitBillingEvent({
            type: 'UsageOverageCalculated',
            timestamp: Date.now(),
            tenant_id: tenantId,
            metric: item.metric_key,
            included_qty: 0, // resolved from tiers
            actual_qty: item.quantity,
            overage_qty: item.quantity,
            overage_amount_brl: item.total_brl,
          });
        }
      }

      return cost;
    },
  };
}
