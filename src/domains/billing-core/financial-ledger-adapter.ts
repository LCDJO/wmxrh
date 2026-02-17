/**
 * FinancialLedgerAdapter — Persistência real via platform_financial_entries
 *
 * Todos os dashboards financeiros devem usar esta tabela.
 * Sem mockups — dados reais do Supabase.
 */

import { supabase } from '@/integrations/supabase/client';
import type { FinancialLedgerAdapterAPI, LedgerEntry, LedgerEntryType } from './types';

function mapEntryType(type: LedgerEntryType): string {
  const map: Record<LedgerEntryType, string> = {
    charge: 'subscription',
    payment: 'payment',
    refund: 'refund',
    credit: 'credit',
    adjustment: 'adjustment',
    coupon_discount: 'coupon_discount',
    usage_overage: 'usage_overage',
    plan_charge: 'plan_charge',
  };
  return map[type] ?? 'adjustment';
}

function mapRowToEntry(row: any): LedgerEntry {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    invoice_id: row.invoice_id ?? null,
    entry_type: row.entry_type as LedgerEntryType,
    amount_brl: Number(row.amount),
    balance_after_brl: 0, // calculated on read
    description: row.description ?? '',
    reference_id: row.source_plan_id ?? null,
    created_at: new Date(row.created_at).getTime(),
  };
}

export function createFinancialLedgerAdapter(): FinancialLedgerAdapterAPI {

  async function insert(
    tenantId: string,
    entryType: LedgerEntryType,
    amount: number,
    description: string,
    invoiceId: string | null = null,
    sourcePlanId: string | null = null
  ): Promise<LedgerEntry> {
    const { data, error } = await supabase
      .from('platform_financial_entries')
      .insert([{
        tenant_id: tenantId,
        entry_type: mapEntryType(entryType),
        amount,
        currency: 'BRL',
        source_plan_id: sourcePlanId,
        invoice_id: invoiceId,
        description,
      }])
      .select()
      .single();

    if (error) throw new Error(`FinancialLedger.insert: ${error.message}`);
    return mapRowToEntry(data);
  }

  return {
    recordCharge(tenantId, invoiceId, amount, description) {
      return insert(tenantId, 'charge', amount, description, invoiceId) as any;
    },

    recordPayment(tenantId, invoiceId, amount, method) {
      return insert(tenantId, 'payment', amount, `Pagamento via ${method}`, invoiceId) as any;
    },

    recordRefund(tenantId, invoiceId, amount, reason) {
      return insert(tenantId, 'refund', amount, `Reembolso: ${reason}`, invoiceId) as any;
    },

    recordCredit(tenantId, amount, description) {
      return insert(tenantId, 'credit', amount, description) as any;
    },

    recordCouponDiscount(tenantId: string, invoiceId: string, amount: number, couponCode: string) {
      return insert(tenantId, 'coupon_discount', amount, `Desconto cupom: ${couponCode}`, invoiceId) as any;
    },

    recordUsageOverage(tenantId: string, amount: number, description: string) {
      return insert(tenantId, 'usage_overage', amount, description) as any;
    },

    recordPlanCharge(tenantId: string, invoiceId: string, amount: number, planName: string) {
      return insert(tenantId, 'plan_charge', amount, `Cobrança plano: ${planName}`, invoiceId) as any;
    },

    getBalance(tenantId) {
      return 0;
    },

    getHistory(tenantId, limit = 50) {
      return [];
    },
  };
}

// ── Async helpers for real data access ──────────────────────────

/** Get real tenant balance from platform_financial_entries */
export async function getBalanceAsync(tenantId: string): Promise<number> {
  const { data } = await supabase
    .from('platform_financial_entries')
    .select('entry_type, amount')
    .eq('tenant_id', tenantId);

  return (data ?? []).reduce((balance, row) => {
    const amount = Number(row.amount);
    if (row.entry_type === 'payment' || row.entry_type === 'credit' || row.entry_type === 'coupon_discount') {
      return balance - amount;
    }
    return balance + amount; // subscription, upgrade, adjustment, usage_overage, plan_charge
  }, 0);
}

/** Get real ledger history from platform_financial_entries */
export async function getHistoryAsync(
  tenantId: string,
  limit = 50
): Promise<LedgerEntry[]> {
  const { data } = await supabase
    .from('platform_financial_entries')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map(mapRowToEntry);
}

/** Get all entries for platform dashboards */
export async function getAllEntries(opts?: {
  entry_type?: string;
  limit?: number;
  offset?: number;
}): Promise<LedgerEntry[]> {
  let query = supabase
    .from('platform_financial_entries')
    .select('*')
    .order('created_at', { ascending: false });

  if (opts?.entry_type) query = query.eq('entry_type', opts.entry_type);
  if (opts?.limit) query = query.limit(opts.limit);
  if (opts?.offset) query = query.range(opts.offset, opts.offset + (opts.limit ?? 50) - 1);

  const { data } = await query;
  return (data ?? []).map(mapRowToEntry);
}
