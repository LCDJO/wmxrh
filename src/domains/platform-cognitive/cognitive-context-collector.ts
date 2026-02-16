/**
 * CognitiveContextCollector
 *
 * Gathers a PlatformSnapshot from the database — tenants, users,
 * permissions, role-permission bindings — so advisors can reason
 * over real data without each one fetching independently.
 */
import { supabase } from '@/integrations/supabase/client';
import type { PlatformSnapshot } from './types';

export class CognitiveContextCollector {
  private cache: PlatformSnapshot | null = null;
  private cacheTs = 0;
  private readonly TTL_MS = 60_000; // 1 min

  async collect(force = false): Promise<PlatformSnapshot> {
    if (!force && this.cache && Date.now() - this.cacheTs < this.TTL_MS) {
      return this.cache;
    }

    const [tenantsRes, usersRes, permsRes, rpRes] = await Promise.all([
      supabase.from('tenants').select('id, name, status, created_at').limit(100),
      supabase.from('platform_users').select('id, email, role, status').limit(200),
      supabase.from('platform_permission_definitions').select('id, code, module, description'),
      supabase.from('platform_role_permissions').select('id, role, permission_id'),
    ]);

    this.cache = {
      tenants: (tenantsRes.data as any[]) ?? [],
      users: (usersRes.data as any[]) ?? [],
      permissions: (permsRes.data as any[]) ?? [],
      role_permissions: (rpRes.data as any[]) ?? [],
      modules_available: ['dashboard', 'tenants', 'modules', 'users', 'security', 'audit'],
    };
    this.cacheTs = Date.now();
    return this.cache;
  }

  invalidate() {
    this.cache = null;
    this.cacheTs = 0;
  }
}
