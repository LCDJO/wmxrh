/**
 * AutonomousOpsWidget — Control Plane widget for the Autonomous Operations AI Engine.
 * Shows operational health, active patterns, risks, and suggestions at a glance.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Brain, AlertTriangle, Zap, TrendingUp, Activity, Lightbulb,
} from 'lucide-react';
import { InsightDashboardService } from '@/domains/autonomous-operations';
import type { OperationalDashboardState, OperationalInsight } from '@/domains/autonomous-operations/types';

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-red-500',
  warning: 'text-yellow-500',
  info: 'text-blue-400',
};

const SEVERITY_BADGE: Record<string, 'destructive' | 'secondary' | 'outline'> = {
  critical: 'destructive',
  warning: 'secondary',
  info: 'outline',
};

const HEALTH_MAP: Record<string, { label: string; color: string }> = {
  healthy: { label: 'Saudável', color: 'text-emerald-500' },
  degraded: { label: 'Degradado', color: 'text-yellow-500' },
  critical: { label: 'Crítico', color: 'text-red-500' },
};

function InsightRow({ insight }: { insight: OperationalInsight }) {
  const Icon = insight.category === 'risk' ? AlertTriangle
    : insight.category === 'pattern' ? Activity
    : insight.category === 'optimization' ? TrendingUp
    : Lightbulb;

  return (
    <div className="flex items-start gap-2 py-2 border-b border-border/30 last:border-0">
      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${SEVERITY_COLORS[insight.severity]}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium truncate">{insight.title}</span>
          <Badge variant={SEVERITY_BADGE[insight.severity]} className="text-[9px] h-4 shrink-0">
            {insight.severity}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{insight.summary}</p>
      </div>
    </div>
  );
}

export function AutonomousOpsWidget() {
  const [state, setState] = useState<OperationalDashboardState | null>(null);

  useEffect(() => {
    setState(InsightDashboardService.buildDashboard());
    const interval = setInterval(() => {
      setState(InsightDashboardService.buildDashboard());
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  if (!state) return null;

  const health = HEALTH_MAP[state.overall_health] || HEALTH_MAP.healthy;
  const totalItems = state.active_patterns + state.active_risks + state.pending_suggestions;
  const riskPct = totalItems > 0 ? Math.round((state.active_risks / Math.max(totalItems, 1)) * 100) : 0;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            <CardTitle className="text-base">Autonomous Ops AI</CardTitle>
          </div>
          <Badge variant="outline" className={`text-xs ${health.color}`}>
            {health.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metrics row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="text-lg font-bold">{state.total_signals_24h}</div>
            <div className="text-[10px] text-muted-foreground">Sinais 24h</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold">{state.active_patterns}</div>
            <div className="text-[10px] text-muted-foreground">Padrões</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold">{state.active_risks}</div>
            <div className="text-[10px] text-muted-foreground">Riscos</div>
          </div>
        </div>

        {/* Sub-metrics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs">{state.pending_suggestions} sugestões</span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs">{state.revenue_optimizations} receita</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-xs">{state.workflow_optimizations} workflows</span>
          </div>
        </div>

        {/* Risk gauge */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-muted-foreground">Índice de risco</span>
            <span className="text-[11px] font-medium">{riskPct}%</span>
          </div>
          <Progress value={riskPct} className="h-1.5" />
        </div>

        {/* Insights feed */}
        {state.insights.length > 0 && (
          <ScrollArea className="h-[180px]">
            <div className="space-y-0">
              {state.insights.slice(0, 8).map(insight => (
                <InsightRow key={insight.id} insight={insight} />
              ))}
            </div>
          </ScrollArea>
        )}

        {state.insights.length === 0 && (
          <div className="text-center py-4 text-muted-foreground text-xs">
            Nenhum insight ativo. A plataforma está operando normalmente.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
