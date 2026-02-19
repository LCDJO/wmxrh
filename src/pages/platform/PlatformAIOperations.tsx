/**
 * PlatformAIOperations — Insight Dashboard for Autonomous Operations AI Engine.
 * Route: /platform/ai-operations
 *
 * Widgets:
 *  - AutomationSuggestionsPanel
 *  - RiskPredictionHeatmap
 *  - RevenueOptimizationCards
 *  - TenantImpactPreview
 */

import { useMemo } from 'react';
import { Brain, Activity, TrendingUp, Shield } from 'lucide-react';
import { StatsCard } from '@/components/shared/StatsCard';
import { InsightDashboardService } from '@/domains/autonomous-operations/insight-dashboard-service';
import { AutomationSuggestionEngine } from '@/domains/autonomous-operations/automation-suggestion-engine';
import { BehaviorPatternAnalyzer } from '@/domains/autonomous-operations/behavior-pattern-analyzer';
import { RiskPredictionService } from '@/domains/autonomous-operations/risk-prediction-service';
import { RevenueOptimizationAdvisor } from '@/domains/autonomous-operations/revenue-optimization-advisor';
import { TenantImpactAnalyzer } from '@/domains/autonomous-operations/tenant-impact-analyzer';
import { AutomationSuggestionsPanel } from '@/components/platform/ai-operations/AutomationSuggestionsPanel';
import { RiskPredictionHeatmap } from '@/components/platform/ai-operations/RiskPredictionHeatmap';
import { RevenueOptimizationCards } from '@/components/platform/ai-operations/RevenueOptimizationCards';
import { TenantImpactPreview } from '@/components/platform/ai-operations/TenantImpactPreview';

export default function PlatformAIOperations() {
  const dashboard = useMemo(() => InsightDashboardService.buildDashboard(), []);
  const patterns = useMemo(() => BehaviorPatternAnalyzer.analyze(24), []);
  const suggestions = useMemo(() => AutomationSuggestionEngine.generateAll(patterns), [patterns]);
  const risks = useMemo(() => RiskPredictionService.predictAll(patterns), [patterns]);
  const revenueOpts = useMemo(() => RevenueOptimizationAdvisor.analyze([
    { tenant_id: 't1', tenant_name: 'Empresa Alpha', current_plan: 'professional', mrr: 499, usage_pct: 82, active_modules: 8, total_modules: 13, months_active: 6, churn_risk_score: 15 },
    { tenant_id: 't2', tenant_name: 'Corp Beta', current_plan: 'starter', mrr: 199, usage_pct: 45, active_modules: 3, total_modules: 13, months_active: 8, churn_risk_score: 25 },
    { tenant_id: 't3', tenant_name: 'Grupo Gamma', current_plan: 'professional', mrr: 799, usage_pct: 30, active_modules: 5, total_modules: 13, months_active: 12, churn_risk_score: 72 },
  ]), []);
  const deployAssessment = useMemo(() => TenantImpactAnalyzer.assessDeployPreview(), []);

  const healthColor = dashboard.overall_health === 'healthy'
    ? 'text-emerald-500' : dashboard.overall_health === 'degraded'
    ? 'text-amber-500' : 'text-destructive';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            AI Operations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Insight Dashboard — Inteligência Operacional Autônoma
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Saúde:</span>
          <span className={`font-semibold capitalize ${healthColor}`}>{dashboard.overall_health}</span>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Sinais (24h)" value={dashboard.total_signals_24h} icon={Activity} />
        <StatsCard title="Sugestões Pendentes" value={dashboard.pending_suggestions} icon={Brain} />
        <StatsCard title="Riscos Ativos" value={dashboard.active_risks} icon={Shield} />
        <StatsCard title="Otimizações Receita" value={dashboard.revenue_optimizations} icon={TrendingUp} />
      </div>

      {/* Widgets grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AutomationSuggestionsPanel suggestions={suggestions} />
        <RiskPredictionHeatmap risks={risks} />
        <RevenueOptimizationCards optimizations={revenueOpts} />
        <TenantImpactPreview assessment={deployAssessment} />
      </div>
    </div>
  );
}
