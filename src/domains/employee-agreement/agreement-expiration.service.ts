/**
 * Agreement Expiration Service
 *
 * Handles automatic expiration of employee agreements based on
 * the `expiry_days` field in agreement_templates.
 *
 * Logic:
 *   - For each agreement with status 'sent' or 'pending':
 *     - Look up the template's expiry_days
 *     - If expiry_days is set and (created_at + expiry_days) < now → mark as 'expired'
 *   - Emits 'agreement.expired' domain event for each expired agreement
 *
 * Can be called:
 *   - Manually from dashboard
 *   - Via scheduled cron (edge function)
 */

import { supabase } from '@/integrations/supabase/client';
import { emitAgreementEvent } from './events';

export interface ExpirationResult {
  scanned: number;
  expired: number;
  errors: string[];
}

export const agreementExpirationService = {

  /**
   * Scan all pending/sent agreements for a tenant and expire those
   * past their template's expiry_days.
   */
  async processExpirations(tenantId: string): Promise<ExpirationResult> {
    const result: ExpirationResult = { scanned: 0, expired: 0, errors: [] };

    // 1. Get all templates with expiry_days set
    const { data: templates, error: tErr } = await supabase
      .from('agreement_templates')
      .select('id, expiry_days')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .not('expiry_days', 'is', null);

    if (tErr || !templates?.length) return result;

    const expiryMap = new Map<string, number>();
    for (const t of templates) {
      if ((t as any).expiry_days > 0) {
        expiryMap.set(t.id, (t as any).expiry_days);
      }
    }

    if (expiryMap.size === 0) return result;

    // 2. Get pending/sent agreements for those templates
    const { data: agreements, error: aErr } = await supabase
      .from('employee_agreements')
      .select('id, template_id, created_at, status, employee_id')
      .eq('tenant_id', tenantId)
      .in('status', ['pending', 'sent'])
      .in('template_id', Array.from(expiryMap.keys()));

    if (aErr || !agreements?.length) return result;

    result.scanned = agreements.length;
    const now = new Date();

    // 3. Check each agreement
    const toExpire: string[] = [];
    const expiredAgreements: { id: string; employee_id: string }[] = [];

    for (const agr of agreements) {
      const a = agr as any;
      const expiryDays = expiryMap.get(a.template_id);
      if (!expiryDays) continue;

      const createdAt = new Date(a.created_at);
      const expiryDate = new Date(createdAt.getTime() + expiryDays * 24 * 60 * 60 * 1000);

      if (now > expiryDate) {
        toExpire.push(a.id);
        expiredAgreements.push({ id: a.id, employee_id: a.employee_id });
      }
    }

    if (toExpire.length === 0) return result;

    // 4. Batch update to expired
    const { error: uErr } = await supabase
      .from('employee_agreements')
      .update({ status: 'expired', expired_at: now.toISOString() } as any)
      .in('id', toExpire);

    if (uErr) {
      result.errors.push(`Batch update failed: ${uErr.message}`);
      return result;
    }

    result.expired = toExpire.length;

    // 5. Emit events
    for (const agr of expiredAgreements) {
      emitAgreementEvent({
        type: 'agreement.expired',
        tenant_id: tenantId,
        agreement_id: agr.id,
        employee_id: agr.employee_id,
        payload: { reason: 'expiry_days_exceeded' },
        timestamp: now.toISOString(),
      });
    }

    console.log(`[ExpirationService] Tenant ${tenantId}: scanned=${result.scanned}, expired=${result.expired}`);
    return result;
  },

  /**
   * Check if a specific agreement is expired based on its template.
   */
  async isExpired(agreementId: string): Promise<boolean> {
    const { data: agr } = await supabase
      .from('employee_agreements')
      .select('template_id, created_at, status')
      .eq('id', agreementId)
      .single();

    if (!agr) return false;
    const a = agr as any;
    if (a.status === 'expired') return true;
    if (a.status === 'signed') return false;

    const { data: tpl } = await supabase
      .from('agreement_templates')
      .select('expiry_days')
      .eq('id', a.template_id)
      .single();

    if (!tpl || !(tpl as any).expiry_days) return false;

    const createdAt = new Date(a.created_at);
    const expiryDate = new Date(createdAt.getTime() + (tpl as any).expiry_days * 24 * 60 * 60 * 1000);
    return new Date() > expiryDate;
  },
};
