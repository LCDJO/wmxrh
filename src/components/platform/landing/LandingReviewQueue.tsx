/**
 * LandingReviewQueue — Rich review interface for Directors.
 * Shows: Preview | Estimated Metrics | FAB Structure | Governance AI Risk
 */
import { useState, useEffect, useMemo } from 'react';
import { usePlatformIdentity } from '@/domains/platform/PlatformGuard';
import { usePlatformPermissions } from '@/domains/platform/use-platform-permissions';
import { landingPageGovernance, type ApprovalRequest } from '@/domains/platform-growth/landing-page-governance';
import { growthGovernanceAnalyzer, type GrowthGovernanceFinding } from '@/domains/platform-growth/growth-governance-analyzer';
import { LandingPageRenderer } from '@/components/landing/LandingPageRenderer';
import type { LandingPage, FABBlock, FABContent, LPCopyBlueprint } from '@/domains/platform-growth/types';
import { fabContentEngine } from '@/domains/platform-growth/landing-page-builder';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Loader2, CheckCircle2, XCircle, Clock, ClipboardList,
  Eye, BarChart3, Layers, ShieldAlert, AlertTriangle,
  TrendingUp, Users, MousePointerClick, Timer, ArrowUpDown,
  Info, Brain, Sparkles, Ban, ThumbsUp
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ── Subcomponents ───────────────────────────────────────────

