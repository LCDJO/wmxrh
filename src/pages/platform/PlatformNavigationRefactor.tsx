/**
 * PlatformNavigationRefactor — Dashboard de Refatoração de Navegação
 *
 * Mostra: versão atual, nova versão proposta, impacto por módulo, impacto por plano.
 * Pipeline: Draft → Preview → Approve → Apply
 */

import { useState, useMemo } from 'react';
import {
  GitBranch, Eye, ShieldCheck, Rocket, AlertTriangle, CheckCircle2,
  XCircle, Clock, ArrowRight, Layers, Package, Plus, RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  getLatestVersion,
  listVersions,
  createNavigationDraft,
  listDrafts,
  submitDraftForApproval,
  approveDraft,
  rejectDraft,
  applyApprovedDraft,
  getDraft,
  buildMenuHierarchy,
  flattenHierarchy,
  validateNavigationRules,
  NAVIGATION_RULES,
  type NavigationDraft,
  type DraftStatus,
  type NavigationVersion,
  type DiffChange,
  type ValidationResult,
} from '@/domains/navigation-governance';

// ── Status helpers ───────────────────────────────────────────

const STATUS_CONFIG: Record<DraftStatus, { label: string; color: string; icon: typeof Clock }> = {
  draft: { label: 'Rascunho', color: 'bg-muted text-muted-foreground', icon: Clock },
  pending_approval: { label: 'Aguardando Aprovação', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400', icon: Eye },
  approved: { label: 'Aprovado', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400', icon: CheckCircle2 },
  applied: { label: 'Aplicado', color: 'bg-primary/15 text-primary', icon: Rocket },
  rejected: { label: 'Rejeitado', color: 'bg-destructive/15 text-destructive', icon: XCircle },
  expired: { label: 'Expirado', color: 'bg-muted text-muted-foreground', icon: Clock },
};

// ── Mock plan impact data ────────────────────────────────────

const PLAN_NAMES = ['Starter', 'Professional', 'Enterprise', 'Custom'];

function computePlanImpact(changes: DiffChange[]) {
  return PLAN_NAMES.map(plan => {
    const affected = changes.filter(c => c.type === 'moved' || c.type === 'added');
    return {
      plan,
      affected_modules: affected.length,
      visibility_changes: affected.filter(c => c.type === 'moved').length,
      new_modules: affected.filter(c => c.type === 'added').length,
    };
  });
}

// ── Component ────────────────────────────────────────────────

export default function PlatformNavigationRefactor() {
  const [tab, setTab] = useState('overview');
  const [drafts, setDrafts] = useState<NavigationDraft[]>(() => listDrafts());
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);

  const currentVersion = getLatestVersion();
  const versions = listVersions();
  const selectedDraft = selectedDraftId ? getDraft(selectedDraftId) : null;

  const currentHierarchy = useMemo(() => buildMenuHierarchy(), []);
  const currentModuleCount = useMemo(() => {
    const pNodes = flattenHierarchy(currentHierarchy.platform);
    const tNodes = flattenHierarchy(currentHierarchy.tenant);
    return { platform: pNodes.length, tenant: tNodes.length, total: pNodes.length + tNodes.length };
  }, [currentHierarchy]);

  // ── Actions ──

  const handleCreateDraft = () => {
    const proposedSnapshot = buildMenuHierarchy(); // In real use, would be a modified snapshot
    const draft = createNavigationDraft({
      proposed_snapshot: proposedSnapshot,
      proposed_by: 'platform_super_admin',
      reason: 'Refatoração estrutural de navegação',
      context: 'tenant',
    });
    setDrafts(listDrafts());
    setSelectedDraftId(draft.id);
    setTab('drafts');
    toast.success('Draft criado com sucesso');
  };

  const handleSubmitForApproval = (draftId: string) => {
    const result = submitDraftForApproval(draftId);
    setDrafts(listDrafts());
    if (result.blocked) {
      toast.error(result.reason ?? 'Validação falhou — corrija as violações antes de submeter');
    } else {
      toast.info('Draft submetido para aprovação');
    }
  };

  const handleApprove = (draftId: string) => {
    approveDraft(draftId, 'platform_super_admin', 'Aprovado via dashboard');
    setDrafts(listDrafts());
    toast.success('Draft aprovado');
  };

  const handleReject = (draftId: string) => {
    rejectDraft(draftId, 'platform_super_admin', 'Necessita ajustes');
    setDrafts(listDrafts());
    toast.error('Draft rejeitado');
  };

  const handleApply = (draftId: string) => {
    const result = applyApprovedDraft(draftId);
    setDrafts(listDrafts());
    if (result.success) {
      toast.success(`Versão v${result.new_version} aplicada!`);
    } else {
      toast.error(result.summary[0]);
    }
  };

  const refreshDrafts = () => {
    setDrafts(listDrafts());
    toast.info('Lista atualizada');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Refatoração de Navegação
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pipeline controlado: Draft → Preview → Aprovação → Aplicação
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refreshDrafts}>
            <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
          </Button>
          <Button size="sm" onClick={handleCreateDraft}>
            <Plus className="h-4 w-4 mr-1" /> Novo Draft
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <GitBranch className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{currentVersion?.version ?? 0}</p>
                <p className="text-xs text-muted-foreground">Versão Atual</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Eye className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {drafts.filter(d => d.status === 'pending_approval').length}
                </p>
                <p className="text-xs text-muted-foreground">Aguardando Aprovação</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Layers className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{currentModuleCount.total}</p>
                <p className="text-xs text-muted-foreground">Módulos Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Package className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{versions.length}</p>
                <p className="text-xs text-muted-foreground">Versões no Histórico</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="drafts">
            Drafts
            {drafts.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                {drafts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="impact">Impacto</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Current Version */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <CardTitle className="text-base">Versão Atual</CardTitle>
                </div>
                <CardDescription>
                  {currentVersion
                    ? `v${currentVersion.version} — ${currentVersion.description ?? 'Sem descrição'}`
                    : 'Nenhuma versão registrada'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Módulos Platform</span>
                    <span className="font-medium text-foreground">{currentModuleCount.platform}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Módulos Tenant</span>
                    <span className="font-medium text-foreground">{currentModuleCount.tenant}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-muted-foreground">Total</span>
                    <span className="text-foreground">{currentModuleCount.total}</span>
                  </div>
                  {currentVersion && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Criado por: {currentVersion.created_by} em{' '}
                      {new Date(currentVersion.created_at).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Proposed / Selected Draft */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-amber-500" />
                  <CardTitle className="text-base">Proposta Selecionada</CardTitle>
                </div>
                <CardDescription>
                  {selectedDraft
                    ? `${selectedDraft.id.slice(0, 20)}… — ${selectedDraft.reason}`
                    : 'Nenhum draft selecionado'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedDraft ? (
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Status</span>
                      <Badge className={STATUS_CONFIG[selectedDraft.status].color}>
                        {STATUS_CONFIG[selectedDraft.status].label}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Mudanças</span>
                      <span className="font-medium text-foreground">
                        {selectedDraft.diff?.changes.length ?? 0}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Adicionados</span>
                      <span className="font-medium text-emerald-600">{selectedDraft.diff?.added.length ?? 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Removidos</span>
                      <span className="font-medium text-destructive">{selectedDraft.diff?.removed.length ?? 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Movidos</span>
                      <span className="font-medium text-amber-600">{selectedDraft.diff?.moved.length ?? 0}</span>
                    </div>
                    {/* Validation Status */}
                    {selectedDraft.validation && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Validação</span>
                        {selectedDraft.validation.valid ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Passou
                          </Badge>
                        ) : (
                          <Badge className="bg-destructive/15 text-destructive">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {selectedDraft.validation.violations.filter(v => v.severity === 'error').length} erro(s)
                          </Badge>
                        )}
                      </div>
                    )}
                    <Separator />
                    <div className="flex gap-2 pt-1">
                      {selectedDraft.status === 'draft' && (
                        <Button size="sm" variant="outline" onClick={() => handleSubmitForApproval(selectedDraft.id)}>
                          <Eye className="h-3.5 w-3.5 mr-1" /> Submeter
                        </Button>
                      )}
                      {selectedDraft.status === 'pending_approval' && (
                        <>
                          <Button size="sm" onClick={() => handleApprove(selectedDraft.id)}>
                            <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Aprovar
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleReject(selectedDraft.id)}>
                            <XCircle className="h-3.5 w-3.5 mr-1" /> Rejeitar
                          </Button>
                        </>
                      )}
                      {selectedDraft.status === 'approved' && (
                        <Button size="sm" onClick={() => handleApply(selectedDraft.id)}>
                          <Rocket className="h-3.5 w-3.5 mr-1" /> Aplicar
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <GitBranch className="h-8 w-8 mb-2 opacity-40" />
                    <p className="text-sm">Crie ou selecione um draft</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Diff Summary */}
          {selectedDraft?.diff && selectedDraft.diff.changes.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Diff: Antes vs Depois</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-2">
                    {selectedDraft.diff.changes.map((change, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 text-sm px-3 py-2 rounded-md bg-muted/30"
                      >
                        {change.type === 'added' && <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />}
                        {change.type === 'removed' && <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />}
                        {change.type === 'moved' && <ArrowRight className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />}
                        <div>
                          <p className="font-medium text-foreground">{change.description}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Módulo: {change.label} • Tipo: {change.type}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Drafts Tab ── */}
        <TabsContent value="drafts" className="mt-4">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Drafts de Refatoração</CardTitle>
              <CardDescription>Pipeline: Draft → Submissão → Aprovação → Aplicação</CardDescription>
            </CardHeader>
            <CardContent>
              {drafts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <GitBranch className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm">Nenhum draft criado</p>
                  <Button size="sm" className="mt-3" onClick={handleCreateDraft}>
                    <Plus className="h-4 w-4 mr-1" /> Criar Draft
                  </Button>
                </div>
              ) : (
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-2">
                    {drafts.map(draft => {
                      const cfg = STATUS_CONFIG[draft.status];
                      const Icon = cfg.icon;
                      const isSelected = draft.id === selectedDraftId;
                      return (
                        <div
                          key={draft.id}
                          onClick={() => setSelectedDraftId(draft.id)}
                          className={`
                            flex items-center justify-between px-4 py-3 rounded-lg cursor-pointer
                            border transition-colors
                            ${isSelected
                              ? 'border-primary/40 bg-primary/5'
                              : 'border-border/30 hover:border-border/60 bg-background'
                            }
                          `}
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium text-foreground">{draft.reason}</p>
                              <p className="text-xs text-muted-foreground">
                                {draft.id.slice(0, 24)}… • {new Date(draft.proposed_at).toLocaleString('pt-BR')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={cfg.color}>{cfg.label}</Badge>
                            {draft.diff && (
                              <Badge variant="outline" className="text-[10px]">
                                {draft.diff.changes.length} mudanças
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Impact Tab ── */}
        <TabsContent value="impact" className="space-y-4 mt-4">
          {/* Impact by Module */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4" /> Impacto por Módulo
              </CardTitle>
              <CardDescription>Módulos afetados pela refatoração proposta</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedDraft?.diff && selectedDraft.diff.changes.length > 0 ? (
                <div className="space-y-2">
                  {selectedDraft.diff.changes.map((change, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-3 py-2.5 rounded-md bg-muted/30"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`h-1.5 w-1.5 rounded-full ${
                          change.type === 'added' ? 'bg-emerald-500' :
                          change.type === 'removed' ? 'bg-destructive' : 'bg-amber-500'
                        }`} />
                        <span className="text-sm font-medium text-foreground">{change.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {change.from_group && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            {change.from_group}
                          </Badge>
                        )}
                        {change.from_group && change.to_group && (
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        )}
                        {change.to_group && (
                          <Badge variant="outline" className="text-[10px]">
                            {change.to_group}
                          </Badge>
                        )}
                        <Badge className={
                          change.type === 'added' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' :
                          change.type === 'removed' ? 'bg-destructive/15 text-destructive' :
                          'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                        }>
                          {change.type === 'added' ? 'Novo' : change.type === 'removed' ? 'Removido' : 'Movido'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {selectedDraft ? 'Nenhuma mudança de módulo detectada' : 'Selecione um draft para ver o impacto'}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Impact by Plan */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" /> Impacto por Plano
              </CardTitle>
              <CardDescription>Como a refatoração afeta cada plano de assinatura</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedDraft?.diff ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {computePlanImpact(selectedDraft.diff.changes).map(plan => (
                    <div key={plan.plan} className="rounded-lg border border-border/40 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium text-sm text-foreground">{plan.plan}</span>
                        {plan.affected_modules > 0 ? (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {plan.affected_modules} afetados
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Sem impacto
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Mudanças de visibilidade</span>
                          <span className="font-medium">{plan.visibility_changes}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Novos módulos</span>
                          <span className="font-medium">{plan.new_modules}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Selecione um draft para analisar impacto nos planos
                </p>
              )}
            </CardContent>
          </Card>

          {/* Structural Rules */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Regras Estruturais
              </CardTitle>
              <CardDescription>Regras obrigatórias validadas antes da submissão</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {NAVIGATION_RULES.map(rule => {
                  const violation = selectedDraft?.validation?.violations.find(v => v.rule === rule.id);
                  return (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between px-3 py-2.5 rounded-md bg-muted/30"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{rule.label}</p>
                        <p className="text-xs text-muted-foreground">{rule.description}</p>
                      </div>
                      {selectedDraft?.validation ? (
                        violation ? (
                          <Badge className="bg-destructive/15 text-destructive">
                            <XCircle className="h-3 w-3 mr-1" /> Violação
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> OK
                          </Badge>
                        )
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">—</Badge>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Validation violations detail */}
              {selectedDraft?.validation && !selectedDraft.validation.valid && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-medium text-destructive uppercase tracking-wider">Violações Detalhadas</p>
                  {selectedDraft.validation.violations.map((v, i) => (
                    <div key={i} className="text-sm px-3 py-2 rounded-md bg-destructive/5 border border-destructive/20">
                      <p className="font-medium text-foreground">{v.message}</p>
                      {v.details && <p className="text-xs text-muted-foreground mt-0.5">{v.details}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── History Tab ── */}
        <TabsContent value="history" className="mt-4">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Histórico de Versões</CardTitle>
              <CardDescription>Todas as versões de navegação registradas</CardDescription>
            </CardHeader>
            <CardContent>
              {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Nenhuma versão registrada ainda
                </p>
              ) : (
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-2">
                    {versions.slice().reverse().map(version => (
                      <div
                        key={version.id}
                        className="flex items-center justify-between px-4 py-3 rounded-lg border border-border/30 bg-background"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-bold text-primary">v{version.version}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {version.description ?? `Versão ${version.version}`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {version.created_by} • {new Date(version.created_at).toLocaleString('pt-BR')}
                            </p>
                          </div>
                        </div>
                        {version.version === currentVersion?.version && (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                            Atual
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
