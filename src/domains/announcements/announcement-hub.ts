/**
 * AnnouncementHub — Domain service for TenantAnnouncements.
 *
 * Entity: TenantAnnouncement
 * alert_type: billing | fiscal | system | security
 * severity: info | warning | critical
 * blocking_level: none | banner | restricted_access
 * source: saas_management
 *
 * Targeting: global | tenant_id | target_plan_id | target_feature_flag
 */

import { supabase } from '@/integrations/supabase/client';

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

export type AlertType = 'billing' | 'fiscal' | 'system' | 'security';
export type Severity = 'info' | 'warning' | 'critical';
export type BlockingLevel = 'none' | 'banner' | 'restricted_access';

export interface TenantAnnouncement {
  id: string;
  tenant_id: string | null;
  title: string;
  message: string;
  alert_type: AlertType;
  severity: Severity;
  source: string;
  action_url: string | null;
  blocking_level: BlockingLevel;
  start_at: string;
  end_at: string | null;
  is_dismissible: boolean;
  created_by: string | null;
  target_plan_id: string | null;
  target_feature_flag: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnnouncementDismissal {
  id: string;
  announcement_id: string;
  user_id: string;
  dismissed_at: string;
}

export interface CreateAnnouncementInput {
  tenant_id?: string | null;
  title: string;
  message: string;
  alert_type: AlertType;
  severity: Severity;
  action_url?: string | null;
  blocking_level?: BlockingLevel;
  start_at?: string;
  end_at?: string | null;
  is_dismissible?: boolean;
  target_plan_id?: string | null;
  target_feature_flag?: string | null;
}

// ══════════════════════════════════════════════════════════════
// Targeting helpers
// ══════════════════════════════════════════════════════════════

export type TargetingMode = 'global' | 'tenant' | 'plan' | 'feature_flag';

export function resolveTargetingMode(a: TenantAnnouncement | CreateAnnouncementInput): TargetingMode {
  if (a.target_feature_flag) return 'feature_flag';
  if (a.target_plan_id) return 'plan';
  if (a.tenant_id) return 'tenant';
  return 'global';
}

export function getTargetingLabel(a: TenantAnnouncement): string {
  const mode = resolveTargetingMode(a);
  switch (mode) {
    case 'global': return '🌐 Global';
    case 'tenant': return '🏢 Tenant específico';
    case 'plan': return '📋 Por plano';
    case 'feature_flag': return '🚩 Por feature flag';
  }
}

// ══════════════════════════════════════════════════════════════
// UI Config
// ══════════════════════════════════════════════════════════════

export const ALERT_TYPE_CONFIG: Record<AlertType, {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}> = {
  billing:  { label: 'Faturamento', icon: 'CreditCard', color: 'text-orange-600', bgColor: 'bg-orange-500/10' },
  fiscal:   { label: 'Fiscal', icon: 'FileText', color: 'text-amber-600', bgColor: 'bg-amber-500/10' },
  system:   { label: 'Sistema', icon: 'Settings', color: 'text-primary', bgColor: 'bg-primary/10' },
  security: { label: 'Segurança', icon: 'ShieldAlert', color: 'text-destructive', bgColor: 'bg-destructive/10' },
};

export const SEVERITY_CONFIG: Record<Severity, {
  label: string;
  color: string;
  bannerClass: string;
}> = {
  info:     { label: 'Informativo', color: 'text-primary', bannerClass: 'bg-primary/5 border-primary/20' },
  warning:  { label: 'Atenção', color: 'text-warning', bannerClass: 'bg-warning/10 border-warning/30' },
  critical: { label: 'Crítico', color: 'text-destructive', bannerClass: 'bg-destructive/10 border-destructive/30' },
};

export const BLOCKING_LEVEL_CONFIG: Record<BlockingLevel, { label: string; icon: string }> = {
  none:              { label: 'Nenhum', icon: 'Circle' },
  banner:            { label: 'Banner', icon: 'Flag' },
  restricted_access: { label: 'Acesso Restrito', icon: 'Lock' },
};

// ══════════════════════════════════════════════════════════════
// Severity → NotificationType mapping
// ══════════════════════════════════════════════════════════════

export function severityToNotificationType(severity: Severity): 'info' | 'warning' | 'critical' {
  return severity; // direct mapping
}

// ══════════════════════════════════════════════════════════════
// Tenant-scoped cache
// ══════════════════════════════════════════════════════════════

const CACHE_TTL_MS = 60_000; // 1 minute

interface CacheEntry {
  data: TenantAnnouncement[];
  fetchedAt: number;
  tenantId: string;
}

let _cache: CacheEntry | null = null;
let _dismissedCache: { userId: string; ids: Set<string>; fetchedAt: number } | null = null;

function isCacheValid(tenantId: string): boolean {
  if (!_cache) return false;
  if (_cache.tenantId !== tenantId) return false;
  return Date.now() - _cache.fetchedAt < CACHE_TTL_MS;
}

function isDismissedCacheValid(userId: string): boolean {
  if (!_dismissedCache) return false;
  if (_dismissedCache.userId !== userId) return false;
  return Date.now() - _dismissedCache.fetchedAt < CACHE_TTL_MS;
}

// ══════════════════════════════════════════════════════════════
// AnnouncementDispatcher — CRUD with tenant cache
// ══════════════════════════════════════════════════════════════

export const announcementDispatcher = {
  /** Fetch active announcements visible to the current user's tenant (cached) */
  async listActive(tenantId: string, tenantPlanId?: string | null): Promise<TenantAnnouncement[]> {
    // Return cached if valid
    if (isCacheValid(tenantId)) {
      return filterByPlan(_cache!.data, tenantPlanId);
    }

    const now = new Date().toISOString();
    const { data, error } = await (supabase
      .from('tenant_announcements' as any)
      .select('*')
      .lte('start_at', now)
      .or(`end_at.is.null,end_at.gte.${now}`)
      .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
      .order('severity', { ascending: true })
      .order('created_at', { ascending: false }) as any);

    if (error) throw error;
    const all = (data || []) as TenantAnnouncement[];

    // Store in cache
    _cache = { data: all, fetchedAt: Date.now(), tenantId };

    return filterByPlan(all, tenantPlanId);
  },

  /** Fetch ALL announcements for platform admin management (uncached) */
  async listAll(filters?: {
    alert_type?: string;
    severity?: string;
  }): Promise<TenantAnnouncement[]> {
    let query = supabase
      .from('tenant_announcements' as any)
      .select('*')
      .order('created_at', { ascending: false }) as any;

    if (filters?.alert_type) query = query.eq('alert_type', filters.alert_type);
    if (filters?.severity) query = query.eq('severity', filters.severity);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as TenantAnnouncement[];
  },

  /** Create a new announcement (invalidates cache) */
  async create(input: CreateAnnouncementInput): Promise<TenantAnnouncement> {
    const { data, error } = await (supabase
      .from('tenant_announcements' as any)
      .insert({
        tenant_id: input.tenant_id ?? null,
        title: input.title,
        message: input.message,
        alert_type: input.alert_type,
        severity: input.severity,
        source: 'saas_management',
        action_url: input.action_url ?? null,
        blocking_level: input.blocking_level ?? 'none',
        start_at: input.start_at ?? new Date().toISOString(),
        end_at: input.end_at ?? null,
        is_dismissible: input.is_dismissible ?? true,
        target_plan_id: input.target_plan_id ?? null,
        target_feature_flag: input.target_feature_flag ?? null,
        created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
      })
      .select()
      .single() as any);

    if (error) throw error;
    announcementDispatcher.invalidateCache();
    return data as TenantAnnouncement;
  },

  /** Update an announcement (invalidates cache) */
  async update(id: string, updates: Partial<CreateAnnouncementInput>): Promise<void> {
    const { error } = await (supabase
      .from('tenant_announcements' as any)
      .update(updates)
      .eq('id', id) as any);

    if (error) throw error;
    announcementDispatcher.invalidateCache();
  },

  /** Delete an announcement (invalidates cache) */
  async remove(id: string): Promise<void> {
    const { error } = await (supabase
      .from('tenant_announcements' as any)
      .delete()
      .eq('id', id) as any);

    if (error) throw error;
    announcementDispatcher.invalidateCache();
  },

  /** Fetch IDs already dismissed by this user (cached) */
  async getDismissedIds(userId: string): Promise<Set<string>> {
    if (isDismissedCacheValid(userId)) {
      return _dismissedCache!.ids;
    }

    const { data, error } = await supabase
      .from('announcement_dismissals')
      .select('announcement_id')
      .eq('user_id', userId);

    if (error) throw error;
    const ids = new Set((data || []).map(d => (d as any).announcement_id));
    _dismissedCache = { userId, ids, fetchedAt: Date.now() };
    return ids;
  },

  /** Dismiss an announcement for this user (invalidates dismissed cache) */
  async dismiss(announcementId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('announcement_dismissals')
      .upsert({
        announcement_id: announcementId,
        user_id: userId,
      } as any, { onConflict: 'announcement_id,user_id' });

    if (error) throw error;
    // Optimistic: add to dismissed cache immediately
    if (_dismissedCache && _dismissedCache.userId === userId) {
      _dismissedCache.ids.add(announcementId);
    }
  },

  /** Invalidate all caches — called by Event Bus on realtime changes */
  invalidateCache(): void {
    _cache = null;
    _dismissedCache = null;
  },
};

// ── Helper ──────────────────────────────────────────────────

function filterByPlan(all: TenantAnnouncement[], tenantPlanId?: string | null): TenantAnnouncement[] {
  return all.filter(a => {
    if (a.target_plan_id && tenantPlanId && a.target_plan_id !== tenantPlanId) return false;
    if (a.target_plan_id && !tenantPlanId) return false;
    return true;
  });
}
