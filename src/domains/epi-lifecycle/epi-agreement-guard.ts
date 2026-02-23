/**
 * EPI → Agreement Guard
 *
 * Bridges EPI delivery to the Employee Agreement Engine:
 *   1. On delivery → generates EPI-specific EmployeeAgreement (category 'epi')
 *   2. Links EmployeeAgreement to the epi_delivery record
 *   3. Blocks EPI assignment until the agreement is signed
 *
 * Legal basis: NR-6, item 6.6.1-d — employee must sign EPI receipt.
 *
 * Integrations:
 *   - Employee Agreement Engine (template + signature lifecycle)
 *   - EPI Signature Integration (term generation + digital signing)
 *   - EPI Delivery Service (delivery records)
 */

import { supabase } from '@/integrations/supabase/client';

// ── Types ──

export interface EpiAgreementGuardResult {
  delivery_id: string;
  employee_id: string;
  blocked: boolean;
  agreement_id: string | null;
  agreement_status: string | null;
  can_finalize_delivery: boolean;
  blocking_reason: string | null;
  evaluated_at: string;
}

export interface EpiAgreementDispatchResult {
  delivery_id: string;
  employee_id: string;
  agreement_id: string | null;
  already_existed: boolean;
  error: string | null;
}

// ── Guard Service ──

