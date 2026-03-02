/**
 * BiometricAuditLogger — Immutable audit trail for all biometric operations.
 *
 * LGPD Art. 37: Controllers must maintain records of processing activities.
 */

import type { AuditActionCategory } from './types';
import { supabase } from '@/integrations/supabase/client';

export class BiometricAuditLogger {
  /**
   * Log a biometric operation to the immutable audit trail.
   */
  async log(params: {
    tenant_id: string;
    employee_id?: string;
    actor_id?: string;
    action: string;
    action_category: AuditActionCategory;
    entity_type?: string;
    entity_id?: string;
    ip_address?: string;
    user_agent?: string;
    metadata?: Record<string, unknown>;
    lgpd_justification?: string;
  }): Promise<void> {
    const { error } = await supabase
      .from('biometric_audit_trail' as any)
      .insert({
        tenant_id: params.tenant_id,
        employee_id: params.employee_id,
        actor_id: params.actor_id,
        action: params.action,
        action_category: params.action_category,
        entity_type: params.entity_type ?? 'biometric_enrollment',
        entity_id: params.entity_id,
        ip_address: params.ip_address,
        user_agent: params.user_agent,
        metadata: params.metadata ?? {},
        lgpd_justification: params.lgpd_justification,
      });

    if (error) {
      console.error('[BiometricAuditLogger] Failed to log audit entry:', error.message);
    }
  }

  /** Convenience: enrollment audit */
  async logEnrollment(tenantId: string, employeeId: string, enrollmentId: string, actorId?: string): Promise<void> {
    return this.log({
      tenant_id: tenantId,
      employee_id: employeeId,
      actor_id: actorId,
      action: 'biometric_enrollment_created',
      action_category: 'enrollment',
      entity_id: enrollmentId,
      lgpd_justification: 'Cadastro biométrico com consentimento do titular para registro de ponto (Portaria 671/2021)',
    });
  }

  /** Convenience: verification audit with full biometric context */
  async logVerification(tenantId: string, employeeId: string, matchLogId: string, result: string, context?: {
    match_score?: number;
    liveness_score?: number;
    decision?: string;
    device_id?: string;
    risk_score?: number;
    risk_level?: string;
    ip_address?: string;
  }): Promise<void> {
    return this.log({
      tenant_id: tenantId,
      employee_id: employeeId,
      action: `biometric_verification_${result}`,
      action_category: 'verification',
      entity_id: matchLogId,
      ip_address: context?.ip_address,
      metadata: {
        match_result: result,
        match_score: context?.match_score,
        liveness_score: context?.liveness_score,
        decision: context?.decision,
        device_id: context?.device_id,
        risk_score: context?.risk_score,
        risk_level: context?.risk_level,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /** Convenience: revocation audit */
  async logRevocation(tenantId: string, employeeId: string, enrollmentId: string, reason: string, actorId: string): Promise<void> {
    return this.log({
      tenant_id: tenantId,
      employee_id: employeeId,
      actor_id: actorId,
      action: 'biometric_enrollment_revoked',
      action_category: 'revocation',
      entity_id: enrollmentId,
      metadata: { reason },
      lgpd_justification: `Revogação solicitada: ${reason}`,
    });
  }

  /** Convenience: consent audit */
  async logConsent(tenantId: string, employeeId: string, consentType: string, granted: boolean): Promise<void> {
    return this.log({
      tenant_id: tenantId,
      employee_id: employeeId,
      action: granted ? 'biometric_consent_granted' : 'biometric_consent_revoked',
      action_category: 'consent',
      metadata: { consent_type: consentType, granted },
      lgpd_justification: granted
        ? 'Consentimento concedido pelo titular (LGPD Art. 11)'
        : 'Consentimento revogado pelo titular (LGPD Art. 18)',
    });
  }
}
