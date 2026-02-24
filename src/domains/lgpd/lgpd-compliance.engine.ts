/**
 * LGPD Compliance Engine — Ex-Employee Data Governance
 *
 * Manages:
 *   1. Legal basis configuration (data_category → retention_period)
 *   2. Access logging for ex-employee data
 *   3. Anonymization requests
 *   4. Automatic anonymization after legal retention period
 */

import { supabase } from '@/integrations/supabase/client';
import { addMonths, isPast, parseISO, differenceInDays } from 'date-fns';

// ── Types ──

export interface LgpdLegalBasis {
  id: string;
  tenant_id: string;
  data_category: string;
  legal_basis_type: string;
  lgpd_article: string;
  description: string;
  retention_period_months: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LgpdAccessLog {
  id: string;
  tenant_id: string;
  employee_id: string;
  accessed_by: string;
  access_type: string;
  resource_type: string;
  resource_id: string | null;
  ip_address: string | null;
  purpose: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AnonymizationCandidate {
  archive_id: string;
  employee_id: string;
  data_desligamento: string;
  retention_months: number;
  retention_end_date: string;
}

export interface RetentionOverview {
  total_archived: number;
  anonymized: number;
  within_retention: number;
  past_retention: number;
  candidates: AnonymizationCandidate[];
}

// ── Legal Basis CRUD ──

export async function listLegalBasis(tenantId: string): Promise<LgpdLegalBasis[]> {
  const { data, error } = await supabase
    .from('lgpd_legal_basis')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('data_category');
  if (error) throw new Error(error.message);
  return (data || []) as unknown as LgpdLegalBasis[];
}

export async function upsertLegalBasis(
  tenantId: string,
  basis: Partial<LgpdLegalBasis> & { data_category: string; legal_basis_type: string; lgpd_article: string; description: string },
): Promise<LgpdLegalBasis> {
  const payload = {
    tenant_id: tenantId,
    data_category: basis.data_category,
    legal_basis_type: basis.legal_basis_type,
    lgpd_article: basis.lgpd_article,
    description: basis.description,
    retention_period_months: basis.retention_period_months ?? 60,
    is_active: basis.is_active ?? true,
  };

  if (basis.id) {
    const { data, error } = await supabase
      .from('lgpd_legal_basis')
      .update(payload)
      .eq('id', basis.id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as unknown as LgpdLegalBasis;
  }

  const { data, error } = await supabase
    .from('lgpd_legal_basis')
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as LgpdLegalBasis;
}

// ── Access Logging ──

export async function logExEmployeeAccess(params: {
  tenantId: string;
  employeeId: string;
  accessedBy: string;
  accessType?: string;
  resourceType?: string;
  resourceId?: string;
  purpose?: string;
}): Promise<void> {
  await supabase.from('lgpd_ex_employee_access_logs').insert({
    tenant_id: params.tenantId,
    employee_id: params.employeeId,
    accessed_by: params.accessedBy,
    access_type: params.accessType || 'view',
    resource_type: params.resourceType || 'archived_profile',
    resource_id: params.resourceId || null,
    purpose: params.purpose || null,
  } as any);
}

export async function listAccessLogs(
  tenantId: string,
  employeeId?: string,
  limit = 100,
): Promise<LgpdAccessLog[]> {
  let query = supabase
    .from('lgpd_ex_employee_access_logs')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (employeeId) {
    query = query.eq('employee_id', employeeId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []) as unknown as LgpdAccessLog[];
}

// ── Retention Overview ──

export async function getRetentionOverview(tenantId: string): Promise<RetentionOverview> {
  // Get max retention from legal basis config
  const legalBases = await listLegalBasis(tenantId);
  const maxRetentionMonths = legalBases.length > 0
    ? Math.max(...legalBases.filter(b => b.is_active).map(b => b.retention_period_months))
    : 60; // Default: 5 years (CLT minimum)

  // Get all archived profiles
  const { data: archives, error } = await supabase
    .from('archived_employee_profiles')
    .select('id, employee_id, data_desligamento, is_anonymized')
    .eq('tenant_id', tenantId);

  if (error) throw new Error(error.message);
  const all = archives || [];

  const anonymized = all.filter(a => a.is_anonymized);
  const notAnonymized = all.filter(a => !a.is_anonymized);

  const now = new Date();
  const pastRetention: AnonymizationCandidate[] = [];
  const withinRetention: typeof notAnonymized = [];

  for (const a of notAnonymized) {
    const retentionEnd = addMonths(parseISO(a.data_desligamento), maxRetentionMonths);
    if (isPast(retentionEnd)) {
      pastRetention.push({
        archive_id: a.id,
        employee_id: a.employee_id,
        data_desligamento: a.data_desligamento,
        retention_months: maxRetentionMonths,
        retention_end_date: retentionEnd.toISOString(),
      });
    } else {
      withinRetention.push(a);
    }
  }

  return {
    total_archived: all.length,
    anonymized: anonymized.length,
    within_retention: withinRetention.length,
    past_retention: pastRetention.length,
    candidates: pastRetention,
  };
}

// ── Anonymization ──

export async function anonymizeProfile(
  archiveId: string,
  tenantId: string,
  anonymizedBy: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('anonymize_archived_profile', {
    p_archive_id: archiveId,
    p_tenant_id: tenantId,
    p_anonymized_by: anonymizedBy,
  });

  if (error) throw new Error(error.message);
  return !!data;
}

export async function runAutoAnonymization(
  tenantId: string,
  systemUserId: string,
): Promise<{ anonymized: number; errors: string[] }> {
  const overview = await getRetentionOverview(tenantId);
  let anonymized = 0;
  const errors: string[] = [];

  for (const candidate of overview.candidates) {
    try {
      const ok = await anonymizeProfile(candidate.archive_id, tenantId, systemUserId);
      if (ok) anonymized++;
    } catch (err: any) {
      errors.push(`${candidate.employee_id}: ${err.message}`);
    }
  }

  return { anonymized, errors };
}

// ── Default Legal Bases (Brazilian CLT) ──

export const DEFAULT_LEGAL_BASES = [
  {
    data_category: 'dados_pessoais',
    legal_basis_type: 'obrigacao_legal',
    lgpd_article: 'Art. 7º, II',
    description: 'Dados pessoais do trabalhador para cumprimento de obrigações legais e regulatórias (CLT, eSocial, Previdência).',
    retention_period_months: 60,
  },
  {
    data_category: 'dados_contratuais',
    legal_basis_type: 'obrigacao_legal',
    lgpd_article: 'Art. 7º, II',
    description: 'Contratos de trabalho e aditivos para fins de fiscalização e direitos trabalhistas (prescrição: 5 anos).',
    retention_period_months: 60,
  },
  {
    data_category: 'dados_financeiros',
    legal_basis_type: 'obrigacao_legal',
    lgpd_article: 'Art. 7º, II',
    description: 'Registros de pagamento, FGTS, INSS e IR para obrigações fiscais e previdenciárias.',
    retention_period_months: 60,
  },
  {
    data_category: 'dados_sst',
    legal_basis_type: 'obrigacao_legal',
    lgpd_article: 'Art. 7º, II',
    description: 'Dados de saúde ocupacional (ASOs, PPP, CAT) conforme NRs e legislação previdenciária. Retenção mínima: 20 anos.',
    retention_period_months: 240,
  },
  {
    data_category: 'dados_disciplinares',
    legal_basis_type: 'exercicio_regular_direitos',
    lgpd_article: 'Art. 7º, VI',
    description: 'Histórico disciplinar para exercício regular de direitos em processo judicial ou administrativo.',
    retention_period_months: 60,
  },
  {
    data_category: 'documentos_assinados',
    legal_basis_type: 'obrigacao_legal',
    lgpd_article: 'Art. 7º, II',
    description: 'Termos, acordos e declarações assinados digitalmente com validade jurídica.',
    retention_period_months: 120,
  },
];
