/**
 * PolicyRegistry — CRUD for platform policies.
 */

import { supabase } from '@/integrations/supabase/client';
import type { PlatformPolicy, PolicyCategory, PolicyAppliesTo, PolicyScope, PolicyType } from './types';

export interface CreatePolicyPayload {
  slug: string;
  name: string;
  description?: string;
  policy_type: PolicyType;
  category: PolicyCategory;
  applies_to: PolicyAppliesTo;
  scope: PolicyScope;
  is_mandatory?: boolean;
  requires_re_acceptance_on_update?: boolean;
  grace_period_days?: number;
}

export interface UpdatePolicyPayload {
  name?: string;
  description?: string;
  policy_type?: PolicyType;
  category?: PolicyCategory;
  applies_to?: PolicyAppliesTo;
  scope?: PolicyScope;
  is_mandatory?: boolean;
  requires_re_acceptance_on_update?: boolean;
  grace_period_days?: number;
  is_active?: boolean;
}

export class PolicyRegistry {
  async list(): Promise<PlatformPolicy[]> {
    const { data } = await supabase
      .from('platform_policies')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    return (data ?? []) as unknown as PlatformPolicy[];
  }

  async getById(policyId: string): Promise<PlatformPolicy> {
    const { data } = await supabase
      .from('platform_policies')
      .select('*')
      .eq('id', policyId)
      .single();

    if (!data) throw new Error('Policy not found');
    return data as unknown as PlatformPolicy;
  }

  async getBySlug(slug: string): Promise<PlatformPolicy | null> {
    const { data } = await supabase
      .from('platform_policies')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();

    return data as unknown as PlatformPolicy | null;
  }

  async getMandatory(): Promise<PlatformPolicy[]> {
    const { data } = await supabase
      .from('platform_policies')
      .select('*')
      .eq('is_active', true)
      .eq('is_mandatory', true)
      .order('created_at', { ascending: true });

    return (data ?? []) as unknown as PlatformPolicy[];
  }

  async getByCategory(category: PolicyCategory): Promise<PlatformPolicy[]> {
    const { data } = await supabase
      .from('platform_policies')
      .select('*')
      .eq('is_active', true)
      .eq('category', category)
      .order('created_at', { ascending: true });

    return (data ?? []) as unknown as PlatformPolicy[];
  }

  async getByAppliesTo(appliesTo: PolicyAppliesTo): Promise<PlatformPolicy[]> {
    const { data } = await supabase
      .from('platform_policies')
      .select('*')
      .eq('is_active', true)
      .eq('applies_to', appliesTo)
      .order('created_at', { ascending: true });

    return (data ?? []) as unknown as PlatformPolicy[];
  }

  async getByScope(scope: PolicyScope): Promise<PlatformPolicy[]> {
    const { data } = await supabase
      .from('platform_policies')
      .select('*')
      .eq('is_active', true)
      .eq('scope', scope)
      .order('created_at', { ascending: true });

    return (data ?? []) as unknown as PlatformPolicy[];
  }

  async create(payload: CreatePolicyPayload): Promise<PlatformPolicy> {
    const { data, error } = await supabase
      .from('platform_policies')
      .insert({
        slug: payload.slug,
        name: payload.name,
        description: payload.description ?? null,
        policy_type: payload.policy_type,
        category: payload.category,
        applies_to: payload.applies_to,
        scope: payload.scope,
        is_mandatory: payload.is_mandatory ?? false,
        requires_re_acceptance_on_update: payload.requires_re_acceptance_on_update ?? false,
        grace_period_days: payload.grace_period_days ?? 7,
        is_active: true,
      } as any)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as PlatformPolicy;
  }

  async update(policyId: string, payload: UpdatePolicyPayload): Promise<PlatformPolicy> {
    const { data, error } = await supabase
      .from('platform_policies')
      .update({ ...payload, updated_at: new Date().toISOString() } as any)
      .eq('id', policyId)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as PlatformPolicy;
  }

  async softDelete(policyId: string): Promise<void> {
    const { error } = await supabase
      .from('platform_policies')
      .update({ is_active: false, updated_at: new Date().toISOString() } as any)
      .eq('id', policyId);

    if (error) throw error;
  }
}
