/**
 * BiometricLGPDManager — LGPD compliance for biometric data.
 *
 * Implements:
 *  ✓ Mandatory consent with specific purpose (LGPD Art. 11)
 *  ✓ Secure storage enforcement (never raw images)
 *  ✓ Defined retention periods with auto-expiration
 *  ✓ Consent revocation (LGPD Art. 18)
 *  ✓ Template deletion (right to erasure)
 *  ✓ Fallback to alternative clock method when biometric unavailable
 *  ✓ Full audit trail on every operation
 */

import { BiometricVault } from './biometric-vault';
import { BiometricAuditLogger } from './biometric-audit-logger';
import type { BiometricConsent, ConsentType, BiometricEnrollment } from './types';
import { supabase } from '@/integrations/supabase/client';

// ── Consent purposes (LGPD Art. 11 §1) ────────────────────────

export interface ConsentPurpose {
  type: ConsentType;
  purpose: string;
  legal_basis: string;
  retention_days: number;
  is_mandatory_for_biometric: boolean;
}

export const BIOMETRIC_CONSENT_PURPOSES: ConsentPurpose[] = [
  {
    type: 'facial_recognition',
    purpose: 'Verificação de identidade facial para registro de ponto eletrônico conforme Portaria 671/2021',
    legal_basis: 'Consentimento explícito do titular (LGPD Art. 11, II, "a")',
    retention_days: 730, // 2 years
    is_mandatory_for_biometric: true,
  },
  {
    type: 'liveness_detection',
    purpose: 'Detecção de prova de vida para prevenção de fraude no registro de ponto',
    legal_basis: 'Consentimento explícito do titular (LGPD Art. 11, II, "a")',
    retention_days: 730,
    is_mandatory_for_biometric: true,
  },
  {
    type: 'template_storage',
    purpose: 'Armazenamento seguro de template biométrico criptografado (AES-256) para comparação futura',
    legal_basis: 'Consentimento explícito do titular (LGPD Art. 11, II, "a")',
    retention_days: 730,
    is_mandatory_for_biometric: true,
  },
  {
    type: 'data_sharing',
    purpose: 'Compartilhamento de dados biométricos anonimizados para melhoria do sistema de verificação',
    legal_basis: 'Legítimo interesse do controlador (LGPD Art. 10)',
    retention_days: 365,
    is_mandatory_for_biometric: false,
  },
];

// ── Fallback methods ──────────────────────────────────────────

export type FallbackMethod = 'pin' | 'qrcode' | 'nfc' | 'manager_approval';

export interface FallbackResult {
  method: FallbackMethod;
  reason: string;
  available_methods: FallbackMethod[];
}

// ── Manager ───────────────────────────────────────────────────

export class BiometricLGPDManager {
  private readonly vault = new BiometricVault();
  private readonly audit = new BiometricAuditLogger();

  // ═══════════════════════════════════════════════════════════════
  // CONSENT COLLECTION — with specific purpose & retention
  // ═══════════════════════════════════════════════════════════════

  /**
   * Grant consent for a specific biometric purpose.
   * Records: purpose, legal basis, retention period, IP, timestamp.
   */
  async grantConsent(
    tenantId: string,
    employeeId: string,
    consentType: ConsentType,
    ipAddress: string,
    consentVersionId: string,
  ): Promise<BiometricConsent> {
    const purpose = BIOMETRIC_CONSENT_PURPOSES.find(p => p.type === consentType);
    if (!purpose) {
      throw new Error(`[LGPD] Tipo de consentimento inválido: ${consentType}`);
    }

    const { data, error } = await supabase
      .from('biometric_consent_records' as any)
      .insert({
        tenant_id: tenantId,
        employee_id: employeeId,
        consent_type: consentType,
        consent_version: consentVersionId,
        granted: true,
        granted_at: new Date().toISOString(),
        ip_address: ipAddress,
        legal_basis: purpose.legal_basis,
        purpose_description: purpose.purpose,
        retention_period_days: purpose.retention_days,
      })
      .select()
      .single();

    if (error) throw new Error(`[LGPD] Falha ao registrar consentimento: ${error.message}`);

    await this.audit.logConsent(tenantId, employeeId, consentType, true);

    return data as unknown as BiometricConsent;
  }

