/**
 * PlatformGovernanceAI — Governance AI Dashboard.
 *
 * Hybrid: local heuristic scan + AI deep analysis.
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { getGovernanceAIService } from '@/domains/governance-ai';
import type { GovernanceInsight, GovernanceAIResponse, InsightSeverity } from '@/domains/governance-ai/types';
import {
  Brain, Scan, Shield, AlertTriangle, ChevronRight,
  Sparkles, TrendingDown, TrendingUp, Minus, Loader2,
  CheckCircle2, XCircle, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const severityConfig: Record<InsightSeverity, { label: string; color: string; icon: typeof AlertTriangle }> = {
  critical: { label: 'Crítico', color: 'bg-destructive text-destructive-foreground', icon: XCircle },
  warning: { label: 'Alerta', color: 'bg-[hsl(38_92%_50%)]/10 text-[hsl(38_92%_40%)]', icon: AlertTriangle },
  info: { label: 'Info', color: 'bg-primary/10 text-primary', icon: Info },
};

export default function PlatformGovernanceAI() {
  const service = getGovernanceAIService();
  const { toast } = useToast();
  const [insights, setInsights] = useState<GovernanceInsight[]>([]);
  const [aiResponse, setAIResponse] = useState<GovernanceAIResponse | null>(null);
  const [scanning, setScanning] = useState(false);
  const [aiLoading, setAILoading] = useState(false);

  useEffect(() => {
    const unsub = service.subscribe(state => {
      setInsights(state.insights);
      setAIResponse(state.ai_analysis);
      setScanning(state.scanning);
      setAILoading(state.ai_loading);
    });
    return unsub;
  }, [service]);

  const handleScan = useCallback(() => {
    const results = service.scan();
    toast({
      title: 'Scan concluído',
      description: `${results.length} insight(s) detectado(s).`,
    });
  }, [service, toast]);

  const handleAIAnalysis = useCallback(async (type: 'deep_risk' | 'compliance_audit' | 'remediation_plan' | 'trend_forecast') => {
    const result = await service.requestAIAnalysis(type);
    if (!result) {
      toast({ title: 'Erro', description: 'Falha na análise AI.', variant: 'destructive' });
    }
  }, [service, toast]);

  const criticalCount = insights.filter(i => i.severity === 'critical').length;
  const warningCount = insights.filter(i => i.severity === 'warning').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Governance AI
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Análise heurística local + inteligência artificial para governança de acesso.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleScan} disabled={scanning} variant="outline" size="sm">
            {scanning ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Scan className="h-4 w-4 mr-1" />}
            Scan Heurístico
          </Button>
          <Button onClick={() => handleAIAnalysis('deep_risk')} disabled={aiLoading} size="sm">
            {aiLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
            Análise AI Profunda
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{criticalCount}</p>
                <p className="text-xs text-muted-foreground">Críticos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[hsl(38_92%_50%)]/10">
                <AlertTriangle className="h-5 w-5 text-[hsl(38_92%_40%)]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{warningCount}</p>
                <p className="text-xs text-muted-foreground">Alertas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{insights.length}</p>
                <p className="text-xs text-muted-foreground">Total Insights</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {insights.filter(i => i.auto_remediable).length}
                </p>
                <p className="text-xs text-muted-foreground">Auto-remediáveis</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="insights" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
          <TabsTrigger value="insights" className="text-xs">Insights</TabsTrigger>
          <TabsTrigger value="ai-analysis" className="text-xs">Análise AI</TabsTrigger>
          <TabsTrigger value="compliance" className="text-xs">Compliance</TabsTrigger>
          <TabsTrigger value="forecast" className="text-xs">Previsão</TabsTrigger>
        </TabsList>

        <TabsContent value="insights">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Insights Detectados</CardTitle>
              <CardDescription>Resultados do scan heurístico local sobre o UGE</CardDescription>
            </CardHeader>
            <CardContent>
              {insights.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Scan className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Execute um scan para detectar insights.</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {insights.map(insight => {
                      const config = severityConfig[insight.severity];
                      const Icon = config.icon;
                      return (
                        <div key={insight.id} className="border border-border rounded-lg p-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-3 min-w-0">
                              <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", insight.severity === 'critical' ? 'text-destructive' : insight.severity === 'warning' ? 'text-[hsl(38_92%_40%)]' : 'text-primary')} />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground">{insight.title}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{insight.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant="outline" className={cn("text-[10px]", config.color)}>
                                {config.label}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">{Math.round(insight.confidence * 100)}%</span>
                            </div>
                          </div>
                          {insight.recommendation && (
                            <div className="ml-7 p-2 rounded-md bg-muted/50">
                              <p className="text-xs text-muted-foreground">
                                <span className="font-medium">Recomendação:</span> {insight.recommendation}
                              </p>
                            </div>
                          )}
                          {insight.affected_entities.length > 0 && (
                            <div className="ml-7 flex flex-wrap gap-1">
                              {insight.affected_entities.map((e, i) => (
                                <Badge key={i} variant="secondary" className="text-[10px]">
                                  {e.type}: {e.label}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-analysis">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Análise AI Profunda</CardTitle>
                <CardDescription>Powered by Governance AI Layer</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleAIAnalysis('compliance_audit')} disabled={aiLoading}>
                  Auditoria Compliance
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleAIAnalysis('remediation_plan')} disabled={aiLoading}>
                  Plano Remediação
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {aiLoading && (
                <div className="text-center py-12">
                  <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground mt-3">Analisando com AI...</p>
                </div>
              )}
              {!aiLoading && !aiResponse && (
                <div className="text-center py-12 text-muted-foreground">
                  <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Execute uma análise AI para ver os resultados.</p>
                </div>
              )}
              {!aiLoading && aiResponse && (
                <div className="space-y-4">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{aiResponse.analysis}</p>
                  </div>
                  {aiResponse.recommendations && aiResponse.recommendations.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-foreground">Recomendações AI</h4>
                      {aiResponse.recommendations.map((rec, i) => (
                        <div key={i} className="border border-border rounded-lg p-3 flex items-start gap-3">
                          <Badge variant={rec.priority === 'critical' ? 'destructive' : 'outline'} className="text-[10px] shrink-0">
                            {rec.priority}
                          </Badge>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{rec.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{rec.description}</p>
                            <p className="text-xs text-primary mt-1">↓ Redução estimada: {rec.estimated_risk_reduction}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Compliance Gaps</CardTitle>
              <CardDescription>Análise de conformidade com LGPD, SOX e ISO 27001</CardDescription>
            </CardHeader>
            <CardContent>
              {aiResponse?.compliance_gaps && aiResponse.compliance_gaps.length > 0 ? (
                <div className="space-y-2">
                  {aiResponse.compliance_gaps.map((gap, i) => (
                    <div key={i} className="flex items-center justify-between border border-border rounded-lg p-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{gap.regulation}</p>
                        <p className="text-xs text-muted-foreground">{gap.requirement}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={gap.current_status === 'compliant' ? 'default' : gap.current_status === 'partial' ? 'secondary' : 'destructive'} className="text-[10px]">
                          {gap.current_status === 'compliant' ? 'Conforme' : gap.current_status === 'partial' ? 'Parcial' : 'Não conforme'}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          Esforço: {gap.remediation_effort}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Shield className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Execute "Auditoria Compliance" na aba Análise AI.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forecast">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Previsão de Risco</CardTitle>
              <CardDescription>Projeção de tendência para 30 e 90 dias</CardDescription>
            </CardHeader>
            <CardContent>
              {aiResponse?.risk_forecast ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <p className="text-3xl font-bold text-foreground">{aiResponse.risk_forecast.current_score}</p>
                      <p className="text-xs text-muted-foreground mt-1">Score Atual</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <p className="text-3xl font-bold text-foreground">{aiResponse.risk_forecast.projected_30d}</p>
                      <p className="text-xs text-muted-foreground mt-1">Projeção 30d</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <p className="text-3xl font-bold text-foreground">{aiResponse.risk_forecast.projected_90d}</p>
                      <p className="text-xs text-muted-foreground mt-1">Projeção 90d</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Tendência:</span>
                    {aiResponse.risk_forecast.trend === 'improving' && <Badge className="bg-emerald-500/10 text-emerald-600"><TrendingDown className="h-3 w-3 mr-1" />Melhorando</Badge>}
                    {aiResponse.risk_forecast.trend === 'stable' && <Badge variant="secondary"><Minus className="h-3 w-3 mr-1" />Estável</Badge>}
                    {aiResponse.risk_forecast.trend === 'worsening' && <Badge variant="destructive"><TrendingUp className="h-3 w-3 mr-1" />Piorando</Badge>}
                  </div>
                  {aiResponse.risk_forecast.factors.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-foreground mb-2">Fatores</p>
                      <ul className="space-y-1">
                        {aiResponse.risk_forecast.factors.map((f, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                            <ChevronRight className="h-3 w-3 shrink-0" />{f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Execute "Análise AI Profunda" para gerar previsões.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