function MetricsPanel({ snapshot }: { snapshot: Record<string, unknown> }) {
  const analytics = (snapshot?.analytics as Record<string, unknown>) ?? {};
  const blocks = (snapshot?.blocks as FABBlock[]) ?? [];

  const metrics = [
    {
      label: 'Views estimados',
      value: (analytics.views as number) ?? 0,
      icon: Eye,
      color: 'text-primary',
    },
    {
      label: 'Visitantes únicos',
      value: (analytics.uniqueVisitors as number) ?? 0,
      icon: Users,
      color: 'text-primary',
    },
    {
      label: 'Conversões',
      value: (analytics.conversions as number) ?? 0,
      icon: MousePointerClick,
      color: 'text-primary',
    },
    {
      label: 'Taxa de conversão',
      value: `${((analytics.conversionRate as number) ?? 0).toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-primary',
    },
    {
      label: 'Bounce rate',
      value: `${((analytics.bounceRate as number) ?? 0).toFixed(1)}%`,
      icon: ArrowUpDown,
      color: 'text-primary',
    },
    {
      label: 'Tempo médio',
      value: `${((analytics.avgTimeOnPage as number) ?? 0).toFixed(0)}s`,
      icon: Timer,
      color: 'text-primary',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-lg border bg-card p-3 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <m.icon className={cn('h-3.5 w-3.5', m.color)} />
              <span className="text-xs">{m.label}</span>
            </div>
            <p className="text-lg font-semibold text-foreground">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-card p-3">
        <p className="text-xs font-medium text-muted-foreground mb-2">Composição da página</p>
        <div className="flex flex-wrap gap-1.5">
          {blocks.length > 0 ? (
            blocks.map((b, i) => (
              <Badge key={i} variant="outline" className="text-xs capitalize">
                {b.type} #{b.order + 1}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">Sem blocos no snapshot</span>
          )}
        </div>
      </div>
    </div>
  );
}

function FABStructurePanel({ snapshot }: { snapshot: Record<string, unknown> }) {
  const blocks = (snapshot?.blocks as FABBlock[]) ?? [];
  const fabBlocks = blocks.filter(b => b.fab);

  if (fabBlocks.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <Layers className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Nenhum bloco FAB encontrado no snapshot.</p>
      </div>
    );
  }

  const getCompleteness = (fab: FABContent) => {
    let score = 0;
    if (fab.feature && fab.feature.trim().length >= 3) score += 33;
    if (fab.advantage && fab.advantage.trim().length >= 3) score += 33;
    if (fab.benefit && fab.benefit.trim().length >= 3) score += 34;
    return score;
  };

  return (
    <div className="space-y-3">
      {fabBlocks.map((block, i) => {
        const completeness = getCompleteness(block.fab);
        return (
          <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize text-xs">
                  {block.type}
                </Badge>
                <span className="text-xs text-muted-foreground">Seção #{block.order + 1}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{completeness}%</span>
                <Progress value={completeness} className="w-16 h-1.5" />
              </div>
            </div>

            <div className="grid gap-2">
              <FabField label="Feature" value={block.fab.feature} desc="O que é" />
              <FabField label="Advantage" value={block.fab.advantage} desc="Por que importa" />
              <FabField label="Benefit" value={block.fab.benefit} desc="Resultado para o cliente" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FabField({ label, value, desc }: { label: string; value?: string; desc: string }) {
  const filled = value && value.trim().length >= 3;
  return (
    <div className="flex items-start gap-2">
      <div className={cn(
        'mt-0.5 h-4 w-4 rounded-full flex items-center justify-center text-[10px]',
        filled ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
      )}>
        {filled ? '✓' : '✗'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground">
          {label} <span className="font-normal text-muted-foreground">— {desc}</span>
        </p>
        {filled ? (
          <p className="text-xs text-muted-foreground truncate">{value}</p>
        ) : (
          <p className="text-xs text-destructive/70 italic">Não preenchido</p>
        )}
      </div>
    </div>
  );
}

// ── AI Content Analysis types ──────────────────────────────

interface AIContentFinding {
  category: 'linguagem_inadequada' | 'fab_mal_estruturado' | 'cta_sem_tracking';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  block_index?: number;
  suggested_fix: string;
}

interface AIContentAnalysis {
  overall_risk: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  findings: AIContentFinding[];
  approval_recommendation: 'approve' | 'review_needed' | 'reject';
  approval_reasoning: string;
}

const CATEGORY_LABELS: Record<string, { label: string; icon: typeof AlertTriangle }> = {
  linguagem_inadequada: { label: 'Linguagem', icon: Ban },
  fab_mal_estruturado: { label: 'FAB', icon: Layers },
  cta_sem_tracking: { label: 'CTA/Tracking', icon: MousePointerClick },
};

function GovernanceRiskPanel({ snapshot }: { snapshot: Record<string, unknown> }) {
  const [heuristicFindings, setHeuristicFindings] = useState<GrowthGovernanceFinding[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<AIContentAnalysis | null>(null);
  const [loadingHeuristic, setLoadingHeuristic] = useState(true);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Heuristic analysis (existing)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await growthGovernanceAnalyzer.analyze();
        const pageId = snapshot?.id as string;
        const filtered = pageId ? all.filter(f => f.pageId === pageId) : all;
        if (!cancelled) setHeuristicFindings(filtered);
      } catch {
        if (!cancelled) setHeuristicFindings([]);
      } finally {
        if (!cancelled) setLoadingHeuristic(false);
      }
    })();
    return () => { cancelled = true; };
  }, [snapshot]);

  // AI Content Analysis
  const runAIAnalysis = async () => {
    setLoadingAI(true);
    setAiError(null);
    try {
      const { data, error } = await supabase.functions.invoke('governance-ai', {
        body: {
          action: 'analyze_landing_content',
          landing_data: {
            name: snapshot?.name,
            slug: snapshot?.slug,
            blocks: snapshot?.blocks ?? [],
            gtm_container_id: snapshot?.gtm_container_id,
          },
        },
      });
      if (error) throw error;
      setAiAnalysis(data?.analysis ?? null);
    } catch (err: any) {
      const msg = err?.message ?? 'Erro ao analisar conteúdo';
      if (err?.status === 429) {
        setAiError('Rate limit excedido. Tente novamente em alguns segundos.');
      } else if (err?.status === 402) {
        setAiError('Créditos insuficientes. Adicione créditos ao workspace.');
      } else {
        setAiError(msg);
      }
    } finally {
      setLoadingAI(false);
    }
  };

  const criticals = heuristicFindings.filter(f => f.severity === 'critical');
  const warnings = heuristicFindings.filter(f => f.severity === 'warning');
  const infos = heuristicFindings.filter(f => f.severity === 'info');

  const overallColor = criticals.length > 0 ? 'text-destructive' : warnings.length > 0 ? 'text-primary' : 'text-muted-foreground';

  const recommendationConfig = {
    approve: { label: 'Aprovar', icon: ThumbsUp, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/30' },
    review_needed: { label: 'Revisão necessária', icon: AlertTriangle, color: 'text-primary', bg: 'bg-primary/5' },
    reject: { label: 'Rejeitar', icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/5' },
  };

  return (
    <div className="space-y-4">
      {/* Heuristic summary */}
      {loadingHeuristic ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className={cn('h-4 w-4', overallColor)} />
                <span className="text-sm font-medium text-foreground">Análise Heurística</span>
              </div>
              <Badge variant={criticals.length > 0 ? 'destructive' : warnings.length > 0 ? 'secondary' : 'outline'}>
                {criticals.length > 0 ? 'Alto' : warnings.length > 0 ? 'Médio' : 'Baixo'}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded bg-destructive/10 p-2">
                <p className="text-lg font-bold text-destructive">{criticals.length}</p>
                <p className="text-[10px] text-muted-foreground">Críticos</p>
              </div>
              <div className="rounded bg-primary/10 p-2">
                <p className="text-lg font-bold text-primary">{warnings.length}</p>
                <p className="text-[10px] text-muted-foreground">Alertas</p>
              </div>
              <div className="rounded bg-muted p-2">
                <p className="text-lg font-bold text-muted-foreground">{infos.length}</p>
                <p className="text-[10px] text-muted-foreground">Info</p>
              </div>
            </div>
          </div>

          {/* Heuristic findings */}
          {heuristicFindings.length > 0 && (
            <div className="space-y-2">
              {heuristicFindings.map(f => (
                <div key={f.id} className="rounded-lg border bg-card p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    {f.severity === 'critical' ? (
                      <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    ) : f.severity === 'warning' ? (
                      <AlertTriangle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    ) : (
                      <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{f.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
                    </div>
                    <Badge variant={f.severity === 'critical' ? 'destructive' : f.severity === 'warning' ? 'secondary' : 'outline'} className="shrink-0 text-[10px]">
                      {f.category.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* AI Analysis section */}
      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Governance AI — Análise de Conteúdo</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            disabled={loadingAI}
            onClick={runAIAnalysis}
          >
            {loadingAI ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {aiAnalysis ? 'Re-analisar' : 'Analisar com IA'}
          </Button>
        </div>

        {aiError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-xs text-destructive">{aiError}</p>
          </div>
        )}

        {!aiAnalysis && !loadingAI && !aiError && (
          <div className="py-6 text-center text-muted-foreground">
            <Brain className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">Clique em "Analisar com IA" para verificar linguagem, FAB e tracking.</p>
          </div>
        )}

        {aiAnalysis && (
          <div className="space-y-3 animate-fade-in">
            {/* AI Recommendation Banner */}
            {(() => {
              const rec = recommendationConfig[aiAnalysis.approval_recommendation];
              const RecIcon = rec.icon;
              return (
                <div className={cn('rounded-lg border p-3', rec.bg)}>
                  <div className="flex items-center gap-2 mb-1">
                    <RecIcon className={cn('h-4 w-4', rec.color)} />
                    <span className={cn('text-sm font-semibold', rec.color)}>
                      Recomendação: {rec.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{aiAnalysis.approval_reasoning}</p>
                </div>
              );
            })()}

            {/* Risk summary */}
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Risco geral (IA)</span>
                <Badge variant={
                  aiAnalysis.overall_risk === 'critical' ? 'destructive' :
                  aiAnalysis.overall_risk === 'high' ? 'destructive' :
                  aiAnalysis.overall_risk === 'medium' ? 'secondary' : 'outline'
                }>
                  {aiAnalysis.overall_risk.toUpperCase()}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{aiAnalysis.summary}</p>
            </div>

            {/* AI Findings */}
            {aiAnalysis.findings.length === 0 ? (
              <div className="py-4 text-center">
                <CheckCircle2 className="h-6 w-6 mx-auto mb-1 text-green-500 opacity-60" />
                <p className="text-xs text-muted-foreground">Nenhum problema detectado pela IA.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {aiAnalysis.findings.map((f, i) => {
                  const cat = CATEGORY_LABELS[f.category];
                  const CatIcon = cat?.icon ?? AlertTriangle;
                  return (
                    <div key={i} className="rounded-lg border bg-card p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <CatIcon className={cn(
                          'h-4 w-4 mt-0.5 shrink-0',
                          f.severity === 'critical' ? 'text-destructive' :
                          f.severity === 'warning' ? 'text-primary' : 'text-muted-foreground'
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{f.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
                        </div>
                        <Badge variant={f.severity === 'critical' ? 'destructive' : f.severity === 'warning' ? 'secondary' : 'outline'} className="shrink-0 text-[10px]">
                          {cat?.label ?? f.category}
                        </Badge>
                      </div>
                      <div className="ml-6 rounded bg-muted/50 p-2">
                        <p className="text-[11px] text-muted-foreground">
                          <span className="font-medium text-foreground">Sugestão:</span> {f.suggested_fix}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Preview panel ──────────────────────────────────────────

function PreviewPanel({ snapshot }: { snapshot: Record<string, unknown> }) {
  const page = snapshot as unknown as LandingPage | undefined;

  if (!page || !page.blocks || page.blocks.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <Eye className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Preview não disponível — snapshot sem blocos.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden bg-background">
      <div className="max-h-[60vh] overflow-y-auto">
        <LandingPageRenderer page={page} />
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────

export function LandingReviewQueue() {
  const { identity } = usePlatformIdentity();
  const { can } = usePlatformPermissions();
  const { toast } = useToast();
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const canApprove = can('landing.approve');
  const canReject = can('landing.reject');

  const fetchPending = async () => {
    setLoading(true);
    const data = await landingPageGovernance.listByStatus('pending_review');
    setRequests(data);
    if (data.length > 0 && !expandedId) {
      setExpandedId(data[0].id);
    }
    setLoading(false);
  };

  useEffect(() => { fetchPending(); }, []);

  const handleApprove = async (requestId: string) => {
    if (!identity) return;
    setActing(requestId);
    try {
      await landingPageGovernance.approve(requestId, {
        userId: identity.id,
        email: identity.email,
        role: identity.role,
      }, notes[requestId]);
      toast({ title: 'Aprovada!', description: 'Landing page aprovada com sucesso.' });
      fetchPending();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (requestId: string) => {
    if (!identity) return;
    const reason = notes[requestId]?.trim();
    if (!reason) {
      toast({ title: 'Atenção', description: 'Informe o motivo da rejeição.', variant: 'destructive' });
      return;
    }
    setActing(requestId);
    try {
      await landingPageGovernance.reject(requestId, {
        userId: identity.id,
        email: identity.email,
        role: identity.role,
      }, reason);
      toast({ title: 'Rejeitada', description: 'Landing page devolvida para rascunho.' });
      fetchPending();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
          <ClipboardList className="h-5 w-5 text-accent-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Fila de Revisão</h1>
          <p className="text-sm text-muted-foreground">
            Revise landing pages com preview, métricas, FAB e análise de risco.
          </p>
        </div>
        <Badge variant="secondary" className="ml-auto">
          {requests.length} pendente{requests.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-3 opacity-40" />
            Nenhuma landing page aguardando revisão.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map(req => {
            const isExpanded = expandedId === req.id;
            const snapshot = (req.page_snapshot ?? {}) as Record<string, unknown>;

            return (
              <Card key={req.id} className="overflow-hidden">
                {/* Summary header — always visible */}
                <CardHeader
                  className="cursor-pointer hover:bg-muted/30 transition-colors pb-3"
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {(snapshot.name as string) ?? `Solicitação v${req.version_number}`}
                        <Badge variant="outline" className="text-[10px] font-normal">
                          v{req.version_number}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Por <span className="font-medium text-foreground">{req.submitted_by}</span> · {' '}
                        {new Date(req.submitted_at).toLocaleDateString('pt-BR', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">
                      <Clock className="h-3 w-3 mr-1" /> Pendente
                    </Badge>
                  </div>
                </CardHeader>

                {/* Expanded detail panel */}
                {isExpanded && (
                  <CardContent className="pt-0 space-y-4">
                    <Separator />

                    {/* Submitter notes */}
                    {req.submission_notes && (
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Notas do submissor:</p>
                        <p className="text-sm">{req.submission_notes}</p>
                      </div>
                    )}

                    {/* Tabbed inspection panels */}
                    <Tabs defaultValue="preview" className="w-full">
                      <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="preview" className="gap-1.5 text-xs">
                          <Eye className="h-3 w-3" /> Preview
                        </TabsTrigger>
                        <TabsTrigger value="metrics" className="gap-1.5 text-xs">
                          <BarChart3 className="h-3 w-3" /> Métricas
                        </TabsTrigger>
                        <TabsTrigger value="fab" className="gap-1.5 text-xs">
                          <Layers className="h-3 w-3" /> FAB
                        </TabsTrigger>
                        <TabsTrigger value="risk" className="gap-1.5 text-xs">
                          <ShieldAlert className="h-3 w-3" /> Risco
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="preview" className="mt-4">
                        <PreviewPanel snapshot={snapshot} />
                      </TabsContent>

                      <TabsContent value="metrics" className="mt-4">
                        <MetricsPanel snapshot={snapshot} />
                      </TabsContent>

                      <TabsContent value="fab" className="mt-4">
                        <FABStructurePanel snapshot={snapshot} />
                      </TabsContent>

                      <TabsContent value="risk" className="mt-4">
                        <GovernanceRiskPanel snapshot={snapshot} />
                      </TabsContent>
                    </Tabs>

                    <Separator />

                    {/* Review notes + actions */}
                    <Textarea
                      placeholder={canReject ? 'Notas da revisão (obrigatório para rejeição)...' : 'Notas da revisão...'}
                      value={notes[req.id] ?? ''}
                      onChange={e => setNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                      rows={2}
                    />

                    {(canApprove || canReject) && (
                      <div className="flex gap-2 justify-end">
                        {canReject && (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="gap-1.5"
                            disabled={acting === req.id}
                            onClick={() => handleReject(req.id)}
                          >
                            {acting === req.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                            Rejeitar
                          </Button>
                        )}
                        {canApprove && (
                          <Button
                            size="sm"
                            className="gap-1.5"
                            disabled={acting === req.id}
                            onClick={() => handleApprove(req.id)}
                          >
                            {acting === req.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                            Aprovar
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