  /**
   * Grant all mandatory consents required for biometric enrollment.
   */
  async grantAllMandatoryConsents(
    tenantId: string,
    employeeId: string,
    ipAddress: string,
    consentVersionId: string,
  ): Promise<BiometricConsent[]> {
    const mandatory = BIOMETRIC_CONSENT_PURPOSES.filter(p => p.is_mandatory_for_biometric);
    const results: BiometricConsent[] = [];

    for (const purpose of mandatory) {
      const consent = await this.grantConsent(tenantId, employeeId, purpose.type, ipAddress, consentVersionId);
      results.push(consent);
    }

    return results;
  }

  // ═══════════════════════════════════════════════════════════════
  // CONSENT REVOCATION — LGPD Art. 18, VI
  // ═══════════════════════════════════════════════════════════════

  /**
   * Revoke consent and trigger cascading actions:
   *  1. Mark consent as revoked
   *  2. If mandatory consent → revoke enrollment + delete template
   *  3. Switch employee to fallback clock method
   *  4. Audit everything
   */
  async revokeConsent(
    tenantId: string,
    employeeId: string,
    consentType: ConsentType,
    ipAddress: string,
    reason?: string,
  ): Promise<{ fallback: FallbackResult | null }> {
    // 1. Record revocation
    await supabase
      .from('biometric_consent_records' as any)
      .insert({
        tenant_id: tenantId,
        employee_id: employeeId,
        consent_type: consentType,
        consent_version: 'revocation',
        granted: false,
        revoked_at: new Date().toISOString(),
        ip_address: ipAddress,
        legal_basis: 'Revogação pelo titular (LGPD Art. 18, VI)',
        purpose_description: `Revogação de consentimento: ${consentType}. Motivo: ${reason ?? 'Não informado'}`,
        retention_period_days: 0,
      });

    await this.audit.logConsent(tenantId, employeeId, consentType, false);

    // 2. Check if this is a mandatory consent
    const purpose = BIOMETRIC_CONSENT_PURPOSES.find(p => p.type === consentType);
    let fallback: FallbackResult | null = null;

    if (purpose?.is_mandatory_for_biometric) {
      // Mandatory consent revoked → must revoke enrollment & delete template
      await this.deleteTemplate(tenantId, employeeId, `Revogação de consentimento obrigatório: ${consentType}`);
      fallback = await this.activateFallback(tenantId, employeeId, 'consent_revoked');
    }

    return { fallback };
  }

  /**
   * Revoke ALL consents and fully disable biometric for employee.
   */
  async revokeAllConsents(
    tenantId: string,
    employeeId: string,
    ipAddress: string,
    reason: string,
  ): Promise<FallbackResult> {
    for (const purpose of BIOMETRIC_CONSENT_PURPOSES) {
      await this.revokeConsent(tenantId, employeeId, purpose.type, ipAddress, reason);
    }

    return this.activateFallback(tenantId, employeeId, 'all_consents_revoked');
  }

  // ═══════════════════════════════════════════════════════════════
  // TEMPLATE DELETION — Right to erasure (LGPD Art. 18, IV)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Delete biometric template:
   *  1. Revoke active enrollment (soft-delete for audit)
   *  2. Nullify encrypted_template (actual crypto erasure)
   *  3. Keep only: enrollment record shell + hash for audit reference
   *  4. Audit the deletion
   */
  async deleteTemplate(
    tenantId: string,
    employeeId: string,
    reason: string,
  ): Promise<void> {
    // Get active enrollment
    const enrollment = await this.vault.getActiveEnrollment(tenantId, employeeId);
    if (!enrollment) return; // No active enrollment, nothing to delete

    // 1. Revoke enrollment
    await this.vault.revokeEnrollment(enrollment.id, reason, 'lgpd_erasure');

    // 2. Crypto-erase: nullify the encrypted template
    await supabase
      .from('biometric_enrollments' as any)
      .update({
        encrypted_template: null,
        template_hash: 'ERASED_LGPD_ART18',
      })
      .eq('id', enrollment.id)
      .eq('tenant_id', tenantId);

    // 3. Audit the deletion
    await supabase
      .from('biometric_audit_trail' as any)
      .insert({
        tenant_id: tenantId,
        employee_id: employeeId,
        action: 'template_erased_lgpd',
        action_category: 'deletion',
        entity_type: 'biometric_enrollment',
        entity_id: enrollment.id,
        metadata: {
          reason,
          erased_at: new Date().toISOString(),
          legal_basis: 'LGPD Art. 18, IV — Direito à eliminação',
        },
        lgpd_justification: `Eliminação de template biométrico: ${reason}`,
      });
  }

