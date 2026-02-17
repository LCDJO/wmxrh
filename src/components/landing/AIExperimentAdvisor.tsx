/**
 * AIExperimentAdvisor — Panel for Landing Page editor.
 * Suggests A/B variants and analyzes conversion risk before approval.
 * Powered by GrowthAISupportLayer + AIConversionDesigner.
 */
import { useMemo } from 'react';
import {
  FlaskConical,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { growthAISupportLayer } from '@/domains/platform-growth/growth-ai-support-layer';
import { aiConversionDesigner } from '@/domains/platform-growth/ai-conversion-designer';
import type { LandingPage } from '@/domains/platform-growth/types';

interface AIExperimentAdvisorProps {
  page: LandingPage;
}

export function AIExperimentAdvisor({ page }: AIExperimentAdvisorProps) {
  const risk = useMemo(() => growthAISupportLayer.analyzeConversionRisk(page), [page]);

  const abProposals = useMemo(() => {
    return (['hero', 'cta', 'benefits'] as const).map(area => aiConversionDesigner.proposeABTest(page.id, area));
  }, [page.id]);

  const riskColorMap: Record<string, string> = {
    critical: 'text-destructive',
    high: 'text-destructive',
    medium: 'text-warning',
    low: 'text-success',
  };

  const riskBgMap: Record<string, string> = {
    critical: 'bg-destructive/10 border-destructive/30',
    high: 'bg-destructive/10 border-destructive/30',
    medium: 'bg-warning/10 border-warning/30',
    low: 'bg-success/10 border-success/30',
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" />
          AI Experiment Advisor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Risk Assessment */}
        <div className={`rounded-lg border p-3 ${riskBgMap[risk.riskLevel]}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <ShieldAlert className={`h-3.5 w-3.5 ${riskColorMap[risk.riskLevel]}`} />
              <span className="text-xs font-semibold text-foreground">Risco de Conversão</span>
            </div>
            <Badge variant="outline" className={`text-[10px] ${riskColorMap[risk.riskLevel]}`}>
              {risk.riskLevel.toUpperCase()} • {risk.grade}
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground mb-2">{risk.recommendation}</p>

          {risk.risks.length > 0 && (
            <div className="space-y-1">
              {risk.risks.slice(0, 3).map((r, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <AlertTriangle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground">{r.description}</p>
                </div>
              ))}
            </div>
          )}

          {risk.funnelDropoffs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {risk.funnelDropoffs.map((d, i) => (
                <Badge key={i} variant="outline" className="text-[9px]">
                  {d.stage}: {d.rate}% drop
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* A/B Variant Suggestions */}
        <div>
          <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <Lightbulb className="h-3.5 w-3.5 text-primary" />
            Variantes A/B Sugeridas
          </p>
          <div className="space-y-2">
            {abProposals.map(proposal => (
              <div
                key={proposal.id}
                className="rounded-lg border border-border/50 bg-muted/20 p-2.5"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold text-foreground capitalize">
                    Teste: {proposal.changes.area}
                  </span>
                  <Badge variant="secondary" className="text-[9px]">
                    +{proposal.expectedLift}% lift
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>Variante {proposal.variant}</span>
                  <ArrowRight className="h-2.5 w-2.5" />
                  <span>{proposal.durationDays} dias</span>
                  <span>•</span>
                  <span className="capitalize">{proposal.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Score breakdown */}
        <div className="pt-1 border-t border-border/40">
          <p className="text-[10px] text-muted-foreground">
            Score geral: <span className="font-semibold text-foreground">{risk.overallScore}/100</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
