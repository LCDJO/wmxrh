/**
 * DeveloperMetricsCollector — Collects developer/marketplace metrics for Prometheus export.
 *
 * Exports:
 *  - developer_apps_total{status="..."}
 *  - marketplace_installs_total{app="..."}
 *  - oauth_token_issued_total
 *  - api_calls_by_app{app_id="...", app_name="..."}
 *
 * Uses in-memory cache with TTL to avoid hammering the database on every scrape.
 */

import { supabase } from '@/integrations/supabase/client';

export interface AppStatusEntry {
  status: string;
  count: number;
}

export interface AppInstallEntry {
  app_id: string;
  app_name: string;
  install_count: number;
}

export interface AppApiCallEntry {
  app_id: string;
  app_name: string;
  total_calls: number;
}

export interface DeveloperMetricsSnapshot {
  apps_by_status: AppStatusEntry[];
  apps_total: number;
  installs_total: number;
  installs_by_app: AppInstallEntry[];
  oauth_tokens_issued: number;
  api_calls_by_app: AppApiCallEntry[];
  collected_at: number;
}

const CACHE_TTL_MS = 60_000; // 1 minute

let _cache: DeveloperMetricsSnapshot | null = null;
let _lastFetch = 0;
let _fetching = false;

const EMPTY_SNAPSHOT: DeveloperMetricsSnapshot = {
  apps_by_status: [],
  apps_total: 0,
  installs_total: 0,
  installs_by_app: [],
  oauth_tokens_issued: 0,
  api_calls_by_app: [],
  collected_at: 0,
};

/**
 * Returns the latest developer metrics snapshot (sync, from cache).
 * Triggers async refresh if stale.
 */
export function getDeveloperMetricsSnapshot(): DeveloperMetricsSnapshot {
  const now = Date.now();

  if (!_fetching && (now - _lastFetch > CACHE_TTL_MS)) {
    _fetching = true;
    refreshDeveloperMetrics().finally(() => { _fetching = false; });
  }

  return _cache ?? { ...EMPTY_SNAPSHOT };
}

/**
 * Force refresh developer metrics from database.
 */
export async function refreshDeveloperMetrics(): Promise<DeveloperMetricsSnapshot> {
  try {
    // Fetch all apps with status
    const { data: apps } = await supabase
      .from('developer_apps')
      .select('id, name, app_status, install_count');

    const allApps = apps ?? [];

    // Apps by status
    const statusMap = new Map<string, number>();
    for (const app of allApps) {
      const s = app.app_status ?? 'unknown';
      statusMap.set(s, (statusMap.get(s) ?? 0) + 1);
    }
    const apps_by_status: AppStatusEntry[] = [];
    for (const [status, count] of statusMap) {
      apps_by_status.push({ status, count });
    }

    // Installs by app (from developer_apps.install_count)
    let installs_total = 0;
    const installs_by_app: AppInstallEntry[] = [];
    for (const app of allApps) {
      const count = app.install_count ?? 0;
      installs_total += count;
      if (count > 0) {
        installs_by_app.push({ app_id: app.id, app_name: app.name, install_count: count });
      }
    }

    // OAuth tokens issued (count active API subscriptions as proxy)
    const { count: oauthCount } = await supabase
      .from('developer_api_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');

    // API calls by app (from revenue entries of type 'usage' as proxy, or api_usage_logs)
    const { data: usageLogs } = await supabase
      .from('developer_app_revenue_entries')
      .select('app_id, developer_apps(name)')
      .eq('entry_type', 'usage');

    const callsMap = new Map<string, { name: string; count: number }>();
    for (const log of usageLogs ?? []) {
      const existing = callsMap.get(log.app_id);
      const appName = (log.developer_apps as any)?.name ?? 'unknown';
      if (existing) {
        existing.count++;
      } else {
        callsMap.set(log.app_id, { name: appName, count: 1 });
      }
    }
    const api_calls_by_app: AppApiCallEntry[] = [];
    for (const [app_id, { name, count }] of callsMap) {
      api_calls_by_app.push({ app_id, app_name: name, total_calls: count });
    }

    _cache = {
      apps_by_status,
      apps_total: allApps.length,
      installs_total,
      installs_by_app,
      oauth_tokens_issued: oauthCount ?? 0,
      api_calls_by_app,
      collected_at: Date.now(),
    };

    _lastFetch = Date.now();
    return _cache;
  } catch (err) {
    console.warn('[DeveloperMetrics] Failed to refresh:', err);
    return _cache ?? { ...EMPTY_SNAPSHOT };
  }
}
