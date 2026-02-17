/**
 * FinancialLedgerAdapter — Registro contábil in-memory
 *
 * Mantém histórico de charges, payments, refunds e credits por tenant.
 * Futuro: persistir no banco via tabela `financial_ledger`.
 */

import type { FinancialLedgerAdapterAPI, LedgerEntry, LedgerEntryType } from './types';

export function createFinancialLedgerAdapter(): FinancialLedgerAdapterAPI {
  const entries = new Map<string, LedgerEntry[]>();
  const balances = new Map<string, number>();
  let seq = 0;

  function getEntries(tenantId: string): LedgerEntry[] {
    if (!entries.has(tenantId)) entries.set(tenantId, []);
    return entries.get(tenantId)!;
  }

  function record(
    tenantId: string,
    entryType: LedgerEntryType,
    amount: number,
    description: string,
    invoiceId: string | null = null,
    referenceId: string | null = null
  ): LedgerEntry {
    const currentBalance = balances.get(tenantId) ?? 0;
    const signedAmount = entryType === 'charge' ? amount : -amount;
    const newBalance = currentBalance + signedAmount;
    balances.set(tenantId, newBalance);

    const entry: LedgerEntry = {
      id: `ledger_${++seq}`,
      tenant_id: tenantId,
      invoice_id: invoiceId,
      entry_type: entryType,
      amount_brl: amount,
      balance_after_brl: newBalance,
      description,
      reference_id: referenceId,
      created_at: Date.now(),
    };

    getEntries(tenantId).push(entry);
    return entry;
  }

  return {
    recordCharge(tenantId, invoiceId, amount, description) {
      return record(tenantId, 'charge', amount, description, invoiceId);
    },

    recordPayment(tenantId, invoiceId, amount, method) {
      return record(tenantId, 'payment', amount, `Pagamento via ${method}`, invoiceId);
    },

    recordRefund(tenantId, invoiceId, amount, reason) {
      return record(tenantId, 'refund', amount, `Reembolso: ${reason}`, invoiceId);
    },

    recordCredit(tenantId, amount, description) {
      return record(tenantId, 'credit', amount, description);
    },

    getBalance(tenantId) {
      return balances.get(tenantId) ?? 0;
    },

    getHistory(tenantId, limit = 50) {
      return getEntries(tenantId).slice(-limit).reverse();
    },
  };
}
