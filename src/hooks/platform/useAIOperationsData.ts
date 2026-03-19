/**
 * useAIOperationsData — Fetches real platform data from the database
 * to power the AI Operations dashboard instead of mocked data.
 *
 * Loads:
 *  - Tenants + subscriptions (for revenue optimization)
 *  - Audit logs (to seed platform signals)
 *  - Module activity counts (for pattern analysis)
 *
 * SECURITY: Read-only. Advisory output only.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PlatformSignalCollector } from '@/domains/autonomous-operations/platform-signal-collector';
import { BehaviorPatternAnalyzer } from '@/domains/autonomous-operations/behavior-pattern-analyzer';
import { AutomationSuggestionEngine } from '@/domains/autonomous-operations/automation-suggestion-engine';
import { RiskPredictionService } from '@/domains/autonomous-operations/risk-prediction-service';
import { RevenueOptimizationAdvisor } from '@/domains/autonomous-operations/revenue-optimization-advisor';
import { TenantImpactAnalyzer } from '@/domains/autonomous-operations/tenant-impact-analyzer';
import type { DeployManifest, TenantSnapshot } from '@/domains/autonomous-operations/tenant-impact-analyzer';
import type { AutomationSuggestion, PredictedRisk, RevenueOptimization } from '@/domains/autonomous-operations/types';
import type { DeployImpactAssessment } from '@/domains/autonomous-operations/types';

interface TenantRow {
  id: string;
  name: string;
  status: string;
}

interface SubscriptionRow {
  tenant_id: string;
  plan: string;
  mrr: number;
  status: string;
  seats_used: number;
  seats_included: number;
}

interface AuditRow {
  action: string;
  entity_type: string;
  created_at: string;
  tenant_id: string;
  metadata: Record<string, unknown> | null;
}

async function fetchPlatformData() {
  // Fetch tenants
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, name, status')
    .eq('status', 'active');

  // Fetch subscriptions
  const { data: subscriptions } = await supabase
    .from('tenant_subscriptions')
    .select('tenant_id, plan, mrr, status, seats_used, seats_included')
    .in('status', ['active', 'trial']);

  // Fetch recent audit logs (last 24h)
  const cutoff = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: auditLogs } = await supabase
    .from('audit_logs')
    .select('action, entity_type, created_at, tenant_id, metadata')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(200);

  // Fetch employee counts per tenant
  const { data: employeeCounts } = await supabase
    .from('employees')
    .select('tenant_id')
    .is('deleted_at', null);

  // Fetch company counts per tenant
  const { data: companyCounts } = await supabase
    .from('companies')
    .select('tenant_id')
    .is('deleted_at', null);

  // Fetch automation rule counts
  const { data: automationRules } = await supabase
    .from('automation_rules')
    .select('tenant_id, is_active')
    .eq('is_active', true);

  // Count active modules per tenant (heuristic: tables with data = active module)
  const moduleActivity: Record<string, Set<string>> = {};
  for (const e of (employeeCounts || [])) {
    if (!moduleActivity[e.tenant_id]) moduleActivity[e.tenant_id] = new Set();
    moduleActivity[e.tenant_id].add('employees');
  }
  for (const c of (companyCounts || [])) {
    if (!moduleActivity[c.tenant_id]) moduleActivity[c.tenant_id] = new Set();
    moduleActivity[c.tenant_id].add('companies');
  }
  for (const a of (automationRules || [])) {
    if (!moduleActivity[a.tenant_id]) moduleActivity[a.tenant_id] = new Set();
    moduleActivity[a.tenant_id].add('automation');
  }

  return {
    tenants: (tenants || []) as TenantRow[],
    subscriptions: (subscriptions || []) as SubscriptionRow[],
    auditLogs: (auditLogs || []) as AuditRow[],
    moduleActivity,
  };
}

function seedSignalsFromAuditLogs(auditLogs: AuditRow[]) {
  // Clear old signals and seed from real audit data
  PlatformSignalCollector.clear();

  for (const log of auditLogs) {
    const severity = log.action === 'delete' ? 'warning' as const
      : log.action === 'update' ? 'info' as const
      : 'info' as const;

    const source = log.entity_type.includes('security') || log.entity_type.includes('role')
      ? 'identity' as const
      : log.entity_type.includes('automation') || log.entity_type.includes('workflow')
      ? 'automation' as const
      : log.entity_type.includes('api')
      ? 'api' as const
      : 'module' as const;

    PlatformSignalCollector.emit(
      source,
      `audit:${log.action}_${log.entity_type}`,
      severity,
      { entity_type: log.entity_type, action: log.action, ...(log.metadata || {}) },
      log.tenant_id,
      log.entity_type,
    );
  }
}

const TOTAL_MODULES = 13;

export function useAIOperationsData() {
  return useQuery({
    queryKey: ['ai-operations-data'],
    queryFn: async () => {
      const data = await fetchPlatformData();

      // Seed real signals
      seedSignalsFromAuditLogs(data.auditLogs);

      // Build tenant snapshots for revenue analysis
      const subMap = new Map(data.subscriptions.map(s => [s.tenant_id, s]));
      const tenantSnapshots = data.tenants.map(t => {
        const sub = subMap.get(t.id);
        const activeModules = data.moduleActivity[t.id]?.size || 0;
        const usagePct = sub ? Math.round((sub.seats_used / Math.max(sub.seats_included, 1)) * 100) : 0;

        return {
          tenant_id: t.id,
          tenant_name: t.name,
          current_plan: sub?.plan || 'free',
          mrr: sub?.mrr || 0,
          usage_pct: usagePct,
          active_modules: activeModules,
          total_modules: TOTAL_MODULES,
          months_active: 6, // could be calculated from created_at
          churn_risk_score: usagePct < 20 ? 70 : usagePct < 40 ? 40 : 10,
        };
      });

      // Run AI engines with real data
      const patterns = BehaviorPatternAnalyzer.analyze(24);
      const suggestions = AutomationSuggestionEngine.generateAll(patterns);
      const risks = RiskPredictionService.predictAll(patterns);
      
      // Use async engine for revenue if available, fallback to sync
      let revenueOpts: RevenueOptimization[];
      try {
        revenueOpts = await RevenueOptimizationAdvisor.analyzeFromEngine();
        // If no results from engine, fallback to snapshot-based analysis
        if (revenueOpts.length === 0) {
          revenueOpts = RevenueOptimizationAdvisor.analyze(tenantSnapshots);
        }
      } catch {
        revenueOpts = RevenueOptimizationAdvisor.analyze(tenantSnapshots);
      }

      // Build tenant impact with real tenant data
      const tenantSnapshotsForDeploy: TenantSnapshot[] = data.tenants.map(t => {
        const sub = subMap.get(t.id);
        const modules = Array.from(data.moduleActivity[t.id] || []);
        return {
          tenant_id: t.id,
          tenant_name: t.name,
          plan: sub?.plan || 'free',
          mrr: sub?.mrr || 0,
          active_modules: modules,
          active_workflows: 0,
          active_automations: (data.subscriptions.find(s => s.tenant_id === t.id) ? 1 : 0),
          workflows_using_modules: {},
        };
      });

      const manifest: DeployManifest = {
        release_id: `rel_${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}`,
        release_label: 'Próximo Release',
        changed_modules: ['payroll_sim', 'compensation'],
        has_breaking_api_changes: false,
        billing_changes: false,
      };

      const deployAssessment = tenantSnapshotsForDeploy.length > 0
        ? TenantImpactAnalyzer.assessDeploy(manifest, tenantSnapshotsForDeploy)
        : TenantImpactAnalyzer.assessDeployPreview();

      // Dashboard summary
      const signals = PlatformSignalCollector.getRecent(24);
      const criticalRisks = risks.filter(r => r.composite_score >= 60).length;
      const overall_health = criticalRisks >= 2 ? 'critical' as const
        : criticalRisks >= 1 || patterns.some(p => p.type === 'error_burst') ? 'degraded' as const
        : 'healthy' as const;

      return {
        dashboard: {
          total_signals_24h: signals.length,
          active_patterns: patterns.length,
          pending_suggestions: suggestions.filter(s => s.status === 'pending').length,
          active_risks: risks.length,
          revenue_optimizations: revenueOpts.length,
          overall_health,
        },
        suggestions,
        risks,
        revenueOpts,
        deployAssessment,
        tenantCount: data.tenants.length,
      };
    },
    staleTime: 60_000, // 1 minute
    refetchInterval: 5 * 60_000, // refresh every 5 min
  });
}