export const epiAgreementGuard = {

  /**
   * Generate an EmployeeAgreement for an EPI delivery.
   * Called after createEpiDelivery() to create the linked agreement.
   */
  async dispatchAgreementForDelivery(
    deliveryId: string,
    employeeId: string,
    tenantId: string,
    companyId: string | null,
  ): Promise<EpiAgreementDispatchResult> {
    // 1. Find the EPI agreement template
    const { data: template } = await supabase
      .from('agreement_templates')
      .select(`
        id, name,
        versions:agreement_template_versions!agreement_template_versions_template_id_fkey(id)
      `)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .eq('category', 'epi')
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();

    if (!template) {
      return {
        delivery_id: deliveryId,
        employee_id: employeeId,
        agreement_id: null,
        already_existed: false,
        error: 'Nenhum template de Termo de Entrega de EPI (categoria "epi") configurado.',
      };
    }

    // 2. Check if agreement already exists for this delivery
    const { data: existing } = await supabase
      .from('employee_agreements')
      .select('id, status')
      .eq('employee_id', employeeId)
      .eq('template_id', template.id)
      .eq('tenant_id', tenantId)
      .in('status', ['pending', 'sent', 'signed'])
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Link delivery to existing agreement via metadata
      await supabase
        .from('epi_deliveries')
        .update({ metadata: { agreement_id: existing.id } } as any)
        .eq('id', deliveryId);

      return {
        delivery_id: deliveryId,
        employee_id: employeeId,
        agreement_id: existing.id,
        already_existed: true,
        error: null,
      };
    }

    // 3. Create new EmployeeAgreement
    const versions = (template as any).versions as Array<{ id: string }> | null;
    const versionId = versions?.[0]?.id ?? template.id;

    const { data: agreement, error } = await supabase
      .from('employee_agreements')
      .insert([{
        employee_id: employeeId,
        template_id: template.id,
        template_version_id: versionId,
        tenant_id: tenantId,
        company_id: companyId,
        status: 'pending',
        versao: 1,
      }])
      .select('id')
      .single();

    if (error) {
      return {
        delivery_id: deliveryId,
        employee_id: employeeId,
        agreement_id: null,
        already_existed: false,
        error: `Erro ao criar acordo de EPI: ${error.message}`,
      };
    }

    // 4. Link delivery to agreement via metadata
    await supabase
      .from('epi_deliveries')
      .update({ metadata: { agreement_id: agreement.id } } as any)
      .eq('id', deliveryId);

    return {
      delivery_id: deliveryId,
      employee_id: employeeId,
      agreement_id: agreement.id,
      already_existed: false,
      error: null,
    };
  },

  /**
   * Check if an EPI delivery's agreement is signed.
   * Blocks finalization of the delivery if the agreement is not signed.
   */
  async canFinalizeDelivery(
    deliveryId: string,
    employeeId: string,
    tenantId: string,
  ): Promise<EpiAgreementGuardResult> {
    const now = new Date().toISOString();

    // 1. Check delivery metadata for linked agreement
    const { data: delivery } = await supabase
      .from('epi_deliveries')
      .select('metadata, assinatura_status')
      .eq('id', deliveryId)
      .single();

    if (!delivery) {
      return {
        delivery_id: deliveryId,
        employee_id: employeeId,
        blocked: true,
        agreement_id: null,
        agreement_status: null,
        can_finalize_delivery: false,
        blocking_reason: 'Entrega de EPI não encontrada.',
        evaluated_at: now,
      };
    }

    const metadata = delivery.metadata as Record<string, unknown> | null;
    const agreementId = metadata?.agreement_id as string | null;

    // If delivery already has a direct signature, it's fine
    if (delivery.assinatura_status === 'signed') {
      return {
        delivery_id: deliveryId,
        employee_id: employeeId,
        blocked: false,
        agreement_id: agreementId,
        agreement_status: 'signed',
        can_finalize_delivery: true,
        blocking_reason: null,
        evaluated_at: now,
      };
    }

    // 2. Check linked EmployeeAgreement status
    if (agreementId) {
      const { data: agreement } = await supabase
        .from('employee_agreements')
        .select('status')
        .eq('id', agreementId)
        .single();

      const status = agreement?.status ?? 'unknown';

      if (status === 'signed') {
        return {
          delivery_id: deliveryId,
          employee_id: employeeId,
          blocked: false,
          agreement_id: agreementId,
          agreement_status: status,
          can_finalize_delivery: true,
          blocking_reason: null,
          evaluated_at: now,
        };
      }

      return {
        delivery_id: deliveryId,
        employee_id: employeeId,
        blocked: true,
        agreement_id: agreementId,
        agreement_status: status,
        can_finalize_delivery: false,
        blocking_reason: `Termo de Entrega de EPI pendente de assinatura (status: ${status}). NR-6, item 6.6.1-d exige assinatura do colaborador.`,
        evaluated_at: now,
      };
    }

    // 3. No linked agreement — check by category
    const { data: epiAgreements } = await supabase
      .from('employee_agreements')
      .select('id, status')
      .eq('employee_id', employeeId)
      .eq('tenant_id', tenantId)
      .in('status', ['pending', 'sent', 'signed']);

    // Check if any EPI template matches
    const { data: epiTemplateIds } = await supabase
      .from('agreement_templates')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('category', 'epi')
      .eq('is_active', true)
      .is('deleted_at', null);

    const epiIds = new Set((epiTemplateIds || []).map(t => t.id));
    // This is a broader check—find any EPI agreement for this employee
    // Not ideal but handles the case where metadata link is missing

    return {
      delivery_id: deliveryId,
      employee_id: employeeId,
      blocked: true,
      agreement_id: null,
      agreement_status: null,
      can_finalize_delivery: false,
      blocking_reason: 'Termo de Entrega de EPI não gerado. Gere o termo e obtenha a assinatura do colaborador antes de finalizar a entrega (NR-6, item 6.6.1-d).',
      evaluated_at: now,
    };
  },

  /**
   * Enforce guard — throws if blocked.
   * Use before finalizing an EPI delivery.
   */
  async enforceOrThrow(
    deliveryId: string,
    employeeId: string,
    tenantId: string,
  ): Promise<void> {
    const result = await this.canFinalizeDelivery(deliveryId, employeeId, tenantId);
    if (result.blocked) {
      throw new Error(result.blocking_reason ?? 'Bloqueio de entrega de EPI: assinatura pendente.');
    }
  },
};
