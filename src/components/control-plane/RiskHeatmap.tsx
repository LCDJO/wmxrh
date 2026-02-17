/**
 * RiskHeatmap — Visual risk score breakdown across domains.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Shield, Users, Cpu, Brain, Activity,
  TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import type { PlatformStateSnapshot, RiskSummary } from '@/domains/control-plane/types';

function RiskCell({ label, score, icon, maxScore = 100 }: { label: string; score: number; icon: React.ReactNode; maxScore?: number }) {
  const pct = Math.min(100, (score / maxScore) * 100);
  const bg = pct > 75 ? 'bg-destructive/20 border-destructive/40' : pct > 50 ? 'bg-orange-500/15 border-orange-500/40' : pct > 25 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-emerald-500/10 border-emerald-500/30';
  const textColor = pct > 75 ? 'text-destructive' : pct > 50 ? 'text-orange-500' : pct > 25 ? 'text-amber-500' : 'text-emerald-500';

  return (
    <div className={`rounded-lg border p-3 ${bg} transition-colors`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="text-muted-foreground">{icon}</div>
        <span className="text-xs font-medium text-foreground truncate">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${textColor}`}>{score}</div>
      <Progress value={pct} className="h-1 mt-2" />
    </div>
  );
}

interface RiskHeatmapProps {
  state: PlatformStateSnapshot | null;
  risk: RiskSummary | null;
}

export function RiskHeatmap({ state, risk }: RiskHeatmapProps) {
  if (!state || !risk) return null;

  const trendIcon = risk.trend === 'improving'
    ? <TrendingDown className="h-4 w-4 text-emerald-500" />
    : risk.trend === 'worsening'
    ? <TrendingUp className="h-4 w-4 text-destructive" />
    : <Minus className="h-4 w-4 text-muted-foreground" />;

  const trendLabel = risk.trend === 'improving' ? 'Melhorando' : risk.trend === 'worsening' ? 'Piorando' : 'Estável';

  // Compute per-domain risk scores
  const identityRisk = Math.min(100, (state.active_impersonations * 30) + (state.unified_graph.high_risk_users * 20));
  const governanceRisk = Math.min(100, (state.governance.critical_insights * 30) + (state.governance.warning_insights * 10));
  const selfHealingRisk = Math.min(100, (state.self_healing.active_incidents * 25) + (state.self_healing.open_circuit_breakers * 15));
  const moduleRisk = state.total_modules > 0 ? Math.round((state.error_modules / state.total_modules) * 100) : 0;
  const graphRisk = Math.min(100, state.unified_graph.risk_signals_count * 15);

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" /> Mapa de Risco
        </CardTitle>
        <div className="flex items-center gap-2">
          {trendIcon}
          <span className="text-xs text-muted-foreground">{trendLabel}</span>
          <Badge variant={risk.level === 'critical' || risk.level === 'high' ? 'destructive' : 'secondary'} className="text-[10px]">
            {risk.level.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Overall score */}
        <div className="text-center mb-4">
          <div className={`text-5xl font-bold ${
            state.overall_risk_score > 75 ? 'text-destructive' :
            state.overall_risk_score > 50 ? 'text-orange-500' :
            state.overall_risk_score > 25 ? 'text-amber-500' :
            'text-emerald-500'
          }`}>
            {state.overall_risk_score}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Score Agregado</div>
        </div>

        {/* Heatmap grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <RiskCell label="Identidade" score={identityRisk} icon={<Users className="h-3.5 w-3.5" />} />
          <RiskCell label="Governança" score={governanceRisk} icon={<Brain className="h-3.5 w-3.5" />} />
          <RiskCell label="Self-Healing" score={selfHealingRisk} icon={<Activity className="h-3.5 w-3.5" />} />
          <RiskCell label="Módulos" score={moduleRisk} icon={<Cpu className="h-3.5 w-3.5" />} />
          <RiskCell label="Grafo UGE" score={graphRisk} icon={<Shield className="h-3.5 w-3.5" />} />
        </div>

        {/* Top risks */}
        {risk.top_risks.length > 0 && (
          <div className="mt-4 space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">Principais Riscos</div>
            {risk.top_risks.slice(0, 3).map(item => (
              <div key={item.id} className="flex items-center justify-between gap-2 text-xs p-2 rounded border border-border/50">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Badge variant="outline" className="text-[9px] shrink-0">{item.category}</Badge>
                  <span className="truncate">{item.title}</span>
                </div>
                <span className={`font-bold shrink-0 ${item.score > 60 ? 'text-destructive' : item.score > 30 ? 'text-amber-500' : 'text-emerald-500'}`}>
                  {item.score}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
