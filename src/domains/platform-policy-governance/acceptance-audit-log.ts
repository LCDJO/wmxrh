/**
 * AcceptanceAuditLog — Immutable record of all policy acceptance events.
 */

import { supabase } from '@/integrations/supabase/client';
import type { PolicyAcceptance } from './types';

export class AcceptanceAuditLog {
  async getHistory(tenantId: string): Promise<PolicyAcceptance[]> {
    const { data } = await supabase
      .from('platform_policy_acceptances')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('accepted_at', { ascending: false });

    return (data ?? []) as unknown as PolicyAcceptance[];
  }

  async getByPolicy(policyId: string): Promise<PolicyAcceptance[]> {
    const { data } = await supabase
      .from('platform_policy_acceptances')
      .select('*')
      .eq('policy_id', policyId)
      .order('accepted_at', { ascending: false });

    return (data ?? []) as unknown as PolicyAcceptance[];
  }

  async getCurrentAcceptance(policyId: string, tenantId: string): Promise<PolicyAcceptance | null> {
    const { data } = await supabase
      .from('platform_policy_acceptances')
      .select('*')
      .eq('policy_id', policyId)
      .eq('tenant_id', tenantId)
      .eq('is_current', true)
      .maybeSingle();

    return data as unknown as PolicyAcceptance | null;
  }
}
