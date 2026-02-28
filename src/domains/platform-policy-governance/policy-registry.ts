/**
 * PolicyRegistry — CRUD for platform policies.
 */

import { supabase } from '@/integrations/supabase/client';
import type { PlatformPolicy, PolicyCategory, PolicyAppliesTo } from './types';

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
}
