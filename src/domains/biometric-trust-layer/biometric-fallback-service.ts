/**
 * BiometricFallbackService — Handles clock-in when biometric is unavailable.
 *
 * Rules:
 *  1. Allow manual registration
 *  2. Require justification (mandatory, min 10 chars)
 *  3. Require manager approval (entry stays 'pending_approval' until approved)
 *  4. Full audit trail
 *
 * Triggers: consent revoked, enrollment expired, device camera failure,
 *           liveness repeatedly failed, biometric disabled by tenant.
 */

import { supabase } from '@/integrations/supabase/client';
import type { FallbackMethod } from './lgpd-compliance-manager';

// ── Types ──────────────────────────────────────────────────────

export type FallbackReason =
  | 'no_enrollment'
  | 'consent_revoked'
  | 'enrollment_expired'
  | 'camera_unavailable'
  | 'liveness_failed_repeatedly'
  | 'biometric_disabled'
  | 'device_incompatible'
  | 'other';

export type FallbackApprovalStatus = 'pending_approval' | 'approved' | 'rejected';

export interface FallbackClockRequest {
  tenant_id: string;
  employee_id: string;
  event_type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end';
  fallback_reason: FallbackReason;
  justification: string;
  fallback_method: FallbackMethod;
  latitude?: number;
  longitude?: number;
  device_fingerprint?: string;
  ip_address?: string;
}

export interface FallbackClockResult {
  id: string;
  status: FallbackApprovalStatus;
  fallback_method: FallbackMethod;
  requires_approval: boolean;
  message: string;
}

export interface FallbackApprovalAction {
  tenant_id: string;
  fallback_entry_id: string;
  manager_id: string;
  decision: 'approved' | 'rejected';
  manager_notes?: string;
}

// ── Service ────────────────────────────────────────────────────

export class BiometricFallbackService {

  /**
   * Register a manual clock entry when biometric is unavailable.
   *  - Validates justification
   *  - Persists with 'pending_approval' status
   *  - Notifies manager for approval
   */
  async registerManualEntry(request: FallbackClockRequest): Promise<FallbackClockResult> {
    // 1. Validate justification
    if (!request.justification || request.justification.trim().length < 10) {
      throw new Error(
        '[FallbackService] Justificativa obrigatória (mínimo 10 caracteres) para registro manual sem biometria',
      );
    }

    // 2. Validate fallback reason
    if (!request.fallback_reason) {
      throw new Error('[FallbackService] Motivo do fallback obrigatório');
    }

    // 3. Persist fallback entry with pending_approval status
    const { data, error } = await supabase
      .from('worktime_fallback_entries' as any)
      .insert({
        tenant_id: request.tenant_id,
        employee_id: request.employee_id,
        event_type: request.event_type,
        fallback_reason: request.fallback_reason,
        justification: request.justification.trim(),
        fallback_method: request.fallback_method,
        approval_status: 'pending_approval',
        latitude: request.latitude,
        longitude: request.longitude,
        device_fingerprint: request.device_fingerprint,
        ip_address: request.ip_address,
        requested_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) throw new Error(`[FallbackService] Falha ao registrar entrada manual: ${error.message}`);

    const entryId = (data as any).id;

    // 4. Notify manager for approval
    await this.notifyManagerForApproval(request.tenant_id, request.employee_id, entryId, request);

    // 5. Audit trail
    await supabase
      .from('biometric_audit_trail' as any)
      .insert({
        tenant_id: request.tenant_id,
        employee_id: request.employee_id,
        action: 'fallback_manual_entry',
        action_category: 'verification',
        entity_type: 'worktime_fallback_entry',
        entity_id: entryId,
        metadata: {
          fallback_reason: request.fallback_reason,
          fallback_method: request.fallback_method,
          justification: request.justification,
          event_type: request.event_type,
        },
        lgpd_justification: `Registro manual por indisponibilidade biométrica: ${request.fallback_reason}`,
      });

    return {
      id: entryId,
      status: 'pending_approval',
      fallback_method: request.fallback_method,
      requires_approval: true,
      message: 'Registro manual enviado para aprovação do gestor',
    };
  }

  /**
   * Manager approves or rejects a fallback entry.
   * If approved → creates actual WorkTime ledger entry.
   */
  async processApproval(action: FallbackApprovalAction): Promise<{ success: boolean; worktime_entry_id?: string }> {
    // 1. Update fallback entry status
    const { error: updateError } = await supabase
      .from('worktime_fallback_entries' as any)
      .update({
        approval_status: action.decision,
        approved_by: action.manager_id,
        approved_at: new Date().toISOString(),
        manager_notes: action.manager_notes,
      })
      .eq('id', action.fallback_entry_id)
      .eq('tenant_id', action.tenant_id);

    if (updateError) throw new Error(`[FallbackService] Falha ao processar aprovação: ${updateError.message}`);

    // 2. If approved, create actual time entry
    let worktimeEntryId: string | undefined;
    if (action.decision === 'approved') {
      // Fetch fallback entry details
      const { data: fallback } = await supabase
        .from('worktime_fallback_entries' as any)
        .select('*')
        .eq('id', action.fallback_entry_id)
        .single();

      if (fallback) {
        const fb = fallback as any;
        const { data: entry } = await supabase
          .from('worktime_entries' as any)
          .insert({
            tenant_id: action.tenant_id,
            employee_id: fb.employee_id,
            event_type: fb.event_type,
            source: 'manual',
            recorded_at: fb.requested_at,
            status: 'valid',
            latitude: fb.latitude,
            longitude: fb.longitude,
            device_fingerprint: fb.device_fingerprint,
            ip_address: fb.ip_address,
            is_offline_sync: false,
            integrity_hash: 'fallback_approved',
          })
          .select('id')
          .single();

        worktimeEntryId = (entry as any)?.id;
      }
    }

    // 3. Audit
    await supabase
      .from('biometric_audit_trail' as any)
      .insert({
        tenant_id: action.tenant_id,
        actor_id: action.manager_id,
        action: `fallback_${action.decision}`,
        action_category: 'verification',
        entity_type: 'worktime_fallback_entry',
        entity_id: action.fallback_entry_id,
        metadata: {
          decision: action.decision,
          manager_notes: action.manager_notes,
          worktime_entry_id: worktimeEntryId,
        },
        lgpd_justification: `Aprovação de registro manual pelo gestor: ${action.decision}`,
      });

    // 4. Notify employee of decision
    await this.notifyEmployee(action.tenant_id, action.fallback_entry_id, action.decision);

    return { success: true, worktime_entry_id: worktimeEntryId };
  }

  /**
   * Check if employee needs fallback (no active enrollment or consent).
   */
  async needsFallback(tenantId: string, employeeId: string): Promise<{
    needs_fallback: boolean;
    reason?: FallbackReason;
    available_methods: FallbackMethod[];
  }> {
    // Check active enrollment
    const { data: enrollment } = await supabase
      .from('biometric_enrollments' as any)
      .select('id, enrollment_status, expires_at')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .eq('enrollment_status', 'active')
      .maybeSingle();

    if (!enrollment) {
      return {
        needs_fallback: true,
        reason: 'no_enrollment',
        available_methods: ['pin', 'qrcode', 'manager_approval'],
      };
    }

    // Check expiration
    if ((enrollment as any).expires_at && new Date((enrollment as any).expires_at) < new Date()) {
      return {
        needs_fallback: true,
        reason: 'enrollment_expired',
        available_methods: ['pin', 'qrcode', 'manager_approval'],
      };
    }

    // Check consent
    const mandatoryTypes = ['facial_recognition', 'liveness_detection', 'template_storage'];
    for (const consentType of mandatoryTypes) {
      const { data: consent } = await supabase
        .from('biometric_consent_records' as any)
        .select('granted')
        .eq('tenant_id', tenantId)
        .eq('employee_id', employeeId)
        .eq('consent_type', consentType)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!consent || !(consent as any).granted) {
        return {
          needs_fallback: true,
          reason: 'consent_revoked',
          available_methods: ['pin', 'qrcode', 'manager_approval'],
        };
      }
    }

    return { needs_fallback: false, available_methods: [] };
  }

