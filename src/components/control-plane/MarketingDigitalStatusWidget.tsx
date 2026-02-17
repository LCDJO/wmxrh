/**
 * MarketingDigitalStatusWidget — Control Plane widget showing:
 * - Active experiments
 * - Pages at risk of performance decline
 * - Automatic AI suggestions
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FlaskConical, AlertTriangle, Lightbulb, TrendingDown, Activity, Clock,
  ArrowUpRight, CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { abTestingManager } from '@/domains/platform-growth/autonomous-marketing/ab-testing-manager';
import { landingPerformanceRanker } from '@/domains/platform-growth/autonomous-marketing/landing-performance-ranker';
import { aiExperimentAdvisor } from '@/domains/platform-growth/autonomous-marketing/ai-experiment-advisor';
import type { LandingPage } from '@/domains/platform-growth/types';

interface AtRiskPage {
  id: string;
  name: string;
  score: number;
  mainIssue: string;
}

interface AISuggestion {
  id: string;
  title: string;
  expectedLift: string;
  type: 'headline' | 'experiment' | 'layout';
}

interface ActiveExp {
  id: string;
  name: string;
  variants: number;
  daysRunning: number;
  hasSignificance: boolean;
}

export function MarketingDigitalStatusWidget() {
  const [experiments, setExperiments] = useState<ActiveExp[]>([]);
  const [atRisk, setAtRisk] = useState<AtRiskPage[]>([]);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Fetch landing pages for analysis
      const { data: pagesRaw } = await supabase
        .from('landing_pages')
        .select('id, name, slug, status, analytics, blocks, created_at, updated_at, published_at')
        .in('status', ['published', 'approved', 'draft'])
        .limit(50);

      const pages: LandingPage[] = ((pagesRaw ?? []) as any[]).map(p => {
        const analytics = (p.analytics ?? {}) as Record<string, number>;
        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          status: p.status as LandingPage['status'],
          blocks: (p.blocks ?? []) as LandingPage['blocks'],
          analytics: {
            views: analytics.views ?? 0,
            uniqueVisitors: analytics.uniqueVisitors ?? 0,
            conversions: analytics.conversions ?? 0,
            conversionRate: analytics.conversionRate ?? 0,
            avgTimeOnPage: analytics.avgTimeOnPage ?? 0,
            bounceRate: analytics.bounceRate ?? 0,
            topSources: (analytics as any).topSources ?? [],
          },
          created_at: p.created_at,
          updated_at: p.updated_at,
          published_at: p.published_at,
        };
      });

      // Active experiments
      const running = abTestingManager.listByStatus('running');
      const exps: ActiveExp[] = running.map(e => {
        const daysDiff = e.startedAt
          ? Math.floor((Date.now() - new Date(e.startedAt).getTime()) / 86400000)
          : 0;
        return {
          id: e.id,
          name: e.name,
          variants: e.variants.length,
          daysRunning: daysDiff,
          hasSignificance: abTestingManager.hasReachedSignificance(e.id),
        };
      });
      setExperiments(exps);

      // Pages at risk
      const scores = landingPerformanceRanker.rank(pages);
      const risky = scores
        .filter(s => s.overallScore < 50)
        .sort((a, b) => a.overallScore - b.overallScore)
        .slice(0, 5)
        .map(s => {
          // Use the individual score dimensions to find the weakest area
          const dims: Record<string, number> = {
            conversion: s.conversionScore,
            engagement: s.engagementScore,
            revenue: s.revenueScore,
            seo: s.seoScore,
          };
          const weakest = Object.entries(dims).sort(([, a], [, b]) => a - b)[0];
          return {
            id: s.landingPageId,
            name: s.pageName,
            score: s.overallScore,
            mainIssue: weakest ? `${weakest[0]}: ${weakest[1]}/100` : 'Score baixo',
          };
        });
      setAtRisk(risky);

      // AI suggestions
      const advisorSuggestions = aiExperimentAdvisor.analyzeRunningExperiments();
      const mapped: AISuggestion[] = advisorSuggestions.slice(0, 5).map((s, i) => ({
        id: `sug-${i}`,
        title: s.title,
        expectedLift: `+${s.predictedLift}%`,
        type: s.type === 'new_experiment' ? 'experiment' : s.type === 'scale_winner' ? 'layout' : 'headline',
      }));

      // Add fallback suggestions if none from advisor
      if (mapped.length === 0 && pages.length > 0) {
        const lowConv = pages.filter(p => p.analytics.conversionRate < 2 && p.analytics.views > 10);
        for (const p of lowConv.slice(0, 3)) {
          mapped.push({
            id: `auto-${p.id}`,
            title: `Otimizar "${p.name}" — conversão ${p.analytics.conversionRate}% está abaixo do benchmark`,
            expectedLift: '+15-25%',
            type: 'headline',
          });
        }
      }
      setSuggestions(mapped);
    } catch (e) {
      console.error('[MarketingDigitalStatusWidget]', e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="h-48" />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Marketing Digital Status
          </CardTitle>
          <Badge variant="outline" className="text-[10px]">
            {experiments.length} exp. · {atRisk.length} riscos · {suggestions.length} sugestões
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Visão consolidada de experimentos, riscos e oportunidades de marketing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Active Experiments */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <FlaskConical className="h-3 w-3" /> Experimentos Ativos
          </h4>
          {experiments.length === 0 ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
              <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">Nenhum experimento em execução</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {experiments.map(exp => (
                <div key={exp.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                  <FlaskConical className={`h-3.5 w-3.5 shrink-0 ${exp.hasSignificance ? 'text-emerald-500' : 'text-primary'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{exp.name}</div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                      {exp.variants} variantes
                      <span>·</span>
                      <Clock className="h-2.5 w-2.5" />
                      {exp.daysRunning}d
                    </div>
                  </div>
                  {exp.hasSignificance && (
                    <Badge variant="default" className="text-[9px] h-4 bg-emerald-500/20 text-emerald-600 border-emerald-500/30">
                      Significante
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pages at Risk */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <TrendingDown className="h-3 w-3" /> Páginas com Risco de Queda
          </h4>
          {atRisk.length === 0 ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
              <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">Todas as páginas com score saudável</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {atRisk.map(page => (
                <div key={page.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                  <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${page.score < 30 ? 'text-destructive' : 'text-amber-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{page.name}</div>
                    <div className="text-[10px] text-muted-foreground">{page.mainIssue}</div>
                  </div>
                  <Badge
                    variant={page.score < 30 ? 'destructive' : 'secondary'}
                    className="text-[9px] h-4 shrink-0"
                  >
                    {page.score}/100
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Suggestions */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Lightbulb className="h-3 w-3" /> Sugestões Automáticas
          </h4>
          {suggestions.length === 0 ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
              <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">Sem sugestões no momento</span>
            </div>
          ) : (
            <ScrollArea className={suggestions.length > 3 ? 'h-[140px]' : ''}>
              <div className="space-y-1.5">
                {suggestions.map(sug => (
                  <div key={sug.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                    <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{sug.title}</div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <ArrowUpRight className="h-2.5 w-2.5 text-emerald-500" />
                        Lift esperado: {sug.expectedLift}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[9px] h-4 shrink-0">
                      {sug.type}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
