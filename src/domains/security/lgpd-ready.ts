/**
 * LGPD Compliance - Infrastructure Stubs
 * 
 * Lei Geral de Proteção de Dados (Brazilian GDPR equivalent).
 * 
 * Key rights to support:
 * - Art. 18, I   → Confirmation of data processing
 * - Art. 18, II  → Access to personal data
 * - Art. 18, III → Correction of incomplete/inaccurate data
 * - Art. 18, IV  → Anonymization, blocking, or elimination
 * - Art. 18, V   → Data portability
 * - Art. 18, VI  → Deletion of data processed with consent
 * - Art. 18, IX  → Revocation of consent
 */

import { SECURITY_FEATURES } from './feature-flags';
import { supabase } from '@/integrations/supabase/client';

// ═══════════════════════════════════
// Types
// ═══════════════════════════════════

export type ConsentPurpose =
  | 'employment_management'     // Core HR data processing
  | 'compensation_processing'   // Salary and benefits
  | 'analytics'                 // Aggregated reporting
  | 'communication'             // Email/phone contact
  | 'data_sharing';             // Sharing with third parties

export type LegalBasisType =
  | 'consent'
  | 'legal_obligation'
  | 'contract_execution'
  | 'legitimate_interest'
  | 'public_interest'
  | 'vital_interest';

export interface ConsentRecord {
  id: string;
  user_id: string;
  tenant_id: string;
  purpose: ConsentPurpose;
  granted: boolean;
  granted_at: string | null;
  revoked_at: string | null;
  ip_address: string | null;
  expires_at: string | null;
}

export interface DataAccessLog {
  id: string;
  tenant_id: string;
  employee_id: string;
  accessed_by: string;
  access_type: 'view' | 'edit' | 'export' | 'print' | 'anonymize';
  data_scope: string;
  accessed_fields: string[];
  ip_address: string | null;
  user_agent: string | null;
  justification: string | null;
  created_at: string;
}

export interface AnonymizationRequest {
  id: string;
  tenant_id: string;
  requested_by: string;
  employee_id: string;
  entity_type: string;
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'rejected';
  reason: string | null;
  legal_basis: string;
  retention_end_date: string | null;
  processed_at: string | null;
  processed_by: string | null;
  created_at: string;
}

export interface LegalBasisRecord {
  id: string;
  tenant_id: string;
  data_category: string;
  legal_basis_type: LegalBasisType;
  lgpd_article: string;
  description: string;
  retention_period_months: number;
  is_active: boolean;
}

// ═══════════════════════════════════
// Default Legal Basis Map
// ═══════════════════════════════════

export const DEFAULT_LEGAL_BASIS: {
  data_category: string;
  legal_basis_type: LegalBasisType;
  lgpd_article: string;
  description: string;
  retention_period_months: number;
}[] = [
  {
    data_category: 'dados_pessoais',
    legal_basis_type: 'contract_execution',
    lgpd_article: 'Art. 7º, V',
    description: 'Execução do contrato de trabalho — nome, CPF, endereço, dados de nascimento.',
    retention_period_months: 60,
  },
  {
    data_category: 'dados_financeiros',
    legal_basis_type: 'legal_obligation',
    lgpd_article: 'Art. 7º, II',
    description: 'Obrigação legal — dados bancários, salário, FGTS, INSS para cumprimento de obrigações trabalhistas e previdenciárias.',
    retention_period_months: 240, // 20 years (FGTS)
  },
  {
    data_category: 'dados_saude',
    legal_basis_type: 'legal_obligation',
    lgpd_article: 'Art. 11, II, "b"',
    description: 'Dado sensível — exames médicos (ASO, PCMSO) exigidos por NR-7 e legislação trabalhista.',
    retention_period_months: 240,
  },
  {
    data_category: 'dados_dependentes',
    legal_basis_type: 'contract_execution',
    lgpd_article: 'Art. 7º, V',
    description: 'Dados de dependentes para benefícios (salário-família, IR, plano de saúde).',
    retention_period_months: 60,
  },
  {
    data_category: 'dados_disciplinares',
    legal_basis_type: 'legitimate_interest',
    lgpd_article: 'Art. 7º, IX',
    description: 'Interesse legítimo do empregador — registros de advertências, suspensões e ocorrências.',
    retention_period_months: 60,
  },
  {
    data_category: 'dados_esocial',
    legal_basis_type: 'legal_obligation',
    lgpd_article: 'Art. 7º, II',
    description: 'Obrigação legal — transmissão de eventos ao eSocial conforme legislação vigente.',
    retention_period_months: 60,
  },
  {
    data_category: 'dados_biometricos',
    legal_basis_type: 'consent',
    lgpd_article: 'Art. 11, I',
    description: 'Dado sensível — biometria para controle de ponto requer consentimento explícito.',
    retention_period_months: 12,
  },
];

