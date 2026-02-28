/**
 * GovernanceMetricsCollector — Registers policy governance metrics
 * into the central MetricsCollector for Prometheus/Grafana export.
 *
 * Metrics:
 *   - banned_accounts_total (gauge)
 *   - policy_acceptance_pending_total (gauge)
 *   - policy_version_updates_total (counter)
 *   - appeals_open_total (gauge)
 */

import { supabase } from '@/integrations/supabase/client';
import { getMetricsCollector } from '@/domains/observability/metrics-collector';

export class GovernanceMetricsCollector {
  private collector = getMetricsCollector();

  /** Refresh all governance gauges from the database */
  async collect(): Promise<void> {
    await Promise.allSettled([
      this.collectBannedAccounts(),
      this.collectPendingAcceptances(),
      this.collectVersionUpdates(),
      this.collectOpenAppeals(),
    ]);
  }

  private async collectBannedAccounts() {
    const { count } = await supabase
      .from('ban_registry')
      .select('*', { count: 'exact', head: true })
      .is('unbanned_at', null);

    this.collector.gauge('banned_accounts_total', count ?? 0, { module: 'governance' });
  }

  private async collectPendingAcceptances() {
    // Count policies with is_mandatory=true that have invalidated acceptances
    const { data: mandatory } = await supabase
      .from('platform_policies')
      .select('id')
      .eq('is_active', true)
      .eq('is_mandatory', true);

    if (!mandatory?.length) {
      this.collector.gauge('policy_acceptance_pending_total', 0, { module: 'governance' });
      return;
    }

    // Count tenants with missing or outdated current acceptances
    const { count } = await supabase
      .from('platform_policy_acceptances')
      .select('*', { count: 'exact', head: true })
      .eq('is_current', false);

    this.collector.gauge('policy_acceptance_pending_total', count ?? 0, { module: 'governance' });
  }

  private async collectVersionUpdates() {
    const { count } = await supabase
      .from('platform_policy_versions')
      .select('*', { count: 'exact', head: true });

    this.collector.gauge('policy_version_updates_total', count ?? 0, { module: 'governance' });
  }

  private async collectOpenAppeals() {
    // Appeals from account_enforcements with status 'appealed' or similar
    const { count } = await supabase
      .from('account_enforcements')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'appealed');

    this.collector.gauge('appeals_open_total', count ?? 0, { module: 'governance' });
  }
}

// Singleton
let _instance: GovernanceMetricsCollector | null = null;
export function getGovernanceMetricsCollector(): GovernanceMetricsCollector {
  if (!_instance) _instance = new GovernanceMetricsCollector();
  return _instance;
}
