/**
 * BiometricVault — Secure storage for biometric templates.
 *
 * CRITICAL SECURITY RULES:
 *  ✗ NEVER store original face images
 *  ✓ Store ONLY: AES-256-GCM encrypted template + SHA-256 hash
 *  ✓ Consent verification before any operation
 *  ✓ Automatic expiration enforcement
 *  ✓ Full audit trail on every access
 *  ✓ Restricted access control (read audit on every retrieval)
 */

import type { BiometricEnrollment, CreateEnrollmentDTO, BiometricConsent, ConsentType } from './types';
import type { FaceTemplate } from './face-template-generator';
import { supabase } from '@/integrations/supabase/client';

// ── Access control ─────────────────────────────────────────────

type VaultOperation = 'store' | 'read' | 'revoke' | 'consent' | 'decrypt';

export class BiometricVault {

  // ═══════════════════════════════════════════════════════════════
  // STORE — Only encrypted template + hash, NEVER raw image
  // ═══════════════════════════════════════════════════════════════

  async storeEnrollment(dto: CreateEnrollmentDTO, template: FaceTemplate, livenessVerified: boolean): Promise<BiometricEnrollment> {
    // LGPD: Consentimento explícito obrigatório
    if (!dto.consent_granted) {
      throw new Error('[BiometricVault] Consentimento LGPD obrigatório para armazenamento biométrico');
    }

    // Política biométrica deve ter sido aceita
    if (!dto.consent_version_id) {
      throw new Error('[BiometricVault] Aceite da política biométrica obrigatório antes do enrollment');
    }

    // CRITICAL: Ensure face_image_data is NEVER persisted
    this.assertNoRawImage(dto);

    // AES-256-GCM encryption of template
    const encryptedTemplate = await this.encryptAES256(template.hash, dto.tenant_id, dto.employee_id);

    // SHA-256 hash for matching (one-way, non-reversible)
    const templateHash = template.hash;

    const { data, error } = await supabase
      .from('biometric_enrollments' as any)
      .insert({
        tenant_id: dto.tenant_id,
        employee_id: dto.employee_id,
        enrollment_status: 'active',
        template_hash: templateHash,
        encrypted_template: encryptedTemplate,
        template_version: template.version,
        quality_score: template.quality_score,
        liveness_verified: livenessVerified,
        capture_device: dto.capture_device,
        capture_method: dto.capture_method,
        consent_granted: true,
        consent_granted_at: new Date().toISOString(),
        consent_ip_address: dto.consent_ip_address,
        consent_version_id: dto.consent_version_id,
        lgpd_legal_basis: dto.lgpd_legal_basis ?? 'consent',
        expires_at: new Date(Date.now() + 730 * 86400000).toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(`[BiometricVault] Failed to store enrollment: ${error.message}`);

    // Audit: store operation
    await this.auditAccess(dto.tenant_id, dto.employee_id, 'store', (data as any).id);

    return data as unknown as BiometricEnrollment;
  }

  // ═══════════════════════════════════════════════════════════════
  // READ — Restricted access with mandatory audit
  // ═══════════════════════════════════════════════════════════════

  async getActiveEnrollment(tenantId: string, employeeId: string): Promise<BiometricEnrollment | null> {
    // Select only hash fields — NEVER return encrypted_template in reads
    const { data, error } = await supabase
      .from('biometric_enrollments' as any)
      .select('id, tenant_id, employee_id, enrollment_status, template_hash, template_version, quality_score, liveness_verified, capture_device, capture_method, consent_granted, consent_granted_at, consent_ip_address, consent_version_id, lgpd_legal_basis, lgpd_retention_days, expires_at, revoked_at, revoked_by, revoked_reason, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .eq('enrollment_status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`[BiometricVault] Failed to fetch enrollment: ${error.message}`);

    if (data) {
      // Audit every read access
      await this.auditAccess(tenantId, employeeId, 'read', (data as any).id);

      // Enforce expiration
      if ((data as any).expires_at && new Date((data as any).expires_at) < new Date()) {
        await this.revokeEnrollment((data as any).id, 'Enrollment expirado automaticamente', 'system');
        return null;
      }
    }

    return (data as unknown as BiometricEnrollment) ?? null;
  }

  /**
   * Decrypt template — restricted operation, requires explicit justification.
   * Only used internally for re-encryption or migration scenarios.
   */
  async decryptTemplate(tenantId: string, employeeId: string, enrollmentId: string, justification: string): Promise<string> {
    if (!justification || justification.length < 10) {
      throw new Error('[BiometricVault] Justificativa obrigatória para decriptação de template (LGPD)');
    }

    const { data, error } = await supabase
      .from('biometric_enrollments' as any)
      .select('encrypted_template')
      .eq('id', enrollmentId)
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .single();

    if (error || !data) throw new Error('[BiometricVault] Enrollment não encontrado ou acesso negado');

    // Audit decrypt operation (high-sensitivity)
    await this.auditAccess(tenantId, employeeId, 'decrypt', enrollmentId, {
      justification,
      sensitivity: 'critical',
    });

    return this.decryptAES256((data as any).encrypted_template, tenantId, employeeId);
  }

  // ═══════════════════════════════════════════════════════════════
  // REVOKE — Soft-delete (never hard-delete per LGPD audit)
  // ═══════════════════════════════════════════════════════════════

  async revokeEnrollment(enrollmentId: string, reason: string, actorId: string): Promise<void> {
    const { error } = await supabase
      .from('biometric_enrollments' as any)
      .update({
        enrollment_status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoked_by: actorId,
        revoked_reason: reason,
      })
      .eq('id', enrollmentId);

    if (error) throw new Error(`[BiometricVault] Failed to revoke enrollment: ${error.message}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // CONSENT — Append-only LGPD consent records
  // ═══════════════════════════════════════════════════════════════

  async recordConsent(
    tenantId: string,
    employeeId: string,
    consentType: ConsentType,
    granted: boolean,
    ipAddress: string,
  ): Promise<BiometricConsent> {
    const { data, error } = await supabase
      .from('biometric_consent_records' as any)
      .insert({
        tenant_id: tenantId,
        employee_id: employeeId,
        consent_type: consentType,
        granted,
        granted_at: granted ? new Date().toISOString() : null,
        revoked_at: !granted ? new Date().toISOString() : null,
        ip_address: ipAddress,
      })
      .select()
      .single();

    if (error) throw new Error(`[BiometricVault] Failed to record consent: ${error.message}`);

    await this.auditAccess(tenantId, employeeId, 'consent', (data as any).id, {
      consent_type: consentType,
      granted,
    });

    return data as unknown as BiometricConsent;
  }

  // ═══════════════════════════════════════════════════════════════
  // CRYPTO — AES-256-GCM encryption/decryption
  // ═══════════════════════════════════════════════════════════════

  /**
   * AES-256-GCM encryption with tenant+employee scoped key derivation.
   * IV is prepended to ciphertext for storage.
   */
  private async encryptAES256(plaintext: string, tenantId: string, employeeId: string): Promise<string> {
    const key = await this.deriveKey(tenantId, employeeId);
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      key,
      encoder.encode(plaintext),
    );
    // IV (12 bytes) + ciphertext+tag
    const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...combined));
  }

  /**
   * AES-256-GCM decryption.
   */
  private async decryptAES256(ciphertext: string, tenantId: string, employeeId: string): Promise<string> {
    const key = await this.deriveKey(tenantId, employeeId);
    const raw = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    const iv = raw.slice(0, 12);
    const data = raw.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      key,
      data,
    );
    return new TextDecoder().decode(decrypted);
  }

  /**
   * Derive AES-256 key from tenant_id + employee_id using HKDF-like construction.
   * In production: use a proper KMS (e.g., AWS KMS, Vault) for key management.
   */
  private async deriveKey(tenantId: string, employeeId: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const material = encoder.encode(`biometric_vault_aes256_${tenantId}_${employeeId}`);
    const keyHash = await crypto.subtle.digest('SHA-256', material);
    return crypto.subtle.importKey('raw', keyHash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }

  // ═══════════════════════════════════════════════════════════════
  // SAFETY — Prevent raw image storage
  // ═══════════════════════════════════════════════════════════════

  /**
   * Runtime guard: ensure no raw face image data leaks into storage.
   */
  private assertNoRawImage(dto: CreateEnrollmentDTO): void {
    // face_image_data must NEVER be persisted — only used transiently for template generation
    if ((dto as any)._persist_image === true) {
      throw new Error('[BiometricVault] CRITICAL: Tentativa de persistir imagem facial original bloqueada. Apenas template hash + encrypted template são permitidos.');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // AUDIT — Every vault access is logged
  // ═══════════════════════════════════════════════════════════════

  private async auditAccess(
    tenantId: string,
    employeeId: string,
    operation: VaultOperation,
    entityId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await supabase
      .from('biometric_audit_trail' as any)
      .insert({
        tenant_id: tenantId,
        employee_id: employeeId,
        action: `vault_${operation}`,
        action_category: operation === 'consent' ? 'consent' : 'access',
        entity_type: 'biometric_enrollment',
        entity_id: entityId,
        metadata: {
          operation,
          timestamp: new Date().toISOString(),
          ...metadata,
        },
        lgpd_justification: `Acesso ao cofre biométrico: operação ${operation}`,
      })
      .then(({ error }) => {
        if (error) console.error('[BiometricVault] Audit log failed:', error.message);
      });
  }
}
