/**
 * /platform/marketing/pipeline — Conversion Pipeline Dashboard
 *
 * Visualizes the 7-stage conversion pipeline:
 * Traffic → Page View → CTA Click → Signup → Tenant Created → Plan Activated → Revenue Generated
 */
import { useState, useEffect } from 'react';
import { ArrowDown, Zap, Eye, MousePointerClick, UserPlus, Building2, CreditCard, DollarSign, TrendingUp, AlertTriangle, Brain } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { conversionPipeline, type ConversionPipelineSnapshot, type PipelineStageMetrics } from '@/domains/marketing-digital-os';

const STAGE_ICONS: Record<string, React.ReactNode> = {
  'Tráfego':        <Zap className="h-4 w-4" />,
  'Visualização':   <Eye className="h-4 w-4" />,
  'Clique CTA':     <MousePointerClick className="h-4 w-4" />,
  'Signup':         <UserPlus className="h-4 w-4" />,
  'Tenant Criado':  <Building2 className="h-4 w-4" />,
  'Plano Ativado':  <CreditCard className="h-4 w-4" />,
  'Receita Gerada': <DollarSign className="h-4 w-4" />,
};

const STAGE_COLORS = [
  'bg-blue-500',
  'bg-sky-500',
  'bg-cyan-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-amber-500',
  'bg-green-600',
];

export default function MarketingPipeline() {
  const [snapshots, setSnapshots] = useState<ConversionPipelineSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    conversionPipeline.getAllSnapshots().then(s => {
      setSnapshots(s);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl gradient-platform-surface border border-platform p-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg gradient-platform-accent shadow-platform">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Pipeline de Conversão</h1>
            <p className="text-sm text-muted-foreground">
              Fluxo completo: Tráfego → Visualização → CTA → Signup → Tenant → Plano → Receita.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <Card className="border-border/60">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">Carregando pipeline…</CardContent>
        </Card>
      ) : snapshots.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma Landing Page encontrada. Crie uma para gerar o pipeline de conversão.
          </CardContent>
        </Card>
      ) : (
        snapshots.map(snapshot => (
          <PipelineCard key={snapshot.landingPageId} snapshot={snapshot} />
        ))
      )}
    </div>
  );
}

function PipelineCard({ snapshot }: { snapshot: ConversionPipelineSnapshot }) {
  const maxVolume = Math.max(...snapshot.stages.map(s => s.volume), 1);
  const worstDropoff = snapshot.stages.reduce((worst, s) =>
    s.dropoffPct > worst.dropoffPct ? s : worst, snapshot.stages[0]);

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            {snapshot.pageName}
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px] gap-1">
              <Brain className="h-2.5 w-2.5" />
              AI Score: {snapshot.aiScore}
            </Badge>
            <Badge
              variant={snapshot.riskLevel === 'low' ? 'secondary' : 'destructive'}
              className="text-[10px]"
            >
              Risco: {snapshot.riskLevel}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              Fonte: {snapshot.topSource}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              Receita prev.: R$ {snapshot.predictedRevenue.toLocaleString()}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {/* Visual pipeline stages */}
        <div className="flex flex-col items-center gap-0">
          {snapshot.stages.map((stage, i) => (
            <div key={stage.stage} className="w-full">
              <StageRow stage={stage} index={i} maxVolume={maxVolume} />
              {i < snapshot.stages.length - 1 && (
                <div className="flex flex-col items-center py-1">
                  <ArrowDown className="h-4 w-4 text-muted-foreground/40" />
                  {snapshot.stages[i + 1].dropoffPct > 0 && (
                    <span className={`text-[9px] font-medium ${snapshot.stages[i + 1].dropoffPct > 40 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      -{snapshot.stages[i + 1].dropoffPct}% dropoff
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottleneck alert */}
        {worstDropoff.dropoffPct > 30 && worstDropoff.stage !== snapshot.stages[0].stage && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20 mt-4">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-semibold text-foreground">
                Gargalo: {worstDropoff.stage} ({worstDropoff.dropoffPct}% dropoff)
              </p>
              <p className="text-[10px] text-muted-foreground">
                Considere otimizar esta etapa para melhorar a taxa de conversão geral.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StageRow({ stage, index, maxVolume }: { stage: PipelineStageMetrics; index: number; maxVolume: number }) {
  const widthPct = Math.max((stage.volume / maxVolume) * 100, 8);
  const color = STAGE_COLORS[index] ?? STAGE_COLORS[0];
  const icon = STAGE_ICONS[stage.stage];

  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex items-center gap-1.5 w-28 shrink-0 justify-end">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-[10px] font-medium text-muted-foreground text-right">{stage.stage}</span>
      </div>
      <div className="flex-1 flex items-center">
        <div
          className={`${color} h-7 rounded-md transition-all duration-500 flex items-center justify-end pr-2`}
          style={{ width: `${widthPct}%` }}
        >
          <span className="text-[10px] font-bold text-white drop-shadow-sm">
            {stage.volume.toLocaleString()}
          </span>
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground w-14 text-right shrink-0">
        {index > 0 ? `${stage.conversionRate}%` : '—'}
      </span>
    </div>
  );
}
