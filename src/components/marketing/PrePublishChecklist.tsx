/**
 * <PrePublishChecklist /> — Visual 4-pillar compliance checklist.
 *
 * Displays FAB, SEO, GTM, and Mobile validation status
 * before publishing a Landing Page or Website.
 */
import { ShieldCheck, ShieldAlert, CheckCircle2, XCircle, AlertTriangle, Search, Tag, Smartphone, LayoutList } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { MDOSComplianceResult, PillarResult, CompliancePillar } from '@/domains/marketing-digital-os';

const PILLAR_ICONS: Record<CompliancePillar, React.ReactNode> = {
  fab: <LayoutList className="h-4 w-4" />,
  seo: <Search className="h-4 w-4" />,
  gtm: <Tag className="h-4 w-4" />,
  mobile: <Smartphone className="h-4 w-4" />,
};

interface Props {
  result: MDOSComplianceResult;
}

export function PrePublishChecklist({ result }: Props) {
  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            {result.passed
              ? <ShieldCheck className="h-4 w-4 text-emerald-500" />
              : <ShieldAlert className="h-4 w-4 text-destructive" />
            }
            Checklist Pré-Publicação
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge
              variant={result.passed ? 'secondary' : 'destructive'}
              className="text-[10px]"
            >
              {result.passed ? 'Aprovado' : `${result.criticalCount} bloqueio(s)`}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              Score: {result.overallScore}/100
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              Risco: {result.conversionRiskLevel}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {result.pillars.map(pillar => (
            <PillarSummaryCard key={pillar.pillar} pillar={pillar} />
          ))}
        </div>

        {/* Detailed accordion */}
        <Accordion type="multiple" className="w-full">
          {result.pillars.map(pillar => (
            <AccordionItem key={pillar.pillar} value={pillar.pillar}>
              <AccordionTrigger className="text-xs hover:no-underline py-2">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{PILLAR_ICONS[pillar.pillar]}</span>
                  <span className="font-medium">{pillar.label}</span>
                  {pillar.passed
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    : <XCircle className="h-3.5 w-3.5 text-destructive" />
                  }
                  {pillar.issues.length > 0 && (
                    <Badge variant="outline" className="text-[9px] ml-1">
                      {pillar.issues.length} issue(s)
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {pillar.issues.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground py-2">
                    ✓ Nenhum problema encontrado neste pilar.
                  </p>
                ) : (
                  <div className="space-y-2 py-1">
                    {pillar.issues.map((issue, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-2 p-2 rounded-md text-[10px] ${
                          issue.severity === 'blocking'
                            ? 'bg-destructive/5 border border-destructive/20'
                            : 'bg-amber-500/5 border border-amber-500/20'
                        }`}
                      >
                        {issue.severity === 'blocking'
                          ? <XCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                          : <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                        }
                        <div>
                          <p className="font-semibold text-foreground">{issue.title}</p>
                          <p className="text-muted-foreground">{issue.description}</p>
                          {issue.suggestion && (
                            <p className="text-primary mt-0.5">💡 {issue.suggestion}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

function PillarSummaryCard({ pillar }: { pillar: PillarResult }) {
  return (
    <div className="rounded-lg border border-border/60 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{PILLAR_ICONS[pillar.pillar]}</span>
        <span className="text-[10px] font-semibold text-foreground">{pillar.label}</span>
      </div>
      <Progress
        value={pillar.score}
        className={`h-1.5 ${pillar.passed ? '' : '[&>div]:bg-destructive'}`}
      />
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-muted-foreground">{pillar.score}/100</span>
        {pillar.passed
          ? <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          : <XCircle className="h-3 w-3 text-destructive" />
        }
      </div>
    </div>
  );
}
