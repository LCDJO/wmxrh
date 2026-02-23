/**
 * Agreement Automatic Renewal Engine
 *
 * Scans signed agreements with `renovacao_obrigatoria = true` and
 * `expiry_days` set on their templates. When an agreement approaches
 * expiration, the engine:
 *   1. Emits 'agreement.renewal_required' event
 *   2. Creates a new EmployeeAgreement (versao + 1, status 'pending')
 *   3. Notifies via in-app notification
 *
 * Designed to be called by a scheduled cron / edge function.
 *
 * Config per template:
 *   - expiry_days: total validity in days from signed_at
 *   - renovacao_obrigatoria: whether auto-renewal is enabled
 *   - notify_days_before: days before expiry to trigger (default 30)
 */

import { supabase } from '@/integrations/supabase/client';
import { emitAgreementEvent } from './events';

// ── Types ──

export interface RenewalScanResult {
  scanned: number;
  renewed: number;
  notified: number;
  errors: string[];
}

interface RenewableTemplate {
  id: string;
  expiry_days: number;
  name: string;
}

interface RenewableAgreement {
  id: string;
  employee_id: string;
  template_id: string;
  template_version_id: string;
  tenant_id: string;
  company_id: string | null;
  signed_at: string;
  versao: number;
}

// Default: notify 30 days before expiry
const DEFAULT_NOTIFY_DAYS_BEFORE = 30;

// ── Engine ──

export const agreementRenewalEngine = {

  /**
   * Scan all signed agreements for a tenant and process renewals
   * for those approaching expiration with renovacao_obrigatoria = true.
   */
  async processUpcomingRenewals(tenantId: string): Promise<RenewalScanResult> {
    const result: RenewalScanResult = { scanned: 0, renewed: 0, notified: 0, errors: [] };

    // 1. Get all templates with renewal enabled
    const { data: templates, error: tErr } = await supabase
      .from('agreement_templates')
      .select('id, expiry_days, name')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .eq('renovacao_obrigatoria', true)
      .not('expiry_days', 'is', null);

    if (tErr || !templates?.length) return result;

    const renewableTemplates: RenewableTemplate[] = templates
      .filter((t: any) => t.expiry_days > 0)
      .map((t: any) => ({ id: t.id, expiry_days: t.expiry_days, name: t.name }));

    if (renewableTemplates.length === 0) return result;

    // 2. Get signed agreements for these templates
    const templateIds = renewableTemplates.map(t => t.id);
    const { data: agreements, error: aErr } = await supabase
      .from('employee_agreements')
      .select('id, employee_id, template_id, template_version_id, tenant_id, company_id, signed_at, versao')
      .eq('tenant_id', tenantId)
      .eq('status', 'signed')
      .in('template_id', templateIds)
      .not('signed_at', 'is', null);

    if (aErr || !agreements?.length) return result;

    result.scanned = agreements.length;
    const now = new Date();
    const expiryMap = new Map(renewableTemplates.map(t => [t.id, t]));

    for (const agr of agreements) {
      const a = agr as unknown as RenewableAgreement;
      const template = expiryMap.get(a.template_id);
      if (!template) continue;

      const signedAt = new Date(a.signed_at);
      const expiryDate = new Date(signedAt.getTime() + template.expiry_days * 24 * 60 * 60 * 1000);
      const notifyDate = new Date(expiryDate.getTime() - DEFAULT_NOTIFY_DAYS_BEFORE * 24 * 60 * 60 * 1000);

      // Not yet in renewal window
      if (now < notifyDate) continue;

      // Check if a renewal (newer versao) already exists
      const { data: existingRenewal } = await supabase
        .from('employee_agreements')
        .select('id')
        .eq('employee_id', a.employee_id)
        .eq('template_id', a.template_id)
        .eq('tenant_id', a.tenant_id)
        .gt('versao', a.versao)
        .in('status', ['pending', 'sent', 'signed'])
        .limit(1)
        .maybeSingle();

      if (existingRenewal) continue; // Already renewed

      // Create renewal agreement
      try {
        const newVersao = a.versao + 1;
        const { data: newAgreement, error: insertErr } = await supabase
          .from('employee_agreements')
          .insert([{
            employee_id: a.employee_id,
            template_id: a.template_id,
            template_version_id: a.template_version_id,
            tenant_id: a.tenant_id,
            company_id: a.company_id,
            status: 'pending',
            versao: newVersao,
          }])
          .select('id')
          .single();

        if (insertErr) {
          result.errors.push(`Employee ${a.employee_id}, template ${template.name}: ${insertErr.message}`);
          continue;
        }

        result.renewed++;

        // Emit renewal event
        emitAgreementEvent({
          type: 'agreement.renewal_required' as any,
          tenant_id: a.tenant_id,
          employee_id: a.employee_id,
          agreement_id: newAgreement?.id,
          template_id: a.template_id,
          payload: {
            original_agreement_id: a.id,
            versao: newVersao,
            expiry_date: expiryDate.toISOString(),
            template_name: template.name,
            reason: 'renovacao_obrigatoria',
          },
          timestamp: now.toISOString(),
        });

        // Create in-app notification
        try {
          const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          await supabase.from('notifications' as any).insert({
            tenant_id: a.tenant_id,
            employee_id: a.employee_id,
            type: 'agreement_renewal_required',
            title: `Renovação obrigatória: ${template.name}`,
            message: daysUntilExpiry > 0
              ? `O termo "${template.name}" vence em ${daysUntilExpiry} dias. Um novo termo foi gerado e aguarda sua assinatura.`
              : `O termo "${template.name}" venceu. Um novo termo foi gerado e requer assinatura imediata.`,
            metadata: {
              agreement_id: newAgreement?.id,
              original_agreement_id: a.id,
              template_id: a.template_id,
              expiry_date: expiryDate.toISOString(),
            },
          });
          result.notified++;
        } catch {
          // Non-blocking — notification is supplementary
        }

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Renewal failed for employee ${a.employee_id}: ${msg}`);
      }
    }

    console.log(
      `[RenewalEngine] Tenant ${tenantId}: scanned=${result.scanned}, renewed=${result.renewed}, notified=${result.notified}`,
    );
    return result;
  },

  /**
   * Check if a specific signed agreement needs renewal.
   */
  async needsRenewal(agreementId: string): Promise<{
    needs_renewal: boolean;
    days_until_expiry: number | null;
    expiry_date: string | null;
  }> {
    const { data: agr } = await supabase
      .from('employee_agreements')
      .select('template_id, signed_at, status, versao')
      .eq('id', agreementId)
      .single();

    if (!agr || (agr as any).status !== 'signed' || !(agr as any).signed_at) {
      return { needs_renewal: false, days_until_expiry: null, expiry_date: null };
    }

    const { data: tpl } = await supabase
      .from('agreement_templates')
      .select('expiry_days, renovacao_obrigatoria')
      .eq('id', (agr as any).template_id)
      .single();

    if (!tpl || !(tpl as any).expiry_days || !(tpl as any).renovacao_obrigatoria) {
      return { needs_renewal: false, days_until_expiry: null, expiry_date: null };
    }

    const signedAt = new Date((agr as any).signed_at);
    const expiryDate = new Date(signedAt.getTime() + (tpl as any).expiry_days * 24 * 60 * 60 * 1000);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
      needs_renewal: daysUntilExpiry <= DEFAULT_NOTIFY_DAYS_BEFORE,
      days_until_expiry: daysUntilExpiry,
      expiry_date: expiryDate.toISOString(),
    };
  },
};
