/**
 * AIAdvisorPanel — Unified panel surfacing GrowthAI services:
 *  - headline_suggestions
 *  - FAB optimization
 *  - CTA improvements
 *  - revenue prediction
 *
 * Consumes GrowthAISupportLayer as a transversal service.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sparkles, Type, LayoutGrid, MousePointerClick, TrendingUp,
  ArrowUpRight, AlertTriangle, Lightbulb, Loader2,
} from 'lucide-react';
import {
  growthAISupportLayer,
  type HeadlineSuggestion,
  type FABStructureSuggestion,
  type LayoutChangeSuggestion,
  type RevenueImpactPrediction,
} from '@/domains/marketing-digital-os';
import type { LandingPage } from '@/domains/platform-growth/types';
import { cn } from '@/lib/utils';

interface AIAdvisorPanelProps {
  page: LandingPage;
  className?: string;
}

export function AIAdvisorPanel({ page, className }: AIAdvisorPanelProps) {
  const [headlines, setHeadlines] = useState<HeadlineSuggestion[]>([]);
  const [fabSuggestion, setFabSuggestion] = useState<FABStructureSuggestion | null>(null);
  const [layoutChanges, setLayoutChanges] = useState<LayoutChangeSuggestion[]>([]);
  const [revenuePrediction, setRevenuePrediction] = useState<RevenueImpactPrediction | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const generateHeadlines = () => {
    setLoading('headlines');
    const heroBlock = page.blocks?.find(b => b.type === 'hero');
    const currentHeadline = (heroBlock?.content as Record<string, unknown>)?.headline as string ?? page.name;
    const results = growthAISupportLayer.suggestHeadline(currentHeadline, { pageType: 'landing' });
    setHeadlines(results);
    setLoading(null);
  };

  const generateFAB = () => {
    setLoading('fab');
    const result = growthAISupportLayer.suggestFABStructure(page);
    setFabSuggestion(result);
    setLoading(null);
  };

  const generateCTA = () => {
    setLoading('cta');
    const results = growthAISupportLayer.suggestLayoutChanges(page);
    setLayoutChanges(results.filter(s => s.area === 'cta' || s.area === 'hero'));
    setLoading(null);
  };

  const generateRevenue = async () => {
    setLoading('revenue');
    const result = await growthAISupportLayer.predictRevenueImpact(page.id, page);
    setRevenuePrediction(result);
    setLoading(null);
  };

  return (
    <Card className={cn('border-primary/20', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">Growth AI Advisor</CardTitle>
            <p className="text-[11px] text-muted-foreground">Inteligência transversal de otimização</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="headlines" className="space-y-3">
          <TabsList className="grid w-full grid-cols-4 h-8">
            <TabsTrigger value="headlines" className="text-[10px] gap-1">
              <Type className="h-3 w-3" />Headlines
            </TabsTrigger>
            <TabsTrigger value="fab" className="text-[10px] gap-1">
              <LayoutGrid className="h-3 w-3" />FAB
            </TabsTrigger>
            <TabsTrigger value="cta" className="text-[10px] gap-1">
              <MousePointerClick className="h-3 w-3" />CTA
            </TabsTrigger>
            <TabsTrigger value="revenue" className="text-[10px] gap-1">
              <TrendingUp className="h-3 w-3" />Receita
            </TabsTrigger>
          </TabsList>

          {/* Headlines */}
          <TabsContent value="headlines" className="space-y-2">
            <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={generateHeadlines} disabled={loading === 'headlines'}>
              {loading === 'headlines' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
              Gerar sugestões de headline
            </Button>
            {headlines.map(h => (
              <div key={h.id} className="rounded-md border border-border/50 p-2.5 space-y-1">
                <p className="text-xs font-medium text-card-foreground leading-snug">"{h.variant}"</p>
                <p className="text-[10px] text-muted-foreground">{h.rationale}</p>
                <div className="flex gap-1.5">
                  <Badge variant="secondary" className="text-[9px]">
                    <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />+{h.expectedLiftPct}% lift
                  </Badge>
                  <Badge variant="outline" className="text-[9px]">{h.confidence}% confiança</Badge>
                </div>
              </div>
            ))}
          </TabsContent>

          {/* FAB Optimization */}
          <TabsContent value="fab" className="space-y-2">
            <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={generateFAB} disabled={loading === 'fab'}>
              {loading === 'fab' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <LayoutGrid className="h-3 w-3 mr-1" />}
              Analisar estrutura FAB
            </Button>
            {fabSuggestion && (
              <div className="rounded-md border border-border/50 p-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant={fabSuggestion.expectedImpact === 'high' ? 'destructive' : 'secondary'} className="text-[9px]">
                    Impacto: {fabSuggestion.expectedImpact}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{fabSuggestion.currentBlockCount} blocos atuais</span>
                </div>
                <p className="text-[11px] text-card-foreground">{fabSuggestion.rationale}</p>
                {fabSuggestion.missingElements.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />Elementos ausentes:
                    </p>
                    {fabSuggestion.missingElements.map((el, i) => (
                      <p key={i} className="text-[10px] text-muted-foreground pl-4">• {el}</p>
                    ))}
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-medium text-card-foreground mb-1">Ordem sugerida:</p>
                  <div className="flex flex-wrap gap-1">
                    {fabSuggestion.suggestedOrder.map((s, i) => (
                      <Badge key={i} variant="outline" className="text-[9px]">{i + 1}. {s}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* CTA Improvements */}
          <TabsContent value="cta" className="space-y-2">
            <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={generateCTA} disabled={loading === 'cta'}>
              {loading === 'cta' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <MousePointerClick className="h-3 w-3 mr-1" />}
              Sugerir melhorias de CTA
            </Button>
            {layoutChanges.length > 0 && layoutChanges.map(lc => (
              <div key={lc.id} className="rounded-md border border-border/50 p-2.5 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Lightbulb className="h-3 w-3 text-primary" />
                  <p className="text-xs font-medium text-card-foreground">{lc.title}</p>
                </div>
                <p className="text-[10px] text-muted-foreground">{lc.description}</p>
                <div className="flex gap-1.5">
                  <Badge variant={lc.priority === 'high' ? 'destructive' : 'secondary'} className="text-[9px]">
                    {lc.priority}
                  </Badge>
                  <Badge variant="outline" className="text-[9px]">+{lc.expectedLiftPct}% lift</Badge>
                </div>
              </div>
            ))}
          </TabsContent>

          {/* Revenue Prediction */}
          <TabsContent value="revenue" className="space-y-2">
            <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={generateRevenue} disabled={loading === 'revenue'}>
              {loading === 'revenue' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <TrendingUp className="h-3 w-3 mr-1" />}
              Prever impacto na receita
            </Button>
            {revenuePrediction && (
              <div className="rounded-md border border-border/50 p-2.5 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-2 rounded bg-muted/30">
                    <p className="text-[10px] text-muted-foreground">MRR Atual</p>
                    <p className="text-sm font-bold text-card-foreground">R$ {revenuePrediction.currentMRR.toLocaleString()}</p>
                  </div>
                  <div className="text-center p-2 rounded bg-primary/5">
                    <p className="text-[10px] text-muted-foreground">Projeção ΔΑ</p>
                    <p className={cn('text-sm font-bold', revenuePrediction.projectedMRRChange > 0 ? 'text-success' : 'text-destructive')}>
                      {revenuePrediction.projectedMRRChange > 0 ? '+' : ''}R$ {revenuePrediction.projectedMRRChange.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <div>
                    <p className="text-[9px] text-muted-foreground">Churn ↓</p>
                    <p className="text-xs font-semibold text-card-foreground">{revenuePrediction.churnRiskReduction}%</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground">Upgrade</p>
                    <p className="text-xs font-semibold text-card-foreground">R$ {revenuePrediction.upgradePotentialBRL.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground">Confiança</p>
                    <p className="text-xs font-semibold text-card-foreground">{revenuePrediction.confidenceLevel}%</p>
                  </div>
                </div>
                {revenuePrediction.factors.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-border/30">
                    {revenuePrediction.factors.map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground">{f.factor}</span>
                        <Badge variant="outline" className={cn('text-[8px]',
                          f.impact === 'positive' ? 'border-success/30 text-success' :
                          f.impact === 'negative' ? 'border-destructive/30 text-destructive' :
                          'border-border text-muted-foreground'
                        )}>
                          {f.impact} ({Math.round(f.weight * 100)}%)
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
