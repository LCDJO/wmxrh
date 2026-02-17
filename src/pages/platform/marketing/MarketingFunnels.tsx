/**
 * /platform/marketing/funnels — Acquisition Funnels Dashboard
 *
 * Visualizes end-to-end acquisition funnels powered by FunnelOrchestrator.
 */
import { useState, useEffect } from 'react';
import { Filter, TrendingDown, ArrowRight, BarChart3, AlertTriangle, Globe, FileText, FlaskConical, Share2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { funnelOrchestrator, type MarketingFunnel, type FunnelHealth } from '@/domains/marketing-digital-os';

export default function MarketingFunnels() {
  const [funnels, setFunnels] = useState<MarketingFunnel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    funnelOrchestrator.buildAllFunnels().then(f => {
      setFunnels(f);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl gradient-platform-surface border border-platform p-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg gradient-platform-accent shadow-platform">
            <Filter className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Funis de Aquisição</h1>
            <p className="text-sm text-muted-foreground">
              Visualize o fluxo completo: tráfego → signup → trial → conversão → receita.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <Card className="border-border/60">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">Carregando funis…</CardContent>
        </Card>
      ) : funnels.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhum funil disponível. Crie Landing Pages para gerar funis automaticamente.</CardContent>
        </Card>
      ) : (
        funnels.map(funnel => {
          const health = funnelOrchestrator.analyzeFunnelHealth(funnel);
          return <FunnelCard key={funnel.id} funnel={funnel} health={health} />;
        })
      )}
    </div>
  );
}

function FunnelCard({ funnel, health }: { funnel: MarketingFunnel; health: FunnelHealth }) {
  const maxCount = Math.max(...funnel.stages.map(s => s.count), 1);

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            {funnel.name}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {funnel.overallConversionRate}% conversão geral
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              R$ {funnel.totalRevenue.toLocaleString()}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metadata row */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-[10px] gap-1">
            {funnel.entryPoint === 'website' ? <Globe className="h-2.5 w-2.5" /> : <FileText className="h-2.5 w-2.5" />}
            {funnel.entryPoint === 'website' ? 'Website' : 'Landing Page'}
          </Badge>
          {funnel.targetPlan && (
            <Badge variant="secondary" className="text-[10px]">Plano: {funnel.targetPlan}</Badge>
          )}
          {funnel.referralProgramId && (
            <Badge variant="secondary" className="text-[10px] gap-1">
              <Share2 className="h-2.5 w-2.5" />Referral
            </Badge>
          )}
          {funnel.activeExperiments.length > 0 && (
            <Badge variant="secondary" className="text-[10px] gap-1">
              <FlaskConical className="h-2.5 w-2.5" />{funnel.activeExperiments.length} experimento(s)
            </Badge>
          )}
        </div>

        {/* Funnel stages */}
        <div className="space-y-2">
          {funnel.stages.map((stage, i) => (
            <div key={stage.id} className="flex items-center gap-3">
              <span className="text-[10px] text-muted-foreground w-20 text-right shrink-0">{stage.name}</span>
              <div className="flex-1">
                <Progress value={(stage.count / maxCount) * 100} className="h-5" />
              </div>
              <span className="text-xs font-bold text-foreground w-14 text-right">{stage.count.toLocaleString()}</span>
              {i > 0 && (
                <span className={`text-[10px] w-12 text-right ${stage.conversionFromPrevious < 30 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {stage.conversionFromPrevious}%
                </span>
              )}
              {i < funnel.stages.length - 1 && (
                <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0 hidden md:block" />
              )}
            </div>
          ))}
        </div>

        {/* Health alert */}
        {health.dropoffRate > 50 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-semibold text-foreground">
                Gargalo: {health.weakestStage} ({Math.round(health.dropoffRate)}% dropoff)
              </p>
              <p className="text-[10px] text-muted-foreground">{health.recommendation}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