  // ═══════════════════════════════════════════════════════════════
  // FALLBACK — Alternative clock method when biometric unavailable
  // ═══════════════════════════════════════════════════════════════

  /**
   * Activate fallback clock method for employee.
   * Called when: consent revoked, enrollment expired, or biometric disabled.
   */
  async activateFallback(
    tenantId: string,
    employeeId: string,
    reason: string,
  ): Promise<FallbackResult> {
    const availableMethods: FallbackMethod[] = ['pin', 'qrcode', 'manager_approval'];
    const defaultMethod: FallbackMethod = 'pin';

    // Persist fallback preference
    await supabase
      .from('biometric_audit_trail' as any)
      .insert({
        tenant_id: tenantId,
        employee_id: employeeId,
        action: 'fallback_activated',
        action_category: 'access',
        entity_type: 'clock_method',
        metadata: {
          reason,
          fallback_method: defaultMethod,
          available_methods: availableMethods,
          activated_at: new Date().toISOString(),
        },
        lgpd_justification: `Fallback ativado por: ${reason}`,
      });

    return {
      method: defaultMethod,
      reason,
      available_methods: availableMethods,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // CONSENT VERIFICATION — Check before any biometric operation
  // ═══════════════════════════════════════════════════════════════

  /**
   * Verify that all mandatory consents are active for an employee.
   * Returns missing consents if any are not granted.
   */
  async verifyMandatoryConsents(
    tenantId: string,
    employeeId: string,
  ): Promise<{ valid: boolean; missing: ConsentType[] }> {
    const mandatory = BIOMETRIC_CONSENT_PURPOSES.filter(p => p.is_mandatory_for_biometric);
    const missing: ConsentType[] = [];

    for (const purpose of mandatory) {
      const { data } = await supabase
        .from('biometric_consent_records' as any)
        .select('granted')
        .eq('tenant_id', tenantId)
        .eq('employee_id', employeeId)
        .eq('consent_type', purpose.type)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data || !(data as any).granted) {
        missing.push(purpose.type);
      }
    }

    return { valid: missing.length === 0, missing };
  }

  // ═══════════════════════════════════════════════════════════════
  // RETENTION — Auto-expire based on defined retention periods
  // ═══════════════════════════════════════════════════════════════

  /**
   * Check and enforce retention periods for a tenant.
   * Should be called periodically (e.g., daily CRON).
   */
  async enforceRetention(tenantId: string): Promise<{ expired_count: number }> {
    const { data: expired } = await supabase
      .from('biometric_enrollments' as any)
      .select('id, employee_id, expires_at')
      .eq('tenant_id', tenantId)
      .eq('enrollment_status', 'active')
      .lt('expires_at', new Date().toISOString());

    if (!expired || expired.length === 0) return { expired_count: 0 };

    for (const enrollment of expired as any[]) {
      await this.deleteTemplate(tenantId, enrollment.employee_id, 'Prazo de retenção expirado (LGPD Art. 16)');
      await this.activateFallback(tenantId, enrollment.employee_id, 'retention_expired');
    }

    return { expired_count: expired.length };
  }

  /**
   * Get all consent purposes with descriptions for UI display.
   */
  getConsentPurposes(): ConsentPurpose[] {
    return [...BIOMETRIC_CONSENT_PURPOSES];
  }
}
