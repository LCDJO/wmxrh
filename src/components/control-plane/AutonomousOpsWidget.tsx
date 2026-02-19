/**
 * AutonomousOpsWidget — Control Plane widget for the Autonomous Operations AI Engine.
 * Shows operational health, active patterns, risks, suggestions, and insights at a glance.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Brain, AlertTriangle, Zap, TrendingUp, Activity, Lightbulb,
  RefreshCw, Workflow, ShieldAlert, CheckCircle2, XCircle,
} from 'lucide-react';
import {
  InsightDashboardService,
  AutomationSuggestionEngine,
  BehaviorPatternAnalyzer,
  RiskPredictionService,
} from '@/domains/autonomous-operations';
import type {
  OperationalDashboardState,
  OperationalInsight,
  AutomationSuggestion,
  PredictedRisk,
} from '@/domains/autonomous-operations/types';

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

const PRIORITY_BADGE: Record<string, 'destructive' | 'secondary' | 'outline' | 'default'> = {
  critical: 'destructive',
  high: 'destructive',
  medium: 'secondary',
  low: 'outline',
};

// ── Sub-components ──

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

function SuggestionRow({ suggestion, onAccept, onReject }: {
  suggestion: AutomationSuggestion;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <div className="py-2.5 border-b border-border/30 last:border-0 space-y-1.5">
      <div className="flex items-start gap-2">
        <Workflow className="h-4 w-4 mt-0.5 shrink-0 text-purple-500" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium">{suggestion.title}</span>
            <Badge variant={PRIORITY_BADGE[suggestion.priority] || 'outline'} className="text-[9px] h-4 shrink-0">
              {suggestion.priority}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{suggestion.description}</p>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 italic">
            Impacto: {suggestion.estimated_impact}
          </p>
        </div>
      </div>
      {suggestion.status === 'pending' && (
        <div className="flex gap-1.5 ml-6">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 px-2"
            onClick={() => onAccept(suggestion.id)}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" /> Aceitar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] text-muted-foreground hover:text-red-500 hover:bg-red-500/10 px-2"
            onClick={() => onReject(suggestion.id)}
          >
            <XCircle className="h-3 w-3 mr-1" /> Rejeitar
          </Button>
        </div>
      )}
    </div>
  );
}

function RiskRow({ risk }: { risk: PredictedRisk }) {
  const severity = risk.composite_score >= 60 ? 'critical' : risk.composite_score >= 35 ? 'warning' : 'info';
  return (
    <div className="py-2 border-b border-border/30 last:border-0">
      <div className="flex items-start gap-2">
        <ShieldAlert className={`h-4 w-4 mt-0.5 shrink-0 ${SEVERITY_COLORS[severity]}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium truncate">{risk.title}</span>
            <Badge variant={SEVERITY_BADGE[severity]} className="text-[9px] h-4 shrink-0">
              {risk.composite_score}pts
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{risk.description}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] text-muted-foreground">Prob: {risk.probability}%</span>
            <span className="text-[10px] text-muted-foreground">Impacto: {risk.impact_score}</span>
            <span className="text-[10px] text-muted-foreground">Horizonte: {risk.horizon_hours}h</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Widget ──

export function AutonomousOpsWidget() {
  const [state, setState] = useState<OperationalDashboardState | null>(null);
  const [suggestions, setSuggestions] = useState<AutomationSuggestion[]>([]);
  const [risks, setRisks] = useState<PredictedRisk[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(() => {
    setRefreshing(true);
    const dashboard = InsightDashboardService.buildDashboard();
    setState(dashboard);

    const patterns = BehaviorPatternAnalyzer.analyze(24);
    setSuggestions(AutomationSuggestionEngine.generateAll(patterns));
    setRisks(RiskPredictionService.predictAll(patterns, 24));

    setTimeout(() => setRefreshing(false), 400);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleAccept = (id: string) => {
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status: 'accepted' as const } : s));
  };

  const handleReject = (id: string) => {
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status: 'rejected' as const } : s));
  };

  if (!state) return null;

  const health = HEALTH_MAP[state.overall_health] || HEALTH_MAP.healthy;
  const totalItems = state.active_patterns + state.active_risks + state.pending_suggestions;
  const riskPct = totalItems > 0 ? Math.round((state.active_risks / Math.max(totalItems, 1)) * 100) : 0;
  const pendingSuggestions = suggestions.filter(s => s.status === 'pending');

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            <CardTitle className="text-base">Autonomous Ops AI</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Badge variant="outline" className={`text-xs ${health.color}`}>
              {health.label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metrics row */}
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center">
            <div className="text-lg font-bold">{state.total_signals_24h}</div>
            <div className="text-[10px] text-muted-foreground">Sinais 24h</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold">{state.active_patterns}</div>
            <div className="text-[10px] text-muted-foreground">Padrões</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold">{risks.length}</div>
            <div className="text-[10px] text-muted-foreground">Riscos</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-purple-500">{pendingSuggestions.length}</div>
            <div className="text-[10px] text-muted-foreground">Sugestões</div>
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

        {/* Tabbed content */}
        <Tabs defaultValue="suggestions" className="w-full">
          <TabsList className="w-full h-8 grid grid-cols-3">
            <TabsTrigger value="suggestions" className="text-[11px] h-7 gap-1">
              <Zap className="h-3 w-3" /> Sugestões
              {pendingSuggestions.length > 0 && (
                <Badge variant="destructive" className="text-[8px] h-3.5 px-1 ml-0.5">
                  {pendingSuggestions.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="risks" className="text-[11px] h-7 gap-1">
              <ShieldAlert className="h-3 w-3" /> Riscos
            </TabsTrigger>
            <TabsTrigger value="insights" className="text-[11px] h-7 gap-1">
              <Lightbulb className="h-3 w-3" /> Insights
            </TabsTrigger>
          </TabsList>

          <TabsContent value="suggestions" className="mt-2">
            <ScrollArea className="h-[220px]">
              {suggestions.length > 0 ? (
                <div className="space-y-0">
                  {suggestions.slice(0, 10).map(s => (
                    <SuggestionRow key={s.id} suggestion={s} onAccept={handleAccept} onReject={handleReject} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-xs">
                  Nenhuma sugestão de automação pendente.
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="risks" className="mt-2">
            <ScrollArea className="h-[220px]">
              {risks.length > 0 ? (
                <div className="space-y-0">
                  {risks.sort((a, b) => b.composite_score - a.composite_score).slice(0, 10).map(r => (
                    <RiskRow key={r.id} risk={r} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-xs">
                  Nenhum risco previsto. A plataforma está estável.
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="insights" className="mt-2">
            <ScrollArea className="h-[220px]">
              {state.insights.length > 0 ? (
                <div className="space-y-0">
                  {state.insights.slice(0, 8).map(insight => (
                    <InsightRow key={insight.id} insight={insight} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-xs">
                  Nenhum insight ativo. Operação normal.
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
