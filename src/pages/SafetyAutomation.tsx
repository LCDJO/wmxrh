import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  ShieldCheck, Workflow, ClipboardList, Zap, AlertTriangle, Clock,
  CheckCircle2, XCircle, ArrowUpCircle, RefreshCw, BarChart3, Building2, Trophy,
} from 'lucide-react';
import { runEscalationScan, getEscalationSummary } from '@/domains/safety-automation';
import { useToast } from '@/hooks/use-toast';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

interface WorkflowRow {
  id: string;
  type: string;
  status: string;
  priority: string;
  title: string;
  created_at: string;
  employee_id: string | null;
}

interface TaskRow {
  id: string;
  descricao: string;
  status: string;
  priority: string;
  prazo: string;
  escalation_count: number;
  employee_id: string | null;
  created_at: string;
}

interface AuditInsight {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: any;
  created_at: string;
}

interface CompanyComplianceStats {
  company_id: string;
  company_name: string;
  active_workflows: number;
  pending_tasks: number;
  critical_tasks: number;
  overdue_tasks: number;
  risks_mitigating: number;
  compliance_score: number;
}

// ═══════════════════════════════════════════════════════
// PRIORITY / STATUS HELPERS
// ═══════════════════════════════════════════════════════

const priorityConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  critical: { label: 'Crítica', variant: 'destructive' },
  high: { label: 'Alta', variant: 'destructive' },
  medium: { label: 'Média', variant: 'default' },
  low: { label: 'Baixa', variant: 'secondary' },
};

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
  open: { label: 'Aberto', icon: Clock, className: 'text-chart-4' },
  in_progress: { label: 'Em Andamento', icon: RefreshCw, className: 'text-chart-2' },
  resolved: { label: 'Resolvido', icon: CheckCircle2, className: 'text-chart-1' },
  cancelled: { label: 'Cancelado', icon: XCircle, className: 'text-muted-foreground' },
  pending: { label: 'Pendente', icon: Clock, className: 'text-chart-4' },
  done: { label: 'Concluída', icon: CheckCircle2, className: 'text-chart-1' },
};

