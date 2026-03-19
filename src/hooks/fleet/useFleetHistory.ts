/**
 * useFleetHistory — Paginated history query hook for fleet events.
 *
 * Features:
 * - Smart pagination with cursor-based navigation
 * - Optimized queries with date range filters
 * - React Query integration for caching & deduplication
 * - Supports all fleet event types
 */
import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ── Types ──

export type FleetHistoryTable =
  | 'fleet_behavior_events'
  | 'fleet_compliance_incidents'
  | 'fleet_disciplinary_history'
  | 'raw_tracking_events';

export interface FleetHistoryFilters {
  tenantId: string;
  table: FleetHistoryTable;
  dateFrom?: string;
  dateTo?: string;
  severity?: string;
  employeeId?: string;
  deviceId?: string;
  eventType?: string;
  status?: string;
}

export interface FleetHistoryOptions {
  filters: FleetHistoryFilters;
  pageSize?: number;
  enabled?: boolean;
}

export interface FleetHistoryPage<T = Record<string, unknown>> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ── Query builder ──

async function fetchHistoryPage(
  filters: FleetHistoryFilters,
  page: number,
  pageSize: number,
): Promise<FleetHistoryPage> {
  const { tenantId, table, dateFrom, dateTo, severity, employeeId, deviceId, eventType, status } = filters;

  // Build query dynamically using type assertion for dynamic table names
  let query = (supabase.from as any)(table)
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  // Apply optional filters
  if (dateFrom) query = query.gte('created_at', dateFrom);
  if (dateTo) query = query.lte('created_at', dateTo);
  if (severity) query = query.eq('severity', severity);
  if (employeeId) query = query.eq('employee_id', employeeId);
  if (deviceId) query = query.eq('device_id', deviceId);
  if (eventType) {
    // Different column name depending on table
    const col = table === 'fleet_compliance_incidents' ? 'violation_type' : 'event_type';
    query = query.eq(col, eventType);
  }
  if (status) query = query.eq('status', status);

  const { data, error, count } = await query;

  if (error) {
    console.error(`[useFleetHistory] query error:`, error);
    throw error;
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    items: data ?? [],
    total,
    page,
    pageSize,
    totalPages,
    hasNext: page < totalPages - 1,
    hasPrev: page > 0,
  };
}

// ── Hook ──

export function useFleetHistory(options: FleetHistoryOptions) {
  const { filters, pageSize = 25, enabled = true } = options;
  const [page, setPage] = useState(0);
  const queryClient = useQueryClient();

  // Stable query key incorporating all filters
  const queryKey = useMemo(
    () => ['fleet-history', filters.table, filters.tenantId, filters, page, pageSize],
    [filters, page, pageSize],
  );

  const query = useQuery({
    queryKey,
    queryFn: () => fetchHistoryPage(filters, page, pageSize),
    enabled: enabled && !!filters.tenantId,
    placeholderData: keepPreviousData,
    staleTime: 30_000, // 30s stale time for history data
    gcTime: 5 * 60_000, // 5min garbage collection
  });

  // Prefetch next page for smoother UX
  const prefetchNext = useCallback(() => {
    if (!query.data?.hasNext) return;
    const nextPage = page + 1;
    queryClient.prefetchQuery({
      queryKey: ['fleet-history', filters.table, filters.tenantId, filters, nextPage, pageSize],
      queryFn: () => fetchHistoryPage(filters, nextPage, pageSize),
      staleTime: 30_000,
    });
  }, [query.data?.hasNext, page, filters, pageSize, queryClient]);

  const goToPage = useCallback((p: number) => {
    setPage(Math.max(0, p));
  }, []);

  const nextPage = useCallback(() => {
    if (query.data?.hasNext) {
      setPage(p => p + 1);
      prefetchNext();
    }
  }, [query.data?.hasNext, prefetchNext]);

  const prevPage = useCallback(() => {
    if (query.data?.hasPrev) setPage(p => Math.max(0, p - 1));
  }, [query.data?.hasPrev]);

  const resetPage = useCallback(() => setPage(0), []);

  return {
    ...query,
    page,
    nextPage,
    prevPage,
    goToPage,
    resetPage,
    prefetchNext,
  };
}
