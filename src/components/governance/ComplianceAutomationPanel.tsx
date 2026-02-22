/**
 * ComplianceAutomationPanel — Evaluates compliance rules and shows violations.
 *
 * Features:
 * - Run full compliance evaluation
 * - View rule status with pass/fail indicators
 * - AI-powered remediation suggestions
 * - Compliance score gauge
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck, Play, AlertCircle, CheckCircle2, XCircle,
  Loader2, ChevronDown, ChevronRight, Sparkles, Settings2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import {
  evaluateCompliance,
  fetchComplianceRules,
  seedBuiltInRules,
} from '@/domains/governance';
import type { ComplianceReport, ComplianceRule } from '@/domains/governance';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  tenantId: string;
  className?: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  critical: 'bg-red-500/10 text-red-400 border-red-500/30',
};

export function ComplianceAutomationPanel({ tenantId, className }: Props) {
  const queryClient = useQueryClient();
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [analyzingAI, setAnalyzingAI] = useState(false);

  const { data: rules, isLoading: loadingRules } = useQuery({
    queryKey: ['compliance-rules', tenantId],
    queryFn: () => fetchComplianceRules(tenantId),
  });

  const seedMutation = useMutation({
    mutationFn: () => seedBuiltInRules(tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-rules', tenantId] });
      toast.success('Regras padrão instaladas.');
    },
  });

  const evaluateMutation = useMutation({
    mutationFn: () => evaluateCompliance(tenantId),
    onSuccess: (data) => {
      setReport(data);
      toast.success(`Compliance avaliado: ${data.overall_score}/100`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleAIAnalysis = async () => {
    if (!report) return;
    setAnalyzingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('governance-ai', {
        body: { action: 'analyze_compliance', tenant_id: tenantId, compliance_data: report },
      });
      if (error) throw error;
      setAiAnalysis(data?.analysis);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha na análise AI.');
    } finally {
      setAnalyzingAI(false);
    }
  };

  const scoreColor = report
    ? report.overall_score >= 80 ? 'text-green-400'
    : report.overall_score >= 50 ? 'text-yellow-400'
    : 'text-red-400'
    : '';

  return (
    <div className={`space-y-4 ${className ?? ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Compliance Automation</h2>
        </div>
        <div className="flex gap-2">
          {(!rules || rules.length === 0) && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
            >
              <Settings2 className="h-3.5 w-3.5" />
              Instalar Regras
            </Button>
          )}
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => evaluateMutation.mutate()}
            disabled={evaluateMutation.isPending || !rules || rules.length === 0}
          >
            {evaluateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Avaliar Compliance
          </Button>
        </div>
      </div>

      {/* Score Card */}
      {report && (
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Score de Compliance</p>
                <p className={`text-3xl font-bold ${scoreColor}`}>{report.overall_score}</p>
              </div>
              <div className="text-right text-xs space-y-0.5">
                <p className="text-green-400">✓ {report.passed_count} aprovadas</p>
                <p className="text-red-400">✗ {report.failed_count} falhas</p>
                {report.critical_violations > 0 && (
                  <p className="text-red-400 font-medium">⚠ {report.critical_violations} críticas</p>
                )}
              </div>
            </div>
            <Progress value={report.overall_score} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Evaluation Results */}
      {report && report.evaluations.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Resultados da Avaliação</CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={handleAIAnalysis}
                disabled={analyzingAI}
              >
                {analyzingAI ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Análise AI
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-80">
              <div className="space-y-2">
                {report.evaluations.map((evaluation) => (
                  <EvaluationCard key={evaluation.id} evaluation={evaluation} rules={rules ?? []} />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* AI Analysis */}
      {aiAnalysis && (
        <Card className="border-border/50 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              Análise AI — Compliance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">{aiAnalysis.summary}</p>

            {aiAnalysis.priority_actions?.map((action: any, i: number) => (
              <div key={i} className="flex items-start gap-2 text-xs p-2 rounded bg-muted/20">
                <Badge variant="outline" className={`text-[8px] px-1 shrink-0 ${SEVERITY_COLORS[action.severity] ?? ''}`}>
                  {action.severity}
                </Badge>
                <div>
                  <p className="font-medium">{action.action}</p>
                  <p className="text-muted-foreground text-[10px] mt-0.5">{action.description}</p>
                  <p className="text-[10px] text-primary mt-0.5">Impacto: {action.estimated_impact}</p>
                </div>
              </div>
            ))}

            <p className="text-[10px] text-muted-foreground border-l-2 border-primary/30 pl-2">
              {aiAnalysis.risk_assessment}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Rules List */}
      {rules && rules.length > 0 && !report && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{rules.length} Regras Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {rules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/10">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[8px] px-1 ${SEVERITY_COLORS[rule.severity]}`}>
                      {rule.severity}
                    </Badge>
                    <span>{rule.name}</span>
                  </div>
                  <span className="text-muted-foreground text-[10px]">{rule.category}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {loadingRules && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

function EvaluationCard({
  evaluation,
  rules,
}: {
  evaluation: any;
  rules: ComplianceRule[];
}) {
  const [open, setOpen] = useState(false);
  const rule = rules.find(r => r.id === evaluation.rule_id);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-border/50 bg-card/50">
        <CollapsibleTrigger className="flex items-center gap-2 w-full p-2.5 text-left hover:bg-muted/20 transition-colors rounded-lg">
          {open ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
          {evaluation.passed
            ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
            : <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />}
          <span className="text-xs font-medium flex-1">{rule?.name ?? evaluation.rule_id}</span>
          {!evaluation.passed && (
            <Badge variant="outline" className="text-[8px] px-1 bg-red-500/10 text-red-400">
              {evaluation.violation_count} violação(ões)
            </Badge>
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-2.5 pb-2.5 space-y-1.5">
            {evaluation.violations?.map((v: any, i: number) => (
              <div key={i} className="text-[10px] text-muted-foreground pl-7">
                <AlertCircle className="h-2.5 w-2.5 inline mr-1 text-amber-400" />
                {v.description}
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
