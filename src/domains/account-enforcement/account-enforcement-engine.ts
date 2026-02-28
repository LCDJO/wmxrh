/**
 * AccountEnforcementEngine
 *
 * Manages structured account bans, suspensions, restrictions, and appeals.
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
} from './types';

export class AccountEnforcementEngine implements AccountEnforcementEngineAPI {

  async isTenantRestricted(tenantId: string): Promise<{ restricted: boolean; enforcements: AccountEnforcement[] }> {
    const { data, error } = await supabase
      .from('account_enforcements')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('status', ['active'])
      .in('action_type', ['ban', 'suspend']);

    if (error) throw error;

    const active = (data ?? []) as unknown as AccountEnforcement[];
    // Filter expired
    const now = new Date().toISOString();
    const valid = active.filter(e => !e.expires_at || e.expires_at > now);

    return { restricted: valid.length > 0, enforcements: valid };
  }

  async enforce(payload: EnforceAccountPayload): Promise<AccountEnforcement> {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    // 1) Create enforcement record
    const { data: enforcement, error } = await supabase
      .from('account_enforcements')
      .insert({
        tenant_id: payload.tenant_id,
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

    // 2) Create ban registry entry if ban
    if (payload.action_type === 'ban') {
      await supabase.from('ban_registry').insert({
        tenant_id: payload.tenant_id,
        enforcement_id: record.id,
        ban_type: payload.ban_type ?? 'full',
        scope_detail: payload.scope_detail ?? null,
        is_permanent: payload.is_permanent ?? false,
        banned_by: userId,
      } as any);
    }

    // 3) Audit log
    await supabase.from('enforcement_audit_log').insert({
      enforcement_id: record.id,
      event_type: `account_${payload.action_type}`,
      actor_id: userId,
      tenant_id: payload.tenant_id,
      details: { reason: payload.reason, severity: payload.severity },
    } as any);

    // 4) If ban/suspend → suspend billing
    if (['ban', 'suspend'].includes(payload.action_type)) {
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

    // Unban if applicable
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

    // Update enforcement status
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

    // If approved → revoke enforcement
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
