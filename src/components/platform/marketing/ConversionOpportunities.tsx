/**
 * ConversionOpportunities — Surfaces pages with highest optimization potential.
 * Combines conversion risk analysis + FAB completeness to rank opportunities.
 */
import { useState, useEffect, useMemo } from 'react';
import { Target, ArrowUpRight, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { landingPageBuilder } from '@/domains/platform-growth';
import { growthAISupportLayer } from '@/domains/platform-growth/growth-ai-support-layer';
import type { LandingPage } from '@/domains/platform-growth/types';

interface Opportunity {
  page: LandingPage;
  score: number;
  riskLevel: string;
  missingFAB: number;
  potentialLift: number;
}

export default function ConversionOpportunities() {
  const [pages, setPages] = useState<LandingPage[]>([]);
  useEffect(() => { landingPageBuilder.getAll().then(setPages); }, []);

  const opportunities = useMemo<Opportunity[]>(() => {
    return pages
      .map(page => {
        const risk = growthAISupportLayer.analyzeConversionRisk(page);
        const fab = growthAISupportLayer.suggestFABStructure(page);
        const potentialLift = Math.max(5, 100 - risk.overallScore);
        return {
          page,
          score: risk.overallScore,
          riskLevel: risk.riskLevel,
          missingFAB: fab.missingElements.length,
          potentialLift,
        };
      })
      .sort((a, b) => a.score - b.score) // worst first = biggest opportunity
      .slice(0, 6);
  }, [pages]);

  const riskColors: Record<string, string> = {
    critical: 'text-destructive',
    high: 'text-orange-400',
    medium: 'text-amber-400',
    low: 'text-emerald-400',
  };

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Oportunidades de Conversão
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {opportunities.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Sem oportunidades detectadas.</p>
        ) : (
          opportunities.map(opp => (
            <div key={opp.page.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/20 border border-border/40">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{opp.page.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={opp.score} className="h-1.5 flex-1" />
                  <span className="text-[10px] text-muted-foreground w-8 text-right">{opp.score}/100</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Badge variant="outline" className={cn('text-[9px]', riskColors[opp.riskLevel])}>
                  {opp.riskLevel}
                </Badge>
                <div className="flex items-center gap-0.5 text-[10px] text-emerald-400">
                  <ArrowUpRight className="h-2.5 w-2.5" />
                  +{opp.potentialLift}% lift
                </div>
              </div>
              {opp.missingFAB > 0 && (
                <div className="flex items-center gap-0.5 text-[9px] text-amber-400 shrink-0">
                  <AlertTriangle className="h-3 w-3" />
                  {opp.missingFAB} FAB
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
