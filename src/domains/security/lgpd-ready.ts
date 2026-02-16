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
 * 
 * To activate:
 * 1. Create consent_records table in DB
 * 2. Set SECURITY_FEATURES.LGPD.enabled = true
 * 3. Wire up consent UI in onboarding/settings
 */

import { SECURITY_FEATURES } from './feature-flags';

// ═══════════════════════════════════
// Types
// ═══════════════════════════════════

export type ConsentPurpose =
  | 'employment_management'     // Core HR data processing
  | 'compensation_processing'   // Salary and benefits
  | 'analytics'                 // Aggregated reporting
  | 'communication'             // Email/phone contact
  | 'data_sharing';             // Sharing with third parties

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

export interface DataExportRequest {
  id: string;
  user_id: string;
  tenant_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requested_at: string;
  completed_at: string | null;
  download_url: string | null;
  expires_at: string | null;
}

export interface AnonymizationRequest {
  id: string;
  user_id: string;
  tenant_id: string;
  entity_type: string;
  entity_id: string;
  status: 'pending' | 'completed';
  requested_at: string;
  completed_at: string | null;
}

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
// LGPD Service (stubs)
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

  // Future: these will be implemented when the consent_records table is created

  /** Record consent grant (stub) */
  async grantConsent(_userId: string, _tenantId: string, _purpose: ConsentPurpose): Promise<void> {
    if (!SECURITY_FEATURES.LGPD.enabled) return;
    console.warn('[LGPD] grantConsent stub called — implement when DB table is ready');
  },

  /** Record consent revocation (stub) */
  async revokeConsent(_userId: string, _tenantId: string, _purpose: ConsentPurpose): Promise<void> {
    if (!SECURITY_FEATURES.LGPD.enabled) return;
    console.warn('[LGPD] revokeConsent stub called — implement when DB table is ready');
  },

  /** Request data export (portability) (stub) */
  async requestDataExport(_userId: string, _tenantId: string): Promise<void> {
    if (!SECURITY_FEATURES.LGPD.enabled) return;
    console.warn('[LGPD] requestDataExport stub called — implement when edge function is ready');
  },

  /** Request data anonymization (right to be forgotten) (stub) */
  async requestAnonymization(_userId: string, _tenantId: string): Promise<void> {
    if (!SECURITY_FEATURES.LGPD.enabled) return;
    console.warn('[LGPD] requestAnonymization stub called — implement when edge function is ready');
  },
};
