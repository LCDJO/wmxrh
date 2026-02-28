/**
 * AccountEnforcementEngine
 *
 * Manages structured account bans, suspensions, restrictions, and appeals.
 * Unified Account Status Model applies to: Tenant, User, DeveloperApp.
 * Integrates with: FraudDetection, IncidentManagement, BillingCore, ControlPlane, AuditLogger.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  AccountEnforcementEngineAPI,
  AccountEnforcement,
  BanRegistryEntry,
  EnforcementAppeal,
  EnforceAccountPayload,
  AppealPayload,
  ReviewAppealPayload,
  AccountEntityType,
  AccountStatusInfo,
  AccountStatus,
} from './types';
import { GOVERNANCE_KERNEL_EVENTS } from '@/domains/platform-policy-governance/governance-events';
import { createGlobalEventKernel } from '@/domains/platform-os/global-event-kernel';

const kernel = createGlobalEventKernel();

export class AccountEnforcementEngine implements AccountEnforcementEngineAPI {

  async isTenantRestricted(tenantId: string): Promise<{ restricted: boolean; enforcements: AccountEnforcement[] }> {
    const info = await this.isEntityRestricted('tenant', tenantId);
    return { restricted: info.account_status !== 'active', enforcements: info.active_enforcements };
  }

  async isEntityRestricted(entityType: AccountEntityType, entityId: string): Promise<AccountStatusInfo> {
    const { data, error } = await supabase
      .from('account_enforcements')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('status', 'active');

    if (error) throw error;

    const now = new Date().toISOString();
    const active = ((data ?? []) as unknown as AccountEnforcement[]).filter(
      (e) => !e.expires_at || e.expires_at > now,
    );

    let accountStatus: AccountStatus = 'active';
    if (active.some((e) => e.action_type === 'ban')) accountStatus = 'banned';
    else if (active.some((e) => e.action_type === 'suspend')) accountStatus = 'suspended';
    else if (active.some((e) => e.action_type === 'restrict')) accountStatus = 'restricted';
    else if (active.length > 0) accountStatus = 'under_review';

    return {
      entity_type: entityType,
      entity_id: entityId,
      account_status: accountStatus,
      active_enforcements: active,
    };
  }

  async enforce(payload: EnforceAccountPayload): Promise<AccountEnforcement> {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    const entityType = payload.entity_type ?? 'tenant';
    const entityId = payload.entity_id ?? payload.tenant_id;

    const { data: enforcement, error } = await supabase
      .from('account_enforcements')
      .insert({
        tenant_id: payload.tenant_id,
        entity_type: entityType,
        entity_id: entityId,
        action_type: payload.action_type,
        reason: payload.reason,
        reason_category: payload.reason_category ?? 'policy_violation',
        severity: payload.severity ?? 'medium',
        status: 'active',
        enforced_by: userId,
        expires_at: payload.expires_at ?? null,
        related_incident_id: payload.related_incident_id ?? null,
        related_fraud_log_id: payload.related_fraud_log_id ?? null,
        notes: payload.notes ?? null,
        metadata: {},
      } as any)
      .select()
      .single();

    if (error) throw error;

    const record = enforcement as unknown as AccountEnforcement;

    // Ban registry entry
    if (payload.action_type === 'ban') {
      await supabase.from('ban_registry').insert({
        tenant_id: payload.tenant_id,
        enforcement_id: record.id,
        entity_type: entityType,
        entity_id: entityId,
        ban_type: payload.ban_type ?? 'full',
        scope_detail: payload.scope_detail ?? null,
        reason_category: payload.reason_category ?? 'abuse',
        reason_description: payload.reason,
        severity_level: payload.severity ?? 'medium',
        is_permanent: payload.is_permanent ?? false,
        banned_by: userId,
        review_required: payload.severity === 'critical',
        appeal_allowed: payload.is_permanent !== true,
      } as any);
    }

    // Audit log with structured fields
    await supabase.from('enforcement_audit_log').insert({
      enforcement_id: record.id,
      event_type: `account_${payload.action_type}`,
      action: payload.action_type,
      entity_id: entityId,
      previous_status: 'active',
      new_status: payload.action_type === 'ban' ? 'banned' : payload.action_type === 'suspend' ? 'suspended' : payload.action_type === 'restrict' ? 'restricted' : 'warned',
      reason: payload.reason,
      executor: userId,
      actor_id: userId,
      tenant_id: payload.tenant_id,
      details: { severity: payload.severity, entity_type: entityType, entity_id: entityId },
    } as any);

    // ── Cascading effects based on action_type ──
    if (payload.action_type === 'ban') {
      // 1) Suspend billing
      await supabase
        .from('tenant_plans')
        .update({ status: 'suspended', updated_at: new Date().toISOString() } as any)
        .eq('tenant_id', payload.tenant_id)
        .in('status', ['active', 'trial']);

      // 2) Revoke API clients
      await supabase
        .from('api_clients')
        .update({ status: 'revoked', account_status: 'banned', updated_at: new Date().toISOString() } as any)
        .eq('tenant_id', payload.tenant_id)
        .eq('status', 'active');

      // 3) Suspend automation workflows
      await supabase
        .from('automation_rules')
        .update({ is_active: false, updated_at: new Date().toISOString() } as any)
        .eq('tenant_id', payload.tenant_id)
        .eq('is_active', true);
    } else if (payload.action_type === 'restrict') {
      // Set restricted status (new integrations blocked at app layer)
      if (entityType === 'tenant') {
        await supabase
          .from('tenants')
          .update({ account_status: 'restricted' } as any)
          .eq('id', payload.tenant_id);
      }
    } else if (payload.action_type === 'suspend') {
      await supabase
        .from('tenant_plans')
        .update({ status: 'suspended', updated_at: new Date().toISOString() } as any)
        .eq('tenant_id', payload.tenant_id)
        .in('status', ['active', 'trial']);
    }

    // ── Emit governance kernel events ──
    if (payload.action_type === 'ban') {
      kernel.emit(GOVERNANCE_KERNEL_EVENTS.AccountBanned, 'AccountEnforcementEngine', {
        tenant_id: payload.tenant_id,
        entity_id: entityId,
        entity_type: entityType,
        ban_type: payload.ban_type ?? 'full',
        reason_category: payload.reason_category ?? 'abuse',
        severity_level: payload.severity ?? 'medium',
        is_permanent: payload.is_permanent ?? false,
        banned_by: userId ?? null,
      }, { priority: 'critical' });
    } else if (payload.action_type === 'suspend') {
      kernel.emit(GOVERNANCE_KERNEL_EVENTS.AccountSuspended, 'AccountEnforcementEngine', {
        tenant_id: payload.tenant_id,
        entity_id: entityId,
        entity_type: entityType,
        action_type: 'suspend',
        reason: payload.reason,
        severity: payload.severity ?? 'medium',
        expires_at: payload.expires_at ?? null,
      }, { priority: 'high' });
    }

    return record;
  }

  async revoke(enforcementId: string, reason: string): Promise<void> {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    const { data: existing } = await supabase
      .from('account_enforcements')
      .select('*')
      .eq('id', enforcementId)
      .single();

    if (!existing) throw new Error('Enforcement not found');

    await supabase
      .from('account_enforcements')
      .update({ status: 'revoked', updated_at: new Date().toISOString() } as any)
      .eq('id', enforcementId);

    await supabase
      .from('ban_registry')
      .update({ unbanned_at: new Date().toISOString(), unbanned_by: userId, unban_reason: reason } as any)
      .eq('enforcement_id', enforcementId)
      .is('unbanned_at', null);

    await supabase.from('enforcement_audit_log').insert({
      enforcement_id: enforcementId,
      event_type: 'enforcement_revoked',
      action: 'revoke',
      entity_id: (existing as any).entity_id,
      previous_status: (existing as any).status,
      new_status: 'revoked',
      reason,
      executor: userId,
      actor_id: userId,
      tenant_id: (existing as any).tenant_id,
      details: { reason },
    } as any);
  }

  async appeal(payload: AppealPayload): Promise<EnforcementAppeal> {
    const { data: userData } = await supabase.auth.getUser();

    // Fetch enforcement + validate appeal is allowed
    const { data: enforcement } = await supabase
      .from('account_enforcements')
      .select('tenant_id, status')
      .eq('id', payload.enforcement_id)
      .single();

    if (!enforcement) throw new Error('Enforcement not found');
    if ((enforcement as any).status === 'revoked') throw new Error('Enforcement already revoked — appeal not needed');

    // Check ban_registry to see if appeal_allowed
    const { data: banEntry } = await supabase
      .from('ban_registry')
      .select('appeal_allowed')
      .eq('enforcement_id', payload.enforcement_id)
      .maybeSingle();

    if (banEntry && (banEntry as any).appeal_allowed === false) {
      throw new Error('Recurso não permitido para este enforcement. Contate o suporte.');
    }

    // Prevent duplicate pending appeals
    const { data: existing } = await supabase
      .from('enforcement_appeals')
      .select('id')
      .eq('enforcement_id', payload.enforcement_id)
      .in('status', ['pending', 'under_review'])
      .maybeSingle();

    if (existing) throw new Error('Já existe um recurso em andamento para este enforcement.');

    const { data, error } = await supabase
      .from('enforcement_appeals')
      .insert({
        enforcement_id: payload.enforcement_id,
        tenant_id: (enforcement as any).tenant_id,
        appealed_by: userData?.user?.id,
        appeal_reason: payload.appeal_reason,
        supporting_evidence: payload.supporting_evidence ?? [],
        status: 'pending',
      } as any)
      .select()
      .single();

    if (error) throw error;

    // Mark enforcement as appealed
    await supabase
      .from('account_enforcements')
      .update({ status: 'appealed' } as any)
      .eq('id', payload.enforcement_id);

    // Audit
    await supabase.from('enforcement_audit_log').insert({
      enforcement_id: payload.enforcement_id,
      event_type: 'appeal_submitted',
      action: 'appeal',
      entity_id: (enforcement as any).tenant_id,
      previous_status: (enforcement as any).status,
      new_status: 'appealed',
      reason: payload.appeal_reason,
      executor: userData?.user?.id,
      actor_id: userData?.user?.id,
      tenant_id: (enforcement as any).tenant_id,
      details: { appeal_reason: payload.appeal_reason },
    } as any);

    kernel.emit(GOVERNANCE_KERNEL_EVENTS.AppealSubmitted, 'AccountEnforcementEngine', {
      tenant_id: (enforcement as any).tenant_id,
      enforcement_id: payload.enforcement_id,
      entity_id: (enforcement as any).tenant_id,
      entity_type: 'tenant',
      reason: payload.appeal_reason,
      submitted_by: userData?.user?.id ?? 'unknown',
    });

    return data as unknown as EnforcementAppeal;
  }

  async reviewAppeal(payload: ReviewAppealPayload): Promise<void> {
    const { data: userData } = await supabase.auth.getUser();
    const reviewerId = userData?.user?.id;

    // Update appeal with decision
    await supabase
      .from('enforcement_appeals')
      .update({
        status: payload.status,
        reviewer_id: reviewerId,
        reviewer_notes: payload.reviewer_notes ?? null,
        decision_summary: payload.decision_summary ?? null,
        reviewed_at: new Date().toISOString(),
        escalated_to: payload.status === 'escalated' ? (payload.escalated_to ?? null) : null,
        escalation_reason: payload.status === 'escalated' ? (payload.escalation_reason ?? null) : null,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', payload.appeal_id);

    // Fetch appeal to get enforcement_id and tenant_id
    const { data: appeal } = await supabase
      .from('enforcement_appeals')
      .select('enforcement_id, tenant_id')
      .eq('id', payload.appeal_id)
      .single();

    if (!appeal) return;

    const enforcementId = (appeal as any).enforcement_id;
    const tenantId = (appeal as any).tenant_id;

    // Audit the decision
    await supabase.from('enforcement_audit_log').insert({
      enforcement_id: enforcementId,
      event_type: `appeal_${payload.status}`,
      action: `appeal_${payload.status}`,
      entity_id: tenantId,
      previous_status: 'appealed',
      new_status: payload.status === 'approved' ? 'revoked' : payload.status === 'denied' ? 'active' : 'escalated',
      reason: payload.decision_summary ?? payload.reviewer_notes ?? null,
      executor: reviewerId,
      actor_id: reviewerId,
      tenant_id: tenantId,
      details: {
        appeal_id: payload.appeal_id,
        decision: payload.status,
        reviewer_notes: payload.reviewer_notes,
        decision_summary: payload.decision_summary,
      },
    } as any);

    // If approved → revoke enforcement and restore account
    if (payload.status === 'approved') {
      await this.revoke(enforcementId, `Appeal approved: ${payload.decision_summary ?? payload.reviewer_notes ?? ''}`);

      // Restore tenant account_status to active
      await supabase
        .from('tenants')
        .update({ account_status: 'active' } as any)
        .eq('id', tenantId);
    }

    // If denied → re-activate enforcement
    if (payload.status === 'denied') {
      await supabase
        .from('account_enforcements')
        .update({ status: 'active' } as any)
        .eq('id', enforcementId);
    }

    // Emit AppealResolved event
    if (payload.status === 'approved' || payload.status === 'denied') {
      kernel.emit(GOVERNANCE_KERNEL_EVENTS.AppealResolved, 'AccountEnforcementEngine', {
        tenant_id: tenantId,
        enforcement_id: enforcementId,
        entity_id: tenantId,
        resolution: payload.status === 'approved' ? 'approved' : 'rejected',
        resolved_by: reviewerId ?? 'system',
        notes: payload.decision_summary ?? payload.reviewer_notes ?? null,
      });
    }
  }

  async getHistory(tenantId: string): Promise<AccountEnforcement[]> {
    const { data } = await supabase
      .from('account_enforcements')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    return (data ?? []) as unknown as AccountEnforcement[];
  }

  async getBanRegistry(tenantId: string): Promise<BanRegistryEntry[]> {
    const { data } = await supabase
      .from('ban_registry')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('banned_at', { ascending: false });

    return (data ?? []) as unknown as BanRegistryEntry[];
  }
}

// Singleton
let _instance: AccountEnforcementEngine | null = null;

export function getAccountEnforcementEngine(): AccountEnforcementEngine {
  if (!_instance) _instance = new AccountEnforcementEngine();
  return _instance;
}
