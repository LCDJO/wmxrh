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

    // Audit log
    await supabase.from('enforcement_audit_log').insert({
      enforcement_id: record.id,
      event_type: `account_${payload.action_type}`,
      actor_id: userId,
      tenant_id: payload.tenant_id,
      details: { reason: payload.reason, severity: payload.severity, entity_type: entityType, entity_id: entityId },
    } as any);

    // Suspend billing if tenant ban/suspend
    if (entityType === 'tenant' && ['ban', 'suspend'].includes(payload.action_type)) {
      await supabase
        .from('tenant_plans')
        .update({ status: 'suspended', updated_at: new Date().toISOString() } as any)
        .eq('tenant_id', payload.tenant_id)
        .in('status', ['active', 'trial']);
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
      actor_id: userId,
      tenant_id: (existing as any).tenant_id,
      details: { reason },
    } as any);
  }

  async appeal(payload: AppealPayload): Promise<EnforcementAppeal> {
    const { data: userData } = await supabase.auth.getUser();

    const { data: enforcement } = await supabase
      .from('account_enforcements')
      .select('tenant_id')
      .eq('id', payload.enforcement_id)
      .single();

    if (!enforcement) throw new Error('Enforcement not found');

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

    await supabase
      .from('account_enforcements')
      .update({ status: 'appealed' } as any)
      .eq('id', payload.enforcement_id);

    return data as unknown as EnforcementAppeal;
  }

  async reviewAppeal(payload: ReviewAppealPayload): Promise<void> {
    const { data: userData } = await supabase.auth.getUser();

    await supabase
      .from('enforcement_appeals')
      .update({
        status: payload.status,
        reviewer_id: userData?.user?.id,
        reviewer_notes: payload.reviewer_notes ?? null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', payload.appeal_id);

    if (payload.status === 'approved') {
      const { data: appeal } = await supabase
        .from('enforcement_appeals')
        .select('enforcement_id')
        .eq('id', payload.appeal_id)
        .single();

      if (appeal) {
        await this.revoke((appeal as any).enforcement_id, `Appeal approved: ${payload.reviewer_notes ?? ''}`);
      }
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
