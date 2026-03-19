/**
 * PlatformAIOperations — Insight Dashboard for Autonomous Operations AI Engine.
 * Route: /platform/ai-operations
 *
 * Uses real database data via useAIOperationsData hook.
 */

import { Brain, Activity, TrendingUp, Shield, Loader2, RefreshCw } from 'lucide-react';
import { StatsCard } from '@/components/shared/StatsCard';
import { useAIOperationsData } from '@/hooks/platform/useAIOperationsData';
import { AutomationSuggestionsPanel } from '@/components/platform/ai-operations/AutomationSuggestionsPanel';
import { RiskPredictionHeatmap } from '@/components/platform/ai-operations/RiskPredictionHeatmap';
import { RevenueOptimizationCards } from '@/components/platform/ai-operations/RevenueOptimizationCards';
import { TenantImpactPreview } from '@/components/platform/ai-operations/TenantImpactPreview';
import { Button } from '@/components/ui/button';

export default function PlatformAIOperations() {
  const { data, isLoading, isRefetching, refetch } = useAIOperationsData();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Carregando dados da plataforma…</span>
      </div>
    );
  }

  if (!data) return null;

  const { dashboard, suggestions, risks, revenueOpts, deployAssessment } = data;

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
            Insight Dashboard — Dados reais da plataforma
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isRefetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Saúde:</span>
            <span className={`font-semibold capitalize ${healthColor}`}>{dashboard.overall_health}</span>
          </div>
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
