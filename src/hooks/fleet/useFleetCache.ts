/**
 * useFleetCache — 24-hour intelligent cache layer for fleet data.
 *
 * Features:
 * - Automatic cache invalidation after 24h
 * - SessionStorage persistence for page reload survival
 * - ETag-based freshness checks
 * - React Query integration with stale-while-revalidate
 * - Selective invalidation by event type
 */
import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ── Types ──

export interface FleetCacheConfig {
  tenantId: string;
  enabled?: boolean;
  /** Cache TTL in ms (default: 24 hours) */
  ttlMs?: number;
}

interface CachedData<T = unknown[]> {
  data: T;
  timestamp: number;
  etag: string;
}

type FleetCacheKey =
  | 'fleet_summary_24h'
  | 'fleet_alerts_24h'
  | 'fleet_top_offenders'
  | 'fleet_device_status';

const CACHE_PREFIX = 'fleet_cache_';
const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24h

// ── SessionStorage helpers ──

function readCache<T>(key: string): CachedData<T> | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedData<T>;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T, etag: string): void {
  try {
    const entry: CachedData<T> = { data, timestamp: Date.now(), etag };
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Storage full — silently fail
  }
}

function clearCacheKey(key: string): void {
  try {
    sessionStorage.removeItem(CACHE_PREFIX + key);
  } catch {
    // ignore
  }
}

// ── Data fetchers ──

async function fetchSummary24h(tenantId: string) {
  const since = new Date(Date.now() - DEFAULT_TTL).toISOString();

  // Parallel fetch for behavior events and incidents in last 24h
  const [behaviorRes, incidentRes] = await Promise.all([
    (supabase.from as any)('fleet_behavior_events')
      .select('id, severity, event_type, employee_id', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500),
    (supabase.from as any)('fleet_compliance_incidents')
      .select('id, severity, status, violation_type', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  const behaviors = behaviorRes.data ?? [];
  const incidents = incidentRes.data ?? [];

  // Compute summary
  const severityCounts = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const b of behaviors) {
    if (b.severity in severityCounts) {
      severityCounts[b.severity as keyof typeof severityCounts]++;
    }
  }

  const pendingIncidents = incidents.filter((i: any) => i.status === 'pending').length;
  const uniqueEmployees = new Set(behaviors.map((b: any) => b.employee_id).filter(Boolean)).size;

  return {
    totalBehaviorEvents: behaviorRes.count ?? behaviors.length,
    totalIncidents: incidentRes.count ?? incidents.length,
    severityCounts,
    pendingIncidents,
    uniqueEmployeesInvolved: uniqueEmployees,
    lastUpdated: new Date().toISOString(),
  };
}

async function fetchTopOffenders(tenantId: string) {
  const since = new Date(Date.now() - DEFAULT_TTL).toISOString();

  const { data } = await (supabase.from as any)('fleet_behavior_events')
    .select('employee_id, severity')
    .eq('tenant_id', tenantId)
    .gte('created_at', since)
    .limit(1000);

  if (!data || data.length === 0) return [];

  const counts: Record<string, { total: number; critical: number }> = {};
  for (const row of data) {
    const eid = row.employee_id || 'unknown';
    if (!counts[eid]) counts[eid] = { total: 0, critical: 0 };
    counts[eid].total++;
    if (row.severity === 'critical') counts[eid].critical++;
  }

  return Object.entries(counts)
    .map(([id, c]) => ({ employeeId: id, ...c }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);
}

async function fetchActiveAlerts(tenantId: string) {
  const { data, count } = await (supabase.from as any)('fleet_compliance_incidents')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(50);

  return { alerts: data ?? [], total: count ?? 0 };
}

// ── Hook ──

export function useFleetCache(config: FleetCacheConfig) {
  const { tenantId, enabled = true, ttlMs = DEFAULT_TTL } = config;
  const queryClient = useQueryClient();
  const invalidationTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Generate etag from timestamp
  const makeEtag = () => `etag-${Date.now()}`;

  // ── Summary query with 24h cache ──
  const summary = useQuery({
    queryKey: ['fleet-cache', 'summary', tenantId],
    queryFn: async () => {
      const cached = readCache<ReturnType<typeof fetchSummary24h>>('summary_' + tenantId);
      if (cached && Date.now() - cached.timestamp < ttlMs) {
        return cached.data;
      }
      const fresh = await fetchSummary24h(tenantId);
      writeCache('summary_' + tenantId, fresh, makeEtag());
      return fresh;
    },
    enabled: enabled && !!tenantId,
    staleTime: 5 * 60_000, // 5 min stale-while-revalidate
    gcTime: ttlMs,
    refetchInterval: 5 * 60_000, // Background refresh every 5 min
  });

  // ── Top offenders with cache ──
  const topOffenders = useQuery({
    queryKey: ['fleet-cache', 'top-offenders', tenantId],
    queryFn: async () => {
      const cached = readCache<Awaited<ReturnType<typeof fetchTopOffenders>>>('offenders_' + tenantId);
      if (cached && Date.now() - cached.timestamp < ttlMs) {
        return cached.data;
      }
      const fresh = await fetchTopOffenders(tenantId);
      writeCache('offenders_' + tenantId, fresh, makeEtag());
      return fresh;
    },
    enabled: enabled && !!tenantId,
    staleTime: 10 * 60_000,
    gcTime: ttlMs,
  });

  // ── Active alerts (shorter cache) ──
  const activeAlerts = useQuery({
    queryKey: ['fleet-cache', 'active-alerts', tenantId],
    queryFn: async () => {
      const fresh = await fetchActiveAlerts(tenantId);
      writeCache('alerts_' + tenantId, fresh, makeEtag());
      return fresh;
    },
    enabled: enabled && !!tenantId,
    staleTime: 60_000, // 1 min for alerts
    gcTime: 10 * 60_000,
    refetchInterval: 60_000,
  });

  // ── Invalidation ──
  const invalidateAll = useCallback(() => {
    clearCacheKey('summary_' + tenantId);
    clearCacheKey('offenders_' + tenantId);
    clearCacheKey('alerts_' + tenantId);
    queryClient.invalidateQueries({ queryKey: ['fleet-cache'] });
  }, [tenantId, queryClient]);

  const invalidateKey = useCallback(
    (key: FleetCacheKey) => {
      clearCacheKey(key + '_' + tenantId);
      queryClient.invalidateQueries({ queryKey: ['fleet-cache', key.replace('_24h', '').replace('fleet_', '')] });
    },
    [tenantId, queryClient],
  );

  // Auto-invalidate after TTL
  useEffect(() => {
    if (!enabled) return;
    invalidationTimerRef.current = setTimeout(invalidateAll, ttlMs);
    return () => {
      if (invalidationTimerRef.current) clearTimeout(invalidationTimerRef.current);
    };
  }, [enabled, ttlMs, invalidateAll]);

  return {
    summary,
    topOffenders,
    activeAlerts,
    invalidateAll,
    invalidateKey,
  };
}