  /**
   * Get pending approvals for a manager.
   */
  async getPendingApprovals(tenantId: string): Promise<any[]> {
    const { data } = await supabase
      .from('worktime_fallback_entries' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('approval_status', 'pending_approval')
      .order('requested_at', { ascending: false });

    return (data as any[]) ?? [];
  }

  // ── Private helpers ─────────────────────────────────────────

  private async notifyManagerForApproval(
    tenantId: string,
    employeeId: string,
    fallbackEntryId: string,
    request: FallbackClockRequest,
  ): Promise<void> {
    try {
      await supabase
        .from('notifications' as any)
        .insert({
          tenant_id: tenantId,
          type: 'fallback_approval_required',
          title: '📋 Registro manual aguardando aprovação',
          message: [
            `Colaborador: ${employeeId}`,
            `Tipo: ${request.event_type}`,
            `Motivo: ${this.translateReason(request.fallback_reason)}`,
            `Justificativa: ${request.justification}`,
            `Método: ${request.fallback_method}`,
          ].join('\n'),
          priority: 'high',
          metadata: {
            employee_id: employeeId,
            fallback_entry_id: fallbackEntryId,
            fallback_reason: request.fallback_reason,
            action_required: 'approve_or_reject',
          },
        });
    } catch (err) {
      console.error('[FallbackService] Failed to notify manager:', err);
    }
  }

  private async notifyEmployee(
    tenantId: string,
    fallbackEntryId: string,
    decision: 'approved' | 'rejected',
  ): Promise<void> {
    try {
      // Fetch employee_id from fallback entry
      const { data } = await supabase
        .from('worktime_fallback_entries' as any)
        .select('employee_id')
        .eq('id', fallbackEntryId)
        .single();

      if (!data) return;

      await supabase
        .from('notifications' as any)
        .insert({
          tenant_id: tenantId,
          type: 'fallback_decision',
          title: decision === 'approved'
            ? '✅ Registro manual aprovado'
            : '❌ Registro manual rejeitado',
          message: decision === 'approved'
            ? 'Seu registro de ponto manual foi aprovado pelo gestor.'
            : 'Seu registro de ponto manual foi rejeitado. Contate seu gestor para mais informações.',
          priority: 'medium',
          metadata: {
            employee_id: (data as any).employee_id,
            fallback_entry_id: fallbackEntryId,
            decision,
          },
        });
    } catch (err) {
      console.error('[FallbackService] Failed to notify employee:', err);
    }
  }

  private translateReason(reason: FallbackReason): string {
    const map: Record<FallbackReason, string> = {
      no_enrollment: 'Sem cadastro biométrico',
      consent_revoked: 'Consentimento revogado',
      enrollment_expired: 'Cadastro biométrico expirado',
      camera_unavailable: 'Câmera indisponível',
      liveness_failed_repeatedly: 'Falhas repetidas na prova de vida',
      biometric_disabled: 'Biometria desativada pelo tenant',
      device_incompatible: 'Dispositivo incompatível',
      other: 'Outro motivo',
    };
    return map[reason] ?? reason;
  }
}
