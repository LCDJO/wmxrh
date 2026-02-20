/**
 * EPI Validity & Replacement Engine
 *
 * Automated routine that checks EPI validity and generates events:
 *   - EPIExpired: EPI past its data_validade
 *   - EPIReplacementRequired: Generates new EpiRequirement for replacement
 *   - CA expired: Blocks new deliveries (enforced by DB trigger fn_validate_epi_ca_on_delivery)
 *
 * Integrates with:
 *   - epi_deliveries (validity tracking)
 *   - epi_catalog (CA validity)
 *   - epi_requirements (auto-generation of replacement needs)
 *   - epi_audit_log (event recording)
 */

import { supabase } from '@/integrations/supabase/client';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface ValidityCheckResult {
  expired_deliveries: ExpiredDeliveryInfo[];
  expired_cas: ExpiredCAInfo[];
  near_expiry_deliveries: NearExpiryInfo[];
  requirements_created: number;
  deliveries_marked_expired: number;
}

export interface ExpiredDeliveryInfo {
  delivery_id: string;
  employee_id: string;
  employee_name: string;
  epi_catalog_id: string;
  epi_nome: string;
  ca_numero: string | null;
  data_validade: string;
  dias_vencido: number;
  requirement_created: boolean;
}

export interface ExpiredCAInfo {
  epi_catalog_id: string;
  epi_nome: string;
  ca_numero: string;
  ca_validade: string;
  dias_vencido: number;
  active_deliveries_count: number;
}

export interface NearExpiryInfo {
  delivery_id: string;
  employee_id: string;
  employee_name: string;
  epi_nome: string;
  data_validade: string;
  dias_restantes: number;
}

// ═══════════════════════════════════════════════════════
// MAIN ROUTINE
// ═══════════════════════════════════════════════════════

/**
 * checkEPIValidity — Main automated routine
 *
 * Rules:
 *   1. If EPI delivery expired → mark as 'vencido', generate EPIExpired event,
 *      create new EpiRequirement for replacement (EPIReplacementRequired)
 *   2. If CA expired → flag as critical alert (deliveries already blocked by DB trigger)
 *   3. If EPI near expiry (≤30 days) → include in warnings
 */
export async function checkEPIValidity(
  tenantId: string,
  options?: { nearExpiryDays?: number },
): Promise<ValidityCheckResult> {
  const nearExpiryDays = options?.nearExpiryDays ?? 30;
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  const result: ValidityCheckResult = {
    expired_deliveries: [],
    expired_cas: [],
    near_expiry_deliveries: [],
    requirements_created: 0,
    deliveries_marked_expired: 0,
  };

  // ── 1. Scan expired EPI deliveries (still marked as 'entregue') ──
  const { data: expiredDeliveries } = await supabase
    .from('epi_deliveries' as any)
    .select(`
      id, employee_id, epi_catalog_id, data_validade, ca_numero,
      employees:employee_id(name),
      epi_catalog:epi_catalog_id(nome, ca_numero, validade_meses)
    `)
    .eq('tenant_id', tenantId)
    .eq('status', 'entregue')
    .not('data_validade', 'is', null)
    .lt('data_validade', today);

  for (const d of (expiredDeliveries ?? []) as any[]) {
    const diasVencido = Math.floor(
      (now.getTime() - new Date(d.data_validade).getTime()) / 86400000,
    );

    // Mark delivery as expired
    await supabase
      .from('epi_deliveries' as any)
      .update({ status: 'vencido' } as any)
      .eq('id', d.id);

    result.deliveries_marked_expired++;

    // Record EPIExpired audit event
    await supabase.from('epi_audit_log' as any).insert({
      tenant_id: tenantId,
      delivery_id: d.id,
      employee_id: d.employee_id,
      action: 'vencimento_detectado',
      executor_user_id: null,
      details: `EPI "${d.epi_catalog?.nome}" vencido há ${diasVencido} dia(s). Validade: ${d.data_validade}.`,
      metadata: {
        event: 'EPIExpired',
        dias_vencido: diasVencido,
        epi_catalog_id: d.epi_catalog_id,
        ca_numero: d.ca_numero,
      },
    });

    // Generate replacement requirement (EPIReplacementRequired)
    let requirementCreated = false;
    const { error: reqError } = await supabase
      .from('epi_requirements' as any)
      .insert({
        tenant_id: tenantId,
        employee_id: d.employee_id,
        epi_catalog_id: d.epi_catalog_id,
        risk_exposure_id: null,
        motivo: `Substituição obrigatória — EPI "${d.epi_catalog?.nome}" vencido em ${d.data_validade}`,
        obrigatorio: true,
      });

    if (!reqError) {
      requirementCreated = true;
      result.requirements_created++;

      // Record EPIReplacementRequired audit event
      await supabase.from('epi_audit_log' as any).insert({
        tenant_id: tenantId,
        delivery_id: d.id,
        employee_id: d.employee_id,
        action: 'substituicao',
        executor_user_id: null,
        details: `Requisição de substituição gerada automaticamente para "${d.epi_catalog?.nome}".`,
        metadata: {
          event: 'EPIReplacementRequired',
          old_delivery_id: d.id,
          epi_catalog_id: d.epi_catalog_id,
        },
      });
    }

    result.expired_deliveries.push({
      delivery_id: d.id,
      employee_id: d.employee_id,
      employee_name: d.employees?.name ?? '—',
      epi_catalog_id: d.epi_catalog_id,
      epi_nome: d.epi_catalog?.nome ?? '—',
      ca_numero: d.ca_numero,
      data_validade: d.data_validade,
      dias_vencido: diasVencido,
      requirement_created: requirementCreated,
    });
  }

  // ── 2. Scan expired CAs in catalog (critical alert) ──
  const { data: expiredCAs } = await supabase
    .from('epi_catalog' as any)
    .select('id, nome, ca_numero, ca_validade')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .not('ca_validade', 'is', null)
    .lt('ca_validade', today);

  for (const ca of (expiredCAs ?? []) as any[]) {
    const diasVencido = Math.floor(
      (now.getTime() - new Date(ca.ca_validade).getTime()) / 86400000,
    );

    // Count active deliveries still using this EPI
    const { count } = await supabase
      .from('epi_deliveries' as any)
      .select('id', { count: 'exact', head: true })
      .eq('epi_catalog_id', ca.id)
      .eq('status', 'entregue');

    result.expired_cas.push({
      epi_catalog_id: ca.id,
      epi_nome: ca.nome,
      ca_numero: ca.ca_numero,
      ca_validade: ca.ca_validade,
      dias_vencido: diasVencido,
      active_deliveries_count: count ?? 0,
    });
  }

  // ── 3. Near-expiry warnings ──
  const futureDate = new Date(now);
  futureDate.setDate(futureDate.getDate() + nearExpiryDays);
  const futureDateStr = futureDate.toISOString().split('T')[0];

  const { data: nearExpiry } = await supabase
    .from('epi_deliveries' as any)
    .select(`
      id, employee_id, data_validade,
      employees:employee_id(name),
      epi_catalog:epi_catalog_id(nome)
    `)
    .eq('tenant_id', tenantId)
    .eq('status', 'entregue')
    .gte('data_validade', today)
    .lte('data_validade', futureDateStr);

  for (const d of (nearExpiry ?? []) as any[]) {
    const diasRestantes = Math.floor(
      (new Date(d.data_validade).getTime() - now.getTime()) / 86400000,
    );

    result.near_expiry_deliveries.push({
      delivery_id: d.id,
      employee_id: d.employee_id,
      employee_name: d.employees?.name ?? '—',
      epi_nome: d.epi_catalog?.nome ?? '—',
      data_validade: d.data_validade,
      dias_restantes: diasRestantes,
    });
  }

  return result;
}

