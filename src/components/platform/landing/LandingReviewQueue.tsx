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
  Info
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

function GovernanceRiskPanel({ snapshot }: { snapshot: Record<string, unknown> }) {
  const [findings, setFindings] = useState<GrowthGovernanceFinding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await growthGovernanceAnalyzer.analyze();
        // Filter to the page from snapshot
        const pageId = snapshot?.id as string;
        const filtered = pageId ? all.filter(f => f.pageId === pageId) : all;
        if (!cancelled) setFindings(filtered);
      } catch {
        if (!cancelled) setFindings([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [snapshot]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const criticals = findings.filter(f => f.severity === 'critical');
  const warnings = findings.filter(f => f.severity === 'warning');
  const infos = findings.filter(f => f.severity === 'info');

  const overallRisk = criticals.length > 0 ? 'Alto' : warnings.length > 0 ? 'Médio' : 'Baixo';
  const overallColor = criticals.length > 0 ? 'text-destructive' : warnings.length > 0 ? 'text-primary' : 'text-muted-foreground';

  return (
    <div className="space-y-4">
      {/* Risk summary */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className={cn('h-4 w-4', overallColor)} />
            <span className="text-sm font-medium text-foreground">Risco geral</span>
          </div>
          <Badge variant={criticals.length > 0 ? 'destructive' : warnings.length > 0 ? 'secondary' : 'outline'}>
            {overallRisk}
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

      {/* Finding list */}
      {findings.length === 0 ? (
        <div className="py-6 text-center text-muted-foreground">
          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhum risco detectado pela Governance AI.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {findings.map(f => (
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
              {f.suggestedActions.length > 0 && (
                <div className="ml-6 space-y-0.5">
                  {f.suggestedActions.map((a, i) => (
                    <p key={i} className="text-[11px] text-muted-foreground">
                      • {a}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
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