function PriorityBadge({ priority }: { priority: string }) {
  const cfg = priorityConfig[priority] ?? { label: priority, variant: 'outline' as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function StatusIcon({ status }: { status: string }) {
  const cfg = statusConfig[status];
  if (!cfg) return <Badge variant="outline">{status}</Badge>;
  const Icon = cfg.icon;
  return (
    <span className={`flex items-center gap-1.5 text-sm font-medium ${cfg.className}`}>
      <Icon className="h-4 w-4" />
      {cfg.label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════

export default function SafetyAutomation() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const { toast } = useToast();

  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [actions, setActions] = useState<AuditInsight[]>([]);
  const [escalationSummary, setEscalationSummary] = useState<any>(null);
  const [companyStats, setCompanyStats] = useState<CompanyComplianceStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    loadAll();
  }, [tenantId]);

  async function loadAll() {
    if (!tenantId) return;
    setLoading(true);

    const [wfRes, taskRes, actRes] = await Promise.all([
      supabase
        .from('safety_workflows' as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('safety_tasks')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('audit_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .like('action', 'safety_insight:%')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    setWorkflows((wfRes.data ?? []) as any[]);
    setTasks((taskRes.data ?? []) as any[]);
    setActions((actRes.data ?? []) as any[]);

    const summary = await getEscalationSummary(tenantId);
    setEscalationSummary(summary);

    // Load company compliance stats
    await loadCompanyStats();

    setLoading(false);
  }

  async function loadCompanyStats() {
    if (!tenantId) return;

    // Get companies
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    if (!companies?.length) { setCompanyStats([]); return; }

    // Get workflows and tasks per company
    const [wfAll, tasksAll] = await Promise.all([
      supabase.from('safety_workflows' as any).select('id, company_id, status').eq('tenant_id', tenantId),
      supabase.from('safety_tasks').select('id, company_id, status, priority, prazo').eq('tenant_id', tenantId),
    ]);

    const wfData = (wfAll.data ?? []) as any[];
    const taskData = (tasksAll.data ?? []) as any[];

    const stats: CompanyComplianceStats[] = companies.map(c => {
      const cWf = wfData.filter((w: any) => w.company_id === c.id);
      const cTasks = taskData.filter((t: any) => t.company_id === c.id);
      const pending = cTasks.filter((t: any) => t.status === 'pending');
      const critical = pending.filter((t: any) => t.priority === 'critical' || t.priority === 'high');
      const overdue = pending.filter((t: any) => t.prazo && new Date(t.prazo) < new Date());
      const activeWf = cWf.filter((w: any) => w.status === 'open' || w.status === 'in_progress');
      const doneTotal = cTasks.filter((t: any) => t.status === 'done').length;
      const total = cTasks.length || 1;
      const score = Math.round((doneTotal / total) * 100);

      return {
        company_id: c.id,
        company_name: c.name,
        active_workflows: activeWf.length,
        pending_tasks: pending.length,
        critical_tasks: critical.length,
        overdue_tasks: overdue.length,
        risks_mitigating: activeWf.filter((w: any) => w.status === 'in_progress').length,
        compliance_score: score,
      };
    });

    stats.sort((a, b) => b.compliance_score - a.compliance_score);
    setCompanyStats(stats);
  }

  async function handleRunEscalation() {
    if (!tenantId) return;
    const results = await runEscalationScan(tenantId);
    toast({
      title: 'Escalação executada',
      description: `${results.length} tarefa(s) escalada(s).`,
    });
    loadAll();
  }

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const activeWorkflows = workflows.filter((w: any) => w.status === 'open' || w.status === 'in_progress');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Automação de Segurança
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Workflows, tarefas e ações automáticas de segurança do trabalho
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={handleRunEscalation}>
            <ArrowUpCircle className="h-4 w-4 mr-1.5" />
            Executar Escalação
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Workflows Ativos</CardDescription>
            <CardTitle className="text-2xl">{activeWorkflows.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tarefas Pendentes</CardDescription>
            <CardTitle className="text-2xl">{pendingTasks.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Escaladas</CardDescription>
            <CardTitle className="text-2xl">{escalationSummary?.escalated_count ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ações Executadas</CardDescription>
            <CardTitle className="text-2xl">{actions.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />Dashboard
          </TabsTrigger>
          <TabsTrigger value="workflows" className="gap-1.5">
            <Workflow className="h-4 w-4" />Workflows Ativos
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1.5">
            <ClipboardList className="h-4 w-4" />Tarefas Pendentes
          </TabsTrigger>
          <TabsTrigger value="actions" className="gap-1.5">
            <Zap className="h-4 w-4" />Ações Executadas
          </TabsTrigger>
        </TabsList>

        {/* ── Dashboard ── */}
        <TabsContent value="dashboard">
          <div className="space-y-6">
            {/* Empty state explainer */}
            {workflows.length === 0 && tasks.length === 0 && (
              <Card className="border-dashed border-2 border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    Como funciona a Automação de Segurança?
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    Atualmente <strong className="text-foreground">não há workflows ativos</strong>. Os workflows são criados automaticamente quando o motor de automação detecta sinais de risco, como:
                  </p>
                  <ul className="list-disc list-inside space-y-1.5 ml-2">
                    <li><strong className="text-foreground">Exames vencidos</strong> — ASO periódico ou admissional com data expirada</li>
                    <li><strong className="text-foreground">Score de risco elevado</strong> — colaboradores com exposição a agentes nocivos</li>
                    <li><strong className="text-foreground">Treinamentos NR pendentes</strong> — capacitações obrigatórias não realizadas</li>
                    <li><strong className="text-foreground">Bloqueios operacionais</strong> — colaboradores impedidos por falta de conformidade</li>
                  </ul>
                  <p>
                    Quando um sinal é processado, o sistema gera <strong className="text-foreground">tarefas corretivas</strong>, notifica gestores e pode aplicar bloqueios preventivos automaticamente.
                  </p>
                  <div className="flex items-center gap-2 pt-2 text-xs">
                    <Badge variant="outline" className="gap-1">
                      <Workflow className="h-3 w-3" />
                      Status possíveis: Aberto → Em Andamento → Resolvido
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Company-level cards */}
            <div>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
                <Building2 className="h-5 w-5 text-primary" />
                Visão por Empresa
              </h2>
              {companyStats.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma empresa com dados de segurança.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {companyStats.map(cs => (
                    <Card key={cs.company_id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base truncate">{cs.company_name}</CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <span>Score: {cs.compliance_score}%</span>
                          <Progress value={cs.compliance_score} className="h-2 flex-1" />
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="space-y-1">
                            <p className="text-muted-foreground text-xs">Workflows Ativos</p>
                            <p className="font-semibold text-foreground">{cs.active_workflows}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-muted-foreground text-xs">Riscos em Mitigação</p>
                            <p className="font-semibold text-chart-4">{cs.risks_mitigating}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-muted-foreground text-xs">Tarefas Críticas</p>
                            <p className="font-semibold text-destructive">{cs.critical_tasks}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-muted-foreground text-xs">Vencidas</p>
                            <p className={`font-semibold ${cs.overdue_tasks > 0 ? 'text-destructive' : 'text-chart-1'}`}>{cs.overdue_tasks}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Tenant-level: Compliance Ranking */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-chart-4" />
                  Ranking de Compliance por Empresa
                </CardTitle>
                <CardDescription>Ordenado pelo score de conclusão de tarefas de segurança</CardDescription>
              </CardHeader>
              <CardContent>
                {companyStats.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Nenhum dado disponível.</p>
                ) : (
                  <div className="space-y-3">
                    {companyStats.map((cs, idx) => (
                      <div key={cs.company_id} className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                        <div className={`flex items-center justify-center h-8 w-8 rounded-full text-sm font-bold shrink-0 ${
                          idx === 0 ? 'bg-chart-4/20 text-chart-4' :
                          idx === 1 ? 'bg-muted text-muted-foreground' :
                          idx === 2 ? 'bg-chart-2/20 text-chart-2' :
                          'bg-muted/50 text-muted-foreground'
                        }`}>
                          {idx + 1}º
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{cs.company_name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Progress value={cs.compliance_score} className="h-2 flex-1 max-w-[200px]" />
                            <span className="text-xs font-medium text-muted-foreground">{cs.compliance_score}%</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 shrink-0 text-xs text-muted-foreground">
                          <span>{cs.pending_tasks} pendentes</span>
                          {cs.critical_tasks > 0 && (
                            <Badge variant="destructive" className="text-[10px]">
                              {cs.critical_tasks} críticas
                            </Badge>
                          )}
                          {cs.overdue_tasks > 0 && (
                            <Badge variant="destructive" className="text-[10px]">
                              <AlertTriangle className="h-3 w-3 mr-0.5" />
                              {cs.overdue_tasks} vencidas
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Workflows Ativos ── */}
        <TabsContent value="workflows">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Workflows Ativos</CardTitle>
              <CardDescription>Automações de segurança em execução</CardDescription>
            </CardHeader>
            <CardContent>
              {activeWorkflows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhum workflow ativo no momento.</p>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <div className="space-y-3">
                    {activeWorkflows.map((wf: any) => (
                      <div key={wf.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                        <div className="space-y-1 min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{wf.title}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Tipo: {wf.type}</span>
                            <span>•</span>
                            <span>{new Date(wf.created_at).toLocaleDateString('pt-BR')}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <PriorityBadge priority={wf.priority} />
                          <StatusIcon status={wf.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tarefas Pendentes ── */}
        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tarefas Pendentes</CardTitle>
              <CardDescription>Ações corretivas aguardando resolução</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma tarefa pendente.</p>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <div className="space-y-3">
                    {pendingTasks.map((task: any) => {
                      const isOverdue = task.prazo && new Date(task.prazo) < new Date();
                      return (
                        <div key={task.id} className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${isOverdue ? 'border-destructive/30 bg-destructive/5' : 'bg-card hover:bg-muted/30'}`}>
                          <div className="space-y-1 min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{task.descricao}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Prazo: {task.prazo ? new Date(task.prazo).toLocaleDateString('pt-BR') : '—'}</span>
                              {task.escalation_count > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-1 text-destructive">
                                    <AlertTriangle className="h-3 w-3" />
                                    Escalação nível {task.escalation_count}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <PriorityBadge priority={task.priority ?? 'medium'} />
                            {isOverdue && <Badge variant="destructive">Vencida</Badge>}
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

        {/* ── Ações Automáticas Executadas ── */}
        <TabsContent value="actions">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ações Automáticas Executadas</CardTitle>
              <CardDescription>Histórico de ações executadas pelo motor de automação</CardDescription>
            </CardHeader>
            <CardContent>
              {actions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma ação automática registrada.</p>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <div className="space-y-3">
                    {actions.map((action: any) => (
                      <div key={action.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                        <div className="space-y-1 min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{action.metadata?.title ?? action.action}</p>
                          <p className="text-xs text-muted-foreground truncate">{action.metadata?.description ?? ''}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <Badge variant={action.metadata?.severity === 'critical' ? 'destructive' : 'outline'}>
                            {action.metadata?.severity ?? 'info'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(action.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
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