// ═══════════════════════════════════════════════════════
// INDIVIDUAL CHECKS
// ═══════════════════════════════════════════════════════

/** Check if a specific EPI catalog item has a valid CA */
export async function isCAValid(epiCatalogId: string): Promise<{
  valid: boolean;
  ca_numero: string | null;
  ca_validade: string | null;
  dias_restantes: number | null;
}> {
  const { data } = await supabase
    .from('epi_catalog' as any)
    .select('ca_numero, ca_validade')
    .eq('id', epiCatalogId)
    .single();

  if (!data) return { valid: false, ca_numero: null, ca_validade: null, dias_restantes: null };

  const d = data as any;
  if (!d.ca_validade) return { valid: true, ca_numero: d.ca_numero, ca_validade: null, dias_restantes: null };

  const now = new Date();
  const validade = new Date(d.ca_validade);
  const diasRestantes = Math.floor((validade.getTime() - now.getTime()) / 86400000);

  return {
    valid: diasRestantes >= 0,
    ca_numero: d.ca_numero,
    ca_validade: d.ca_validade,
    dias_restantes: diasRestantes,
  };
}

/** Get count of EPIs expiring within N days for a tenant */
export async function getExpiryDashboardStats(
  tenantId: string,
): Promise<{
  total_active: number;
  expired: number;
  expiring_30d: number;
  expiring_7d: number;
  expired_cas: number;
}> {
  const today = new Date().toISOString().split('T')[0];
  const in7d = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const in30d = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  const [active, expired, exp7, exp30, cas] = await Promise.all([
    supabase.from('epi_deliveries' as any).select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'entregue'),
    supabase.from('epi_deliveries' as any).select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'entregue').lt('data_validade', today).not('data_validade', 'is', null),
    supabase.from('epi_deliveries' as any).select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'entregue').gte('data_validade', today).lte('data_validade', in7d),
    supabase.from('epi_deliveries' as any).select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'entregue').gte('data_validade', today).lte('data_validade', in30d),
    supabase.from('epi_catalog' as any).select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('is_active', true).lt('ca_validade', today).not('ca_validade', 'is', null),
  ]);

  return {
    total_active: active.count ?? 0,
    expired: expired.count ?? 0,
    expiring_30d: exp30.count ?? 0,
    expiring_7d: exp7.count ?? 0,
    expired_cas: cas.count ?? 0,
  };
}
