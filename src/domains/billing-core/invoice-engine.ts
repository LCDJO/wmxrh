/**
 * InvoiceEngine — Geração e gestão de faturas via Supabase
 */

import { supabase } from '@/integrations/supabase/client';
import type { InvoiceEngineAPI, Invoice, CreateInvoiceDTO, InvoiceStatus, InvoiceLine } from './types';

function mapRowToInvoice(row: any): Invoice {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    ...row,
    lines: (metadata.lines as InvoiceLine[] | undefined) ?? [],
    metadata,
  };
}

export function createInvoiceEngine(): InvoiceEngineAPI {
  return {
    async generate(tenantId, dto) {
      const metadata: Record<string, unknown> = { ...(dto.metadata ?? {}) };
      if (dto.lines?.length) metadata.lines = dto.lines;

      const { data, error } = await supabase
        .from('invoices')
        .insert([{
          tenant_id: tenantId,
          plan_id: dto.plan_id ?? null,
          subscription_id: dto.subscription_id ?? null,
          total_amount: dto.total_amount,
          currency: dto.currency ?? 'BRL',
          billing_period_start: dto.billing_period_start,
          billing_period_end: dto.billing_period_end,
          due_date: dto.due_date,
          payment_method: dto.payment_method ?? null,
          notes: dto.notes ?? null,
          status: 'pending' as const,
          metadata: metadata as any,
        }])
        .select()
        .single();

      if (error) throw new Error(`InvoiceEngine.generate: ${error.message}`);
      return mapRowToInvoice(data);
    },

    async getById(invoiceId) {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .maybeSingle();

      if (error) throw new Error(`InvoiceEngine.getById: ${error.message}`);
      return data ? mapRowToInvoice(data) : null;
    },

    async listByTenant(tenantId, opts) {
      let query = supabase
        .from('invoices')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (opts?.status) query = query.eq('status', opts.status);
      if (opts?.limit) query = query.limit(opts.limit);

      const { data, error } = await query;
      if (error) throw new Error(`InvoiceEngine.listByTenant: ${error.message}`);
      return (data ?? []).map(mapRowToInvoice);
    },

    async listAll(opts) {
      let query = supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (opts?.status) query = query.eq('status', opts.status);
      if (opts?.limit) query = query.limit(opts.limit);
      if (opts?.offset) query = query.range(opts.offset, opts.offset + (opts.limit ?? 50) - 1);

      const { data, error } = await query;
      if (error) throw new Error(`InvoiceEngine.listAll: ${error.message}`);
      return (data ?? []).map(mapRowToInvoice);
    },

    async markPaid(invoiceId, paidAt, method) {
      const updates: Record<string, unknown> = {
        status: 'paid',
        paid_at: paidAt ?? new Date().toISOString(),
      };
      if (method) updates.payment_method = method;

      const { data, error } = await supabase
        .from('invoices')
        .update(updates)
        .eq('id', invoiceId)
        .select()
        .single();

      if (error) throw new Error(`InvoiceEngine.markPaid: ${error.message}`);
      return mapRowToInvoice(data);
    },

    async cancel(invoiceId) {
      const { data, error } = await supabase
        .from('invoices')
        .update({ status: 'cancelled' })
        .eq('id', invoiceId)
        .select()
        .single();

      if (error) throw new Error(`InvoiceEngine.cancel: ${error.message}`);
      return mapRowToInvoice(data);
    },

    async markOverdueInvoices() {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('invoices')
        .update({ status: 'overdue' })
        .eq('status', 'pending')
        .lt('due_date', today)
        .select('id');

      if (error) throw new Error(`InvoiceEngine.markOverdue: ${error.message}`);
      return data?.length ?? 0;
    },

    async getPendingAmount(tenantId) {
      const { data, error } = await supabase
        .from('invoices')
        .select('total_amount')
        .eq('tenant_id', tenantId)
        .in('status', ['pending', 'overdue']);

      if (error) throw new Error(`InvoiceEngine.getPendingAmount: ${error.message}`);
      return (data ?? []).reduce((sum, inv) => sum + Number(inv.total_amount), 0);
    },
  };
}