// ═══════════════════════════════════
// Anonymization Utilities
// ═══════════════════════════════════

/** Anonymize a name: "João Silva" → "J*** S***" */
export function anonymizeName(name: string): string {
  return name
    .split(' ')
    .map(part => part.charAt(0) + '•'.repeat(Math.max(part.length - 1, 2)))
    .join(' ');
}

/** Anonymize CPF: "123.456.789-00" → "•••.•••.789-00" */
export function anonymizeCPF(cpf: string | null): string | null {
  if (!cpf) return null;
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return '•••.•••.•••-••';
  return `•••.•••.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/** Anonymize an email: "joao@example.com" → "j***@e***.com" */
export function anonymizeEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split('@');
  if (!domain) return '•••@•••.•••';
  const domainParts = domain.split('.');
  return `${local.charAt(0)}${'•'.repeat(3)}@${domainParts[0].charAt(0)}${'•'.repeat(3)}.${domainParts.slice(1).join('.')}`;
}

/** Anonymize a phone: "+5511999998888" → "+55•••••8888" */
export function anonymizePhone(phone: string | null): string | null {
  if (!phone) return null;
  if (phone.length <= 4) return '•'.repeat(phone.length);
  return phone.slice(0, 3) + '•'.repeat(phone.length - 7) + phone.slice(-4);
}

// ═══════════════════════════════════
// LGPD Service
// ═══════════════════════════════════

export const lgpdService = {
  isFeatureEnabled(): boolean {
    return SECURITY_FEATURES.LGPD.enabled;
  },

  /** Required consent purposes for employee data processing */
  getRequiredConsents(): ConsentPurpose[] {
    return ['employment_management', 'compensation_processing'];
  },

  /** Optional consent purposes */
  getOptionalConsents(): ConsentPurpose[] {
    return ['analytics', 'communication', 'data_sharing'];
  },

  /** Get human-readable label for a consent purpose */
  getConsentLabel(purpose: ConsentPurpose): string {
    const labels: Record<ConsentPurpose, string> = {
      employment_management: 'Gestão de dados de emprego',
      compensation_processing: 'Processamento de remuneração',
      analytics: 'Análises e relatórios agregados',
      communication: 'Comunicação por email/telefone',
      data_sharing: 'Compartilhamento com terceiros',
    };
    return labels[purpose];
  },

  /** Get human-readable description */
  getConsentDescription(purpose: ConsentPurpose): string {
    const descriptions: Record<ConsentPurpose, string> = {
      employment_management: 'Processamento de dados pessoais necessários para a gestão do contrato de trabalho, incluindo nome, CPF, endereço e dados funcionais.',
      compensation_processing: 'Processamento de dados financeiros para cálculo e pagamento de salários, benefícios e encargos.',
      analytics: 'Utilização de dados anonimizados para relatórios gerenciais e análises estatísticas.',
      communication: 'Utilização de email e telefone para comunicações relacionadas ao trabalho.',
      data_sharing: 'Compartilhamento de dados com prestadores de serviço (contabilidade, plano de saúde, etc.).',
    };
    return descriptions[purpose];
  },

  // ── Access Logging ──

  async logAccess(params: {
    tenantId: string;
    employeeId: string;
    accessType: DataAccessLog['access_type'];
    dataScope?: string;
    accessedFields?: string[];
    justification?: string;
  }): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await (supabase as any).from('employee_data_access_logs').insert({
      tenant_id: params.tenantId,
      employee_id: params.employeeId,
      accessed_by: user.id,
      access_type: params.accessType,
      data_scope: params.dataScope || 'full',
      accessed_fields: params.accessedFields || [],
      justification: params.justification || null,
      user_agent: navigator.userAgent,
    });
  },

  async getAccessLogs(tenantId: string, employeeId: string): Promise<DataAccessLog[]> {
    const { data } = await (supabase as any)
      .from('employee_data_access_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })
      .limit(50);
    return (data ?? []) as DataAccessLog[];
  },

  // ── Consent Management ──

  async grantConsent(userId: string, tenantId: string, purpose: ConsentPurpose): Promise<void> {
    await (supabase as any).from('lgpd_consent_records').upsert(
      {
        tenant_id: tenantId,
        user_id: userId,
        purpose,
        granted: true,
        granted_at: new Date().toISOString(),
        revoked_at: null,
      },
      { onConflict: 'tenant_id,user_id,purpose' },
    );
  },

  async revokeConsent(userId: string, tenantId: string, purpose: ConsentPurpose): Promise<void> {
    await (supabase as any).from('lgpd_consent_records').upsert(
      {
        tenant_id: tenantId,
        user_id: userId,
        purpose,
        granted: false,
        revoked_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,user_id,purpose' },
    );
  },

  async getConsents(tenantId: string, userId: string): Promise<ConsentRecord[]> {
    const { data } = await (supabase as any)
      .from('lgpd_consent_records')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId);
    return (data ?? []) as ConsentRecord[];
  },

  // ── Anonymization ──

  async requestAnonymization(params: {
    tenantId: string;
    employeeId: string;
    reason?: string;
    retentionEndDate?: string;
  }): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await (supabase as any)
      .from('lgpd_anonymization_requests')
      .insert({
        tenant_id: params.tenantId,
        requested_by: user.id,
        employee_id: params.employeeId,
        reason: params.reason || 'Solicitação do titular',
        legal_basis: 'LGPD Art. 18, IV',
        retention_end_date: params.retentionEndDate || null,
      })
      .select('id')
      .single();
    return data?.id ?? null;
  },

  async getAnonymizationRequests(tenantId: string, employeeId?: string): Promise<AnonymizationRequest[]> {
    let query = (supabase as any)
      .from('lgpd_anonymization_requests')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (employeeId) {
      query = query.eq('employee_id', employeeId);
    }

    const { data } = await query;
    return (data ?? []) as AnonymizationRequest[];
  },

  // ── Legal Basis ──

  async getLegalBasis(tenantId: string): Promise<LegalBasisRecord[]> {
    const { data } = await (supabase as any)
      .from('lgpd_legal_basis')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('data_category');
    return (data ?? []) as LegalBasisRecord[];
  },

  async seedDefaultLegalBasis(tenantId: string): Promise<void> {
    const existing = await this.getLegalBasis(tenantId);
    if (existing.length > 0) return;

    const records = DEFAULT_LEGAL_BASIS.map((item) => ({
      tenant_id: tenantId,
      ...item,
      is_active: true,
    }));

    await (supabase as any).from('lgpd_legal_basis').insert(records);
  },

  /** Check if an employee's data retention period has expired */
  isRetentionExpired(terminationDate: string | null, retentionMonths: number): boolean {
    if (!terminationDate) return false;
    const termDate = new Date(terminationDate);
    const expiryDate = new Date(termDate);
    expiryDate.setMonth(expiryDate.getMonth() + retentionMonths);
    return new Date() > expiryDate;
  },

  /** Get retention status for display */
  getRetentionInfo(terminationDate: string | null, retentionMonths: number = 60): {
    expired: boolean;
    expiryDate: string | null;
    remainingDays: number | null;
  } {
    if (!terminationDate) return { expired: false, expiryDate: null, remainingDays: null };
    
    const termDate = new Date(terminationDate);
    const expiryDate = new Date(termDate);
    expiryDate.setMonth(expiryDate.getMonth() + retentionMonths);
    
    const now = new Date();
    const remaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      expired: now > expiryDate,
      expiryDate: expiryDate.toISOString().slice(0, 10),
      remainingDays: remaining,
    };
  },
};
